import { NextResponse } from "next/server";
import { getSiteSetting } from "@/lib/catalog";

export async function GET() {
  const options = await getSiteSetting("payment_options", {
    paystack: true,
    bank_transfer: true,
    cash: true,
  });
  return NextResponse.json(options);
}
