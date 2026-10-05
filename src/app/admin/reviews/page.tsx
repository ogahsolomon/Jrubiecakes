import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateTime } from "@/lib/utils";
import { approveReview } from "@/lib/admin-actions";

export const dynamic = "force-dynamic";

export default async function AdminReviewsPage() {
  const admin = createAdminClient();
  const { data: reviews } = await admin
    .from("reviews")
    .select("id, customer_name, rating, comment, is_approved, created_at, product:products(name, slug)")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-cocoa-900">Reviews</h1>
      <p className="mt-1 text-sm text-cocoa-500">Moderate customer reviews and testimonials</p>

      <div className="card table-scroll mt-5">
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead className="border-b border-cocoa-100 text-xs uppercase tracking-wide text-cocoa-400">
            <tr>
              <th className="px-4 py-3 font-medium">Reviewer</th>
              <th className="px-4 py-3 font-medium">Product</th>
              <th className="px-4 py-3 font-medium">Rating</th>
              <th className="px-4 py-3 font-medium">Comment</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(!reviews || reviews.length === 0) && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-cocoa-400">
                  No reviews yet.
                </td>
              </tr>
            )}
            {(reviews ?? []).map((review) => (
              <tr key={review.id} className="border-b border-cocoa-50 last:border-0 align-top">
                <td className="px-4 py-3 font-medium text-cocoa-900">{review.customer_name}</td>
                <td className="px-4 py-3 text-cocoa-700">
                  {review.product?.name ?? "—"}
                  {review.product?.slug && (
                    <div className="text-xs text-cocoa-400">/{review.product.slug}</div>
                  )}
                </td>
                <td className="px-4 py-3 text-cocoa-700">{review.rating} ★</td>
                <td className="max-w-md px-4 py-3 text-cocoa-700">
                  {review.comment ? (
                    <p className="whitespace-pre-wrap leading-snug">{review.comment}</p>
                  ) : (
                    <span className="italic text-cocoa-400">No comment</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`badge ${
                      review.is_approved ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {review.is_approved ? "Approved" : "Pending"}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-cocoa-500">{formatDateTime(review.created_at)}</td>
                <td className="px-4 py-3 text-right">
                  <form action={approveReview} className="inline-flex gap-2">
                    <input type="hidden" name="id" value={review.id} />
                    {review.is_approved ? (
                      <>
                        <input type="hidden" name="approve" value="0" />
                        <button type="submit" className="btn-outline !px-2.5 !py-1.5 !text-xs">
                          Unapprove
                        </button>
                      </>
                    ) : (
                      <>
                        <input type="hidden" name="approve" value="1" />
                        <button type="submit" className="btn-primary !px-2.5 !py-1.5 !text-xs">
                          Approve
                        </button>
                      </>
                    )}
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}