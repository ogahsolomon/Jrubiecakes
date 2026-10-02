import { NextResponse } from "next/server";
import { getSiteSetting, type BankDetails } from "@/lib/catalog";

export async function GET() {
  const details = await getSiteSetting<BankDetails>("bank_details", {
    bankName: "",
    accountNumber: "",
    accountName: "",
  });
  return NextResponse.json(details);
}
