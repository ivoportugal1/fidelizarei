import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createCustomerSession, readCustomerSession } from "@/lib/customer-session";
import { query } from "@/lib/database";
import { hashCpf, isValidCpf, normalizeCpf } from "@/lib/customer-cpf";
import { ensureLoyaltySchema } from "@/lib/loyalty-schema";
import { getCodeForEnrollment, redeemCode } from "@/lib/redemption";

// True when the QR was generated automatically by a PDV integration. Any failure
// (for example the integration tables not existing yet) means "regular QR".
async function isPdvCode(codeId: string) {
  try {
    const result = await query("select 1 from beefood_orders where redemption_code_id = $1 limit 1", [codeId]);
    return Boolean(result.rowCount);
  } catch { return false; }
}

export const runtime = "nodejs";

function errorResponse(message: string, status = 400) { return NextResponse.json({ ok: false, error: message }, { status }); }

export async function GET(_: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const record = await getCodeForEnrollment(code);
    if (!record) return errorResponse("invalid_code", 404);
    const pdv = await isPdvCode(record.id);
    return NextResponse.json({ ok: true, status: record.status, programId: record.program_id, programName: record.program_name, organizationName: record.organization_name, joinUrl: `/join/${record.program_id}`, joinWithCode: pdv });
  } catch { return errorResponse("service_unavailable", 503); }
}

// Adds the customer to the campaign of the QR (idempotent). Only customers of the same store.
async function enrollInCampaign(customerId: string, organizationId: string, programId: string) {
  const customer = await query("select 1 from customers where id = $1 and organization_id = $2 and status = 'active'", [customerId, organizationId]);
  if (!customer.rowCount) return false;
  await query(`insert into loyalty_balances (customer_id, program_id, points, rewards_available)
               values ($1, $2, 0, 0) on conflict (customer_id, program_id) do nothing`, [customerId, programId]);
  return true;
}

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    await ensureLoyaltySchema();
    const session = readCustomerSession((await cookies()).get("fideliza_customer")?.value);
    const { code } = await params;
    const identity = await request.json().catch(() => ({})) as { cpf?: string; enroll?: boolean };
    let customerId = session?.customerId;

    if (!customerId && identity.cpf?.trim()) {
      if (!isValidCpf(identity.cpf)) return errorResponse("invalid_cpf", 400);
      const codeRecord = await getCodeForEnrollment(code);
      if (!codeRecord) return errorResponse("invalid_code", 404);
      const cpfHash = hashCpf(normalizeCpf(identity.cpf));
      const customer = await query<{ id: string }>(`
        select c.id
        from customers c
        join loyalty_balances lb on lb.customer_id = c.id and lb.program_id = $2
        where c.organization_id = $1
          and c.cpf_hash = $3
          and c.status = 'active'
        limit 1`, [codeRecord.organization_id, codeRecord.program_id, cpfHash]);
      customerId = customer.rows[0]?.id;

      if (!customerId) {
        // The CPF may exist in this store but belong to another campaign.
        const inStore = await query<{ id: string }>(
          "select id from customers where organization_id = $1 and cpf_hash = $2 and status = 'active' limit 1",
          [codeRecord.organization_id, cpfHash],
        );
        if (!inStore.rows[0]) return errorResponse("cpf_not_found", 404);
        if (identity.enroll !== true) {
          return NextResponse.json({
            ok: false,
            error: "not_enrolled_in_campaign",
            programName: codeRecord.program_name,
            joinUrl: `/join/${codeRecord.program_id}`,
          }, { status: 403 });
        }
        customerId = inStore.rows[0].id;
      }
    }

    if (!customerId) return errorResponse("identity_required", 401);

    if (identity.enroll === true) {
      const codeRecord = await getCodeForEnrollment(code);
      if (codeRecord && codeRecord.status === "active") await enrollInCampaign(customerId, codeRecord.organization_id, codeRecord.program_id);
    }
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
    const known = ["cpf_not_found", "invalid_code", "code_already_used", "code_expired", "code_belongs_to_another_customer", "program_not_active", "customer_not_enrolled"];
    return errorResponse(known.includes(message) ? message : "unable_to_redeem", message === "customer_not_enrolled" ? 403 : known.includes(message) ? 409 : 500);
  }
}
