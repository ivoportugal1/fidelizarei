import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createCustomerSession, readCustomerSession } from "@/lib/customer-session";
import { query } from "@/lib/database";
import { getCodeForEnrollment, redeemCode } from "@/lib/redemption";

export const runtime = "nodejs";

function errorResponse(message: string, status = 400) { return NextResponse.json({ ok: false, error: message }, { status }); }

export async function GET(_: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const record = await getCodeForEnrollment(code);
    if (!record) return errorResponse("invalid_code", 404);
    return NextResponse.json({ ok: true, status: record.status, programId: record.program_id, programName: record.program_name, organizationName: record.organization_name, joinUrl: `/join/${record.program_id}` });
  } catch { return errorResponse("service_unavailable", 503); }
}

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const session = readCustomerSession((await cookies()).get("fideliza_customer")?.value);
    const { code } = await params;
    const identity = await request.json().catch(() => ({})) as { fullName?: string; phone?: string };
    let customerId = session?.customerId;

    if (!customerId && identity.fullName?.trim() && identity.phone?.trim()) {
      const codeRecord = await getCodeForEnrollment(code);
      if (!codeRecord) return errorResponse("invalid_code", 404);
      const digits = identity.phone.replace(/\D/g, "");
      const customer = await query<{ id: string }>(`
        select c.id
        from customers c
        join loyalty_balances lb on lb.customer_id = c.id and lb.program_id = $2
        where c.organization_id = $1
          and lower(c.full_name) = lower($3)
          and regexp_replace(c.phone_e164, '\\D', '', 'g') = $4
          and c.status = 'active'
        limit 1`, [codeRecord.organization_id, codeRecord.program_id, identity.fullName.trim(), digits]);
      customerId = customer.rows[0]?.id;
    }

    if (!customerId) return errorResponse("identity_required", 401);
    const result = await redeemCode(code, customerId);
    const response = NextResponse.json({ ok: true, ...result });
    if (!session) {
      response.cookies.set("fideliza_customer", createCustomerSession(customerId), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 180,
      });
    }
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "unable_to_redeem";
    const known = ["invalid_code", "code_already_used", "code_expired", "code_belongs_to_another_customer", "program_not_active", "customer_not_enrolled"];
    return errorResponse(known.includes(message) ? message : "unable_to_redeem", message === "customer_not_enrolled" ? 403 : known.includes(message) ? 409 : 500);
  }
}
