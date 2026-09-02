import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { readCustomerSession } from "@/lib/customer-session";
import { getCodeForEnrollment, redeemCode } from "@/lib/redemption";

export const runtime = "nodejs";

function errorResponse(message: string, status = 400) { return NextResponse.json({ ok: false, error: message }, { status }); }

export async function GET(_: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const record = await getCodeForEnrollment(code);
    if (!record) return errorResponse("invalid_code", 404);
    const program = record.loyalty_programs as unknown as { name: string; organizations: { name: string } | null } | null;
    return NextResponse.json({ ok: true, status: record.status, programName: program?.name, organizationName: program?.organizations?.name });
  } catch { return errorResponse("service_unavailable", 503); }
}

export async function POST(_: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const session = readCustomerSession((await cookies()).get("fideliza_customer")?.value);
    if (!session) return errorResponse("identity_required", 401);
    const { code } = await params;
    const result = await redeemCode(code, session.customerId);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unable_to_redeem";
    const known = ["invalid_code", "code_already_used", "code_expired", "code_belongs_to_another_customer", "program_not_active"];
    return errorResponse(known.includes(message) ? message : "unable_to_redeem", known.includes(message) ? 409 : 500);
  }
}
