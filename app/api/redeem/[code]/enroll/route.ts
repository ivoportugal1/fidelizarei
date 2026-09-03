import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createCustomerSession } from "@/lib/customer-session";
import { getCodeForEnrollment, redeemCode } from "@/lib/redemption";
import { query } from "@/lib/database";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const body = await request.json() as { name?: string; phone?: string; email?: string };
    const phone = body.phone?.trim();
    if (!phone || phone.length < 8) return NextResponse.json({ ok: false, error: "invalid_phone" }, { status: 400 });
    const { code } = await params;
    const codeRecord = await getCodeForEnrollment(code);
    if (!codeRecord || codeRecord.status !== "active") return NextResponse.json({ ok: false, error: "invalid_or_used_code" }, { status: 409 });

    // In production, normalize this number to E.164 using a verified SMS/WhatsApp flow.
    const customerResult = await query<{ id: string }>(`
      insert into customers (organization_id, phone_e164, full_name) values ($1, $2, $3)
      on conflict (organization_id, phone_e164) do update set full_name = coalesce(excluded.full_name, customers.full_name)
      returning id`, [codeRecord.organization_id, phone, body.name?.trim() || null]);
    const customer = customerResult.rows[0];
    if (!customer) throw new Error("customer_creation_failed");
    const result = await redeemCode(code, customer.id);
    const response = NextResponse.json({ ok: true, enrolled: true, ...result });
    response.cookies.set("fideliza_customer", createCustomerSession(customer.id), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 180 });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "unable_to_enroll";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
