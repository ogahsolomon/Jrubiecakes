"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";
import { verifyUploadImage } from "@/lib/uploads";
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertUuid(value: string, label: string): string {
  if (!UUID_RE.test(value)) throw new Error(`Invalid ${label}`);
  return value;
}

function assertSafeProductImageUrl(url: string): string {
  if (url.length === 0 || url.length > 1000) {
    throw new Error("Image URL must be between 1 and 1000 characters");
  }
  if (/[<>"\s]/.test(url)) {
    throw new Error("Image URL contains invalid characters");
  }
  if (url.startsWith("/")) {
    if (!/^\/[A-Za-z0-9._~:/?#[\]@!$&'()*+,;=%-]+$/.test(url)) {
      throw new Error("Local image URL is invalid");
    }
    return url;
  }
  if (!/^https:\/\/[^/]+(\/\S*)?$/i.test(url)) {
    throw new Error("Image URL must use HTTPS");
  }
  return url;
}

// ---------------- Orders ----------------

export async function updateOrderStatus(formData: FormData) {
  await assertAdmin();
  const orderId = assertUuid(String(formData.get("orderId") ?? ""), "order");
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
  const paymentId = assertUuid(String(formData.get("paymentId") ?? ""), "payment");
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

  const idRaw = String(formData.get("id") ?? "");
  const id = idRaw ? assertUuid(idRaw, "product") : null;
  const name = String(formData.get("name") ?? "").trim();
  const categoryId = assertUuid(String(formData.get("categoryId") ?? ""), "category");
  const slugInput = String(formData.get("slug") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const price = Number(formData.get("price"));
  const salePriceRaw = String(formData.get("salePrice") ?? "").trim();
  const salePrice = salePriceRaw ? Number(salePriceRaw) : null;
  const isAvailable = formData.get("isAvailable") === "on";
  const isFeatured = formData.get("isFeatured") === "on";
  const isCustomizable = formData.get("isCustomizable") === "on";
  const stockRaw = String(formData.get("stockQuantity") ?? "").trim();
  const prepTimeRaw = String(formData.get("prepTimeHours") ?? "").trim();
  const stockQuantity = stockRaw ? Number(stockRaw) : null;
  const prepTimeHours = prepTimeRaw ? Number(prepTimeRaw) : null;
  const minQty = Number(formData.get("minOrderQuantity") ?? 1);

  if (name.length < 2 || name.length > 200) throw new Error("Product name must be 2–200 characters");
  if (description.length > 5000) throw new Error("Product description is too long");
  if (!Number.isFinite(price) || price < 0 || price > 9999999999.99) {
    throw new Error("Price must be a positive number");
  }
  if (salePrice !== null && (!Number.isFinite(salePrice) || salePrice < 0 || salePrice > price)) {
    throw new Error("Sale price must be zero or more, and cannot exceed the price");
  }
  if (stockQuantity !== null && (!Number.isInteger(stockQuantity) || stockQuantity < 0 || stockQuantity > 1000000)) {
    throw new Error("Stock quantity must be a whole number");
  }
  if (prepTimeHours !== null && (!Number.isInteger(prepTimeHours) || prepTimeHours < 0 || prepTimeHours > 8760)) {
    throw new Error("Preparation time must be a whole number of hours");
  }

  const values = {
    name,
    slug: (slugInput ? slugify(slugInput) : slugify(name)).slice(0, 200),
    category_id: categoryId,
    description: description || null,
    price,
    sale_price: salePrice,
    is_available: isAvailable,
    is_featured: isFeatured,
    is_customizable: isCustomizable,
    stock_quantity: stockQuantity,
    prep_time_hours: prepTimeHours,
    min_order_quantity: Number.isInteger(minQty) && minQty >= 1 && minQty <= 99 ? minQty : 1,
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
  const id = assertUuid(String(formData.get("id") ?? ""), "product");
  const archive = formData.get("archive") === "1";
  const admin = createAdminClient();
  const { error } = await admin.from("products").update({ is_available: !archive }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/products");
  revalidatePath("/shop");
}

export async function deleteProduct(formData: FormData) {
  await assertAdmin();
  const id = assertUuid(String(formData.get("id") ?? ""), "product");
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

  const productId = assertUuid(String(formData.get("productId") ?? ""), "product");
  const optionIdRaw = String(formData.get("optionId") ?? "");
  const optionId = optionIdRaw ? assertUuid(optionIdRaw, "option") : null;
  const name = String(formData.get("name") ?? "").trim();
  const typeInput = String(formData.get("type") ?? "select");
  const isRequired = formData.get("isRequired") === "on";
  const valuesRaw = String(formData.get("values") ?? "").trim();

  if (!["select", "text", "multiline", "date", "file"].includes(typeInput)) {
    throw new Error("Invalid option type");
  }
  const type = typeInput as Database["public"]["Tables"]["product_options"]["Insert"]["type"];
  if (name.length < 1 || name.length > 100) throw new Error("Option name must be 1–100 characters");

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
      .slice(0, 50)
      .map((line, i) => {
        const [value, delta] = line.split(":");
        const label = value.trim();
        const priceDelta = delta ? Number(delta) : 0;
        if (label.length < 1 || label.length > 100) throw new Error("Option values must be 1–100 characters");
        if (!Number.isFinite(priceDelta) || priceDelta < 0 || priceDelta > 9999999999.99) {
          throw new Error("Option price adjustments must be zero or more");
        }
        return {
          option_id: id!,
          value: label,
          price_delta: priceDelta,
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
  const optionId = assertUuid(String(formData.get("optionId") ?? ""), "option");
  const productId = assertUuid(String(formData.get("productId") ?? ""), "product");
  const admin = createAdminClient();
  const { error } = await admin.from("product_options").delete().eq("id", optionId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/products/${productId}`);
}

// ---------------- Product images ----------------

export async function addProductImage(formData: FormData) {
  await assertAdmin();
  const admin = createAdminClient();
  const productId = assertUuid(String(formData.get("productId") ?? ""), "product");
  const file = formData.get("file") as File | null;
  const urlInput = String(formData.get("url") ?? "").trim();
  const altText = String(formData.get("altText") ?? "").trim().slice(0, 200) || null;

  let url = urlInput ? assertSafeProductImageUrl(urlInput) : "";

  if (file && file.size > 0) {
    const image = await verifyUploadImage(file);
    const path = `${productId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${image.extension}`;

    const { error: uploadError } = await admin.storage
      .from("product-images")
      .upload(path, image.bytes, { contentType: image.contentType, upsert: false });

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
  const imageId = assertUuid(String(formData.get("imageId") ?? ""), "image");
  const productId = assertUuid(String(formData.get("productId") ?? ""), "product");

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
  const imageId = assertUuid(String(formData.get("imageId") ?? ""), "image");
  const productId = assertUuid(String(formData.get("productId") ?? ""), "product");

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
  const idRaw = String(formData.get("id") ?? "");
  const id = idRaw ? assertUuid(idRaw, "category") : null;
  const name = String(formData.get("name") ?? "").trim();
  const slugInput = String(formData.get("slug") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const sortOrder = Number(formData.get("sortOrder") ?? 0);
  const isActive = formData.get("isActive") === "on";

  if (name.length < 2 || name.length > 100) throw new Error("Category name must be 2–100 characters");
  if (description.length > 1000) throw new Error("Category description is too long");

  const values = {
    name,
    slug: (slugInput ? slugify(slugInput) : slugify(name)).slice(0, 100),
    description: description || null,
    sort_order: Number.isInteger(sortOrder) && sortOrder >= -1000 && sortOrder <= 1000 ? sortOrder : 0,
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
  const id = assertUuid(String(formData.get("id") ?? ""), "category");
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
    bankName: String(formData.get("bankName") ?? "").trim().slice(0, 100),
    accountNumber: String(formData.get("accountNumber") ?? "").trim().slice(0, 50),
    accountName: String(formData.get("accountName") ?? "").trim().slice(0, 100),
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
  const email = String(formData.get("email") ?? "").trim();
  if (email && !/^\S+@\S+\.\S+$/.test(email)) throw new Error("Contact email is invalid");
  const value = {
    phone: String(formData.get("phone") ?? "").trim().slice(0, 50),
    whatsapp: String(formData.get("whatsapp") ?? "").trim().slice(0, 50),
    email: email.slice(0, 200),
    address: String(formData.get("address") ?? "").trim().slice(0, 500),
  };
  const { error } = await admin.from("site_settings").upsert({ key: "contact", value });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/settings");
}

export async function saveDeliverySettings(formData: FormData) {
  await assertAdmin();
  const admin = createAdminClient();
  const defaultFee = Number(formData.get("defaultFee") ?? 0);
  const leadTimeHours = Number(formData.get("leadTimeHours") ?? 48);
  if (!Number.isFinite(defaultFee) || defaultFee < 0 || defaultFee > 1000000) {
    throw new Error("Default delivery fee must be zero or more");
  }
  if (!Number.isInteger(leadTimeHours) || leadTimeHours < 0 || leadTimeHours > 720) {
    throw new Error("Lead time must be a whole number of hours");
  }
  const value = {
    defaultFee,
    pickupEnabled: formData.get("pickupEnabled") === "on",
    leadTimeHours,
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
  const id = assertUuid(String(formData.get("id") ?? ""), "review");
  const approve = formData.get("approve") === "1";
  const admin = createAdminClient();
  const { error } = await admin.from("reviews").update({ is_approved: approve }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}
