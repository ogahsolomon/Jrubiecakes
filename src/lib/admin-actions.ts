"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";
import { ORDER_STATUSES, type OrderStatus } from "@/types";
import type { Database } from "@/types/database";

async function assertAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") throw new Error("Not authorized");
  return user.id;
}

// ---------------- Orders ----------------

export async function updateOrderStatus(formData: FormData) {
  await assertAdmin();
  const orderId = String(formData.get("orderId") ?? "");
  const status = String(formData.get("status") ?? "");
  const notify = formData.get("notify") === "on";

  if (!orderId || !ORDER_STATUSES.includes(status as never)) {
    throw new Error("Invalid status update");
  }

  const admin = createAdminClient();

  const update: Database["public"]["Tables"]["orders"]["Update"] = {
    order_status: status as OrderStatus,
  };

  // Business rules: completed => paid; cancelled => refunded if previously paid
  if (status === "completed") update.payment_status = "paid";
  if (status === "cancelled") {
    const { data: order } = await admin
      .from("orders")
      .select("payment_status")
      .eq("id", orderId)
      .single();
    if (order?.payment_status === "paid") update.payment_status = "refunded";
  }

  const { error } = await admin.from("orders").update(update).eq("id", orderId);
  if (error) throw new Error(error.message);

  // Mark matching payments too
  if (status === "completed") {
    await admin.from("payments").update({ status: "paid" }).eq("order_id", orderId);
  }
  if (status === "cancelled") {
    await admin.from("payments").update({ status: "refunded" }).eq("order_id", orderId);
  }

  if (notify) {
    // Send status update email (queued server action context)
    const { data: order } = await admin
      .from("orders")
      .select(
        `id, order_number, customer_name, customer_email, payment_method,
         fulfillment_type, requested_date, subtotal, delivery_fee, total,
         order_items (product_name, unit_price, quantity, line_total,
           order_item_options (option_name, option_value, price_delta))`
      )
      .eq("id", orderId)
      .single();
    if (order) {
      const { sendEmail } = await import("@/lib/email");
      const {
        orderStatusUpdateEmail,
        ORDER_STATUS_EMAIL_NOTES,
      } = await import("@/lib/email-templates");

      // Map DB rows into the PricedLine shape the template expects (kobo units)
      const lines = (order.order_items ?? []).map((it) => ({
        productId: "",
        productName: it.product_name,
        slug: "",
        imageUrl: null,
        unitPrice: Math.round(it.unit_price * 100),
        quantity: it.quantity,
        lineTotal: Math.round(it.line_total * 100),
        options: (it.order_item_options ?? []).map((o) => ({
          optionName: o.option_name,
          value: o.option_value,
          priceDelta: Math.round(o.price_delta * 100),
        })),
        minOrderQuantity: 1,
      }));

      const mail = orderStatusUpdateEmail({
        orderNumber: order.order_number,
        customerName: order.customer_name,
        status,
        statusNote: ORDER_STATUS_EMAIL_NOTES[status] ?? status,
        lines,
        subtotal: Math.round(order.subtotal * 100),
        deliveryFee: Math.round(order.delivery_fee * 100),
        total: Math.round(order.total * 100),
        paymentMethod: order.payment_method,
        fulfillmentType: order.fulfillment_type,
        requestedDate: order.requested_date,
      });
      void sendEmail({ to: order.customer_email, subject: mail.subject, html: mail.html });
    }
  }

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
  revalidatePath("/admin");
}

export async function markPaymentStatus(formData: FormData) {
  await assertAdmin();
  const paymentId = String(formData.get("paymentId") ?? "");
  const status = String(formData.get("status") ?? "");

  if (!paymentId || !["pending", "processing", "awaiting_payment", "paid", "failed", "abandoned", "refunded"].includes(status)) {
    throw new Error("Invalid payment status");
  }
  const paymentStatus = status as Database["public"]["Tables"]["payments"]["Insert"]["status"];

  const admin = createAdminClient();
  const { data: payment } = await admin
    .from("payments")
    .select("order_id, amount")
    .eq("id", paymentId)
    .single();
  if (!payment) throw new Error("Payment not found");

  await admin.from("payments").update({ status: paymentStatus }).eq("id", paymentId);

  try {
    const { recordPaymentEvent, PAYMENT_EVENTS } = await import("@/lib/payment-events");
    await recordPaymentEvent(
      paymentId,
      PAYMENT_EVENTS.manually_updated,
      `Admin set status to ${paymentStatus}`
    );
  } catch {
    // timeline logging is best-effort
  }

  const orderPaymentStatus =
    status === "paid" ? "paid" : status === "failed" ? "failed" : status === "refunded" ? "refunded" : undefined;

  const orderUpdate: Database["public"]["Tables"]["orders"]["Update"] = {};
  if (orderPaymentStatus) orderUpdate.payment_status = orderPaymentStatus;
  if (status === "paid") {
    const { data: order } = await admin
      .from("orders")
      .select("order_status")
      .eq("id", payment.order_id)
      .single();
    if (order && ["pending", "awaiting_payment"].includes(order.order_status)) {
      orderUpdate.order_status = "paid";
    }
  }
  if (Object.keys(orderUpdate).length > 0) {
    await admin.from("orders").update(orderUpdate).eq("id", payment.order_id);
  }

  revalidatePath("/admin/payments");
  revalidatePath(`/admin/orders/${payment.order_id}`);
}

// ---------------- Payment expiry ----------------

/**
 * Admin action: mark stale pending/processing Paystack payments as abandoned
 * (see src/lib/payment-expiry.ts for the business rules).
 */
export async function expireStalePaymentsAction() {
  await assertAdmin();
  const { expireStalePayments } = await import("@/lib/payment-expiry");
  const result = await expireStalePayments();

  revalidatePath("/admin/payments");
  revalidatePath("/admin/orders");
  return result;
}

// ---------------- Products ----------------

export async function saveProduct(formData: FormData) {
  await assertAdmin();
  const admin = createAdminClient();

  const id = String(formData.get("id") ?? "") || null;
  const name = String(formData.get("name") ?? "").trim();
  const categoryId = String(formData.get("categoryId") ?? "");
  const slugInput = String(formData.get("slug") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const price = Number(formData.get("price"));
  const salePriceRaw = String(formData.get("salePrice") ?? "").trim();
  const isAvailable = formData.get("isAvailable") === "on";
  const isFeatured = formData.get("isFeatured") === "on";
  const isCustomizable = formData.get("isCustomizable") === "on";
  const stockRaw = String(formData.get("stockQuantity") ?? "").trim();
  const prepTimeRaw = String(formData.get("prepTimeHours") ?? "").trim();
  const minQty = Number(formData.get("minOrderQuantity") ?? 1);

  if (name.length < 2) throw new Error("Product name is required");
  if (!categoryId) throw new Error("Category is required");
  if (!Number.isFinite(price) || price < 0) throw new Error("Price must be a positive number");

  const values = {
    name,
    slug: slugInput ? slugify(slugInput) : slugify(name),
    category_id: categoryId,
    description: description || null,
    price,
    sale_price: salePriceRaw ? Number(salePriceRaw) : null,
    is_available: isAvailable,
    is_featured: isFeatured,
    is_customizable: isCustomizable,
    stock_quantity: stockRaw ? Number(stockRaw) : null,
    prep_time_hours: prepTimeRaw ? Number(prepTimeRaw) : null,
    min_order_quantity: Number.isFinite(minQty) && minQty >= 1 ? Math.floor(minQty) : 1,
  };

  let productId = id;
  if (id) {
    const { error } = await admin.from("products").update(values).eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    const { data: created, error } = await admin.from("products").insert(values).select("id").single();
    if (error) throw new Error(error.message);
    productId = created.id;
  }

  revalidatePath("/admin/products");
  revalidatePath("/shop");
  revalidatePath(`/product/${values.slug}`);
  return productId;
}

export async function archiveProduct(formData: FormData) {
  await assertAdmin();
  const id = String(formData.get("id") ?? "");
  const archive = formData.get("archive") === "1";
  const admin = createAdminClient();
  const { error } = await admin.from("products").update({ is_available: !archive }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/products");
  revalidatePath("/shop");
}

export async function deleteProduct(formData: FormData) {
  await assertAdmin();
  const id = String(formData.get("id") ?? "");
  const admin = createAdminClient();
  const { error } = await admin.from("products").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/products");
  revalidatePath("/shop");
}

// ---------------- Product options ----------------

export async function saveProductOption(formData: FormData) {
  await assertAdmin();
  const admin = createAdminClient();

  const productId = String(formData.get("productId") ?? "");
  const optionId = String(formData.get("optionId") ?? "") || null;
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "select") as Database["public"]["Tables"]["product_options"]["Insert"]["type"];
  const isRequired = formData.get("isRequired") === "on";
  const valuesRaw = String(formData.get("values") ?? "").trim();

  if (!productId || name.length < 1) throw new Error("Option name is required");

  let id = optionId;
  if (optionId) {
    const { error } = await admin
      .from("product_options")
      .update({ name, type, is_required: isRequired })
      .eq("id", optionId);
    if (error) throw new Error(error.message);
    await admin.from("product_option_values").delete().eq("option_id", optionId);
  } else {
    const { data: created, error } = await admin
      .from("product_options")
      .insert({ product_id: productId, name, type, is_required: isRequired })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    id = created.id;
  }

  if (type === "select" && valuesRaw) {
    // Format: "Value:delta" or plain "Value", one per line
    const rows = valuesRaw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, i) => {
        const [value, delta] = line.split(":");
        return {
          option_id: id!,
          value: value.trim(),
          price_delta: delta && !Number.isNaN(Number(delta)) ? Number(delta) : 0,
          sort_order: i,
        };
      });
    if (rows.length > 0) {
      const { error } = await admin.from("product_option_values").insert(rows);
      if (error) throw new Error(error.message);
    }
  }

  revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/shop");
}

export async function deleteProductOption(formData: FormData) {
  await assertAdmin();
  const optionId = String(formData.get("optionId") ?? "");
  const productId = String(formData.get("productId") ?? "");
  const admin = createAdminClient();
  const { error } = await admin.from("product_options").delete().eq("id", optionId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/products/${productId}`);
}

// ---------------- Product images ----------------

export async function addProductImage(formData: FormData) {
  await assertAdmin();
  const admin = createAdminClient();
  const productId = String(formData.get("productId") ?? "");
  const file = formData.get("file") as File | null;
  const urlInput = String(formData.get("url") ?? "").trim();
  const altText = String(formData.get("altText") ?? "").trim() || null;

  let url = urlInput;

  if (file && file.size > 0) {
    if (file.size > 5 * 1024 * 1024) throw new Error("Image must be under 5MB");
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) throw new Error("Only PNG, JPG or WebP images");

    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `${productId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error: uploadError } = await admin.storage
      .from("product-images")
      .upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false });

    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

    const { data } = admin.storage.from("product-images").getPublicUrl(path);
    url = data.publicUrl;
  }

  if (!url) throw new Error("Provide an image file or URL");

  const { count } = await admin
    .from("product_images")
    .select("id", { count: "exact", head: true })
    .eq("product_id", productId);

  const { error } = await admin.from("product_images").insert({
    product_id: productId,
    url,
    alt_text: altText,
    sort_order: count ?? 0,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/shop");
}

export async function setPrimaryImage(formData: FormData) {
  await assertAdmin();
  const admin = createAdminClient();
  const imageId = String(formData.get("imageId") ?? "");
  const productId = String(formData.get("productId") ?? "");

  const { data: img } = await admin
    .from("product_images")
    .select("sort_order")
    .eq("id", imageId)
    .single();
  if (!img) throw new Error("Image not found");

  // Move to front by shifting others
  const { data: others } = await admin
    .from("product_images")
    .select("id, sort_order")
    .eq("product_id", productId)
    .order("sort_order");

  if (others) {
    let order = 1;
    for (const o of others) {
      if (o.id !== imageId) {
        await admin.from("product_images").update({ sort_order: order }).eq("id", o.id);
        order++;
      }
    }
    await admin.from("product_images").update({ sort_order: 0 }).eq("id", imageId);
  }

  revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/shop");
}

export async function deleteProductImage(formData: FormData) {
  await assertAdmin();
  const admin = createAdminClient();
  const imageId = String(formData.get("imageId") ?? "");
  const productId = String(formData.get("productId") ?? "");

  const { data: img } = await admin
    .from("product_images")
    .select("url")
    .eq("id", imageId)
    .single();

  const { error } = await admin.from("product_images").delete().eq("id", imageId);
  if (error) throw new Error(error.message);

  // Best-effort: remove the storage object if it's in our bucket
  if (img?.url.includes("/product-images/")) {
    const path = img.url.split("/product-images/")[1]?.split("?")[0];
    if (path) void admin.storage.from("product-images").remove([decodeURIComponent(path)]);
  }

  revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/shop");
}

// ---------------- Categories ----------------

export async function saveCategory(formData: FormData) {
  await assertAdmin();
  const admin = createAdminClient();
  const id = String(formData.get("id") ?? "") || null;
  const name = String(formData.get("name") ?? "").trim();
  const slugInput = String(formData.get("slug") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const sortOrder = Number(formData.get("sortOrder") ?? 0);
  const isActive = formData.get("isActive") === "on";

  if (name.length < 2) throw new Error("Category name is required");

  const values = {
    name,
    slug: slugInput ? slugify(slugInput) : slugify(name),
    description: description || null,
    sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
    is_active: isActive,
  };

  if (id) {
    const { error } = await admin.from("categories").update(values).eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await admin.from("categories").insert(values);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/admin/categories");
  revalidatePath("/shop");
}

export async function deleteCategory(formData: FormData) {
  await assertAdmin();
  const id = String(formData.get("id") ?? "");
  const admin = createAdminClient();
  const { error } = await admin.from("categories").delete().eq("id", id);
  if (error) {
    throw new Error("Category could not be deleted — it may still have products.");
  }
  revalidatePath("/admin/categories");
  revalidatePath("/shop");
}

// ---------------- Settings ----------------

export async function saveBankDetails(formData: FormData) {
  await assertAdmin();
  const admin = createAdminClient();
  const value = {
    bankName: String(formData.get("bankName") ?? "").trim(),
    accountNumber: String(formData.get("accountNumber") ?? "").trim(),
    accountName: String(formData.get("accountName") ?? "").trim(),
  };
  const { error } = await admin.from("site_settings").upsert({ key: "bank_details", value });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/settings");
  revalidatePath("/checkout");
}

export async function saveAboutStory(formData: FormData) {
  await assertAdmin();
  const admin = createAdminClient();
  const value = {
    heading: String(formData.get("heading") ?? "").trim().slice(0, 120),
    story: String(formData.get("story") ?? "").trim().slice(0, 2000),
  };
  const { error } = await admin.from("site_settings").upsert({ key: "about_story", value });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/settings");
  revalidatePath("/");
}

export async function saveContactSettings(formData: FormData) {
  await assertAdmin();
  const admin = createAdminClient();
  const value = {
    phone: String(formData.get("phone") ?? "").trim(),
    whatsapp: String(formData.get("whatsapp") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    address: String(formData.get("address") ?? "").trim(),
  };
  const { error } = await admin.from("site_settings").upsert({ key: "contact", value });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/settings");
}

export async function saveDeliverySettings(formData: FormData) {
  await assertAdmin();
  const admin = createAdminClient();
  const value = {
    defaultFee: Number(formData.get("defaultFee") ?? 0),
    pickupEnabled: formData.get("pickupEnabled") === "on",
    leadTimeHours: Number(formData.get("leadTimeHours") ?? 48),
  };
  const { error } = await admin.from("site_settings").upsert({ key: "delivery", value });
  if (error) throw new Error(error.message);

  // Also update the Default delivery zone
  if (Number.isFinite(value.defaultFee) && value.defaultFee >= 0) {
    await admin
      .from("delivery_settings")
      .update({ fee: value.defaultFee })
      .eq("zone_name", "Default");
  }

  revalidatePath("/admin/settings");
}

export async function savePaymentOptions(formData: FormData) {
  await assertAdmin();
  const admin = createAdminClient();
  const value = {
    paystack: formData.get("paystack") === "on",
    bank_transfer: formData.get("bank_transfer") === "on",
    cash: formData.get("cash") === "on",
  };
  const { error } = await admin.from("site_settings").upsert({ key: "payment_options", value });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/settings");
  revalidatePath("/checkout");
}

// ---------------- Reviews ----------------

export async function approveReview(formData: FormData) {
  await assertAdmin();
  const id = String(formData.get("id") ?? "");
  const approve = formData.get("approve") === "1";
  const admin = createAdminClient();
  const { error } = await admin.from("reviews").update({ is_approved: approve }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}
