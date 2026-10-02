import { NextResponse, type NextRequest } from "next/server";
import { contactSchema } from "@/lib/validation";
import { sendEmail, escapeHtml } from "@/lib/mailgun";
import { layout } from "@/lib/email-templates";
import { SITE } from "@/lib/constants";

export async function POST(request: NextRequest) {
  let parsed;
  try {
    parsed = contactSchema.safeParse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid details" },
      { status: 400 }
    );
  }

  const { name, email, message } = parsed.data;

  const html = layout(
    "New contact message",
    `<p style="color:#452A1D;"><strong>${escapeHtml(name)}</strong> (${escapeHtml(email)}) wrote:</p>
     <p style="color:#452A1D;line-height:1.6;white-space:pre-line;">${escapeHtml(message)}</p>`
  );

  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    // No admin configured — accept silently but log
    console.warn("[contact] ADMIN_EMAIL not set; dropping message from", email);
    return NextResponse.json({ ok: true });
  }

  const result = await sendEmail({
    to: adminEmail,
    subject: `New message from ${name} — ${SITE.name}`,
    html,
    text: message,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: "Could not send your message right now. Please call or WhatsApp us instead." },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
