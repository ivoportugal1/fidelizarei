import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/database";
import { hashCpf, isValidCpf } from "@/lib/customer-cpf";
import { ensureLoyaltySchema } from "@/lib/loyalty-schema";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const cpf = new URL(request.url).searchParams.get("cpf") || "";
  if (!isValidCpf(cpf)) return NextResponse.json({ ok: false, error: "invalid_cpf" }, { status: 400 });
  await ensureLoyaltySchema();
  const result = await query<{ id: string; full_name: string | null; phone_e164: string | null; status: "active" | "inactive"; created_at: Date }>(`
    select c.id, c.full_name, c.phone_e164, c.status, c.created_at
    from customers c
    join organization_members m on m.organization_id = c.organization_id
    where m.user_id = $1 and c.cpf_hash = $2
    limit 1`, [user.id, hashCpf(cpf)]);
  const customer = result.rows[0];
  return NextResponse.json({ ok: true, customer: customer ? { id: customer.id, name: customer.full_name || "Cliente", phone: customer.phone_e164, status: customer.status, createdAt: customer.created_at.toISOString() } : null });
}
