import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createCustomerSession, readCustomerSession } from "@/lib/customer-session";
import { query, transaction } from "@/lib/database";

export const runtime = "nodejs";

type ProgramRow = {
  organization_id: string;
  organization_name: string;
  program_id: string;
  program_name: string;
};

async function getProgram(programId: string) {
  const result = await query<ProgramRow>(`
    select o.id as organization_id, o.name as organization_name,
           p.id as program_id, p.name as program_name
    from loyalty_programs p
    join organizations o on o.id = p.organization_id
    where p.id = $1 and p.active = true
    limit 1`, [programId]);
  return result.rows[0] ?? null;
}

export async function GET(_: Request, { params }: { params: Promise<{ programId: string }> }) {
  const { programId } = await params;
  const program = await getProgram(programId);
  if (!program) return NextResponse.json({ ok: false, error: "program_not_found" }, { status: 404 });

  const session = readCustomerSession((await cookies()).get("fideliza_customer")?.value);
  let alreadyJoined = false;
  if (session) {
    const existing = await query<{ id: string }>(
      "select id from customers where id = $1 and organization_id = $2 and status = 'active' limit 1",
      [session.customerId, program.organization_id],
    );
    alreadyJoined = Boolean(existing.rows[0]);
  }

  return NextResponse.json({
    ok: true,
    organizationName: program.organization_name,
    programName: program.program_name,
    alreadyJoined,
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ programId: string }> }) {
  const { programId } = await params;
  const program = await getProgram(programId);
  if (!program) return NextResponse.json({ ok: false, error: "program_not_found" }, { status: 404 });

  const body = await request.json().catch(() => ({})) as { firstName?: string; lastName?: string; phone?: string };
  const firstName = body.firstName?.trim();
  const lastName = body.lastName?.trim();
  const phone = body.phone?.trim();
  if (!firstName || !lastName) return NextResponse.json({ ok: false, error: "invalid_name" }, { status: 400 });
  if (!phone || phone.length < 8) return NextResponse.json({ ok: false, error: "invalid_phone" }, { status: 400 });

  const customer = await transaction(async (client) => {
    const customerResult = await client.query<{ id: string }>(`
      insert into customers (organization_id, phone_e164, first_name, last_name, full_name, status, deactivated_at)
      values ($1, $2, $3, $4, $5, 'active', null)
      on conflict (organization_id, phone_e164) do update set
        first_name = excluded.first_name,
        last_name = excluded.last_name,
        full_name = excluded.full_name,
        status = 'active',
        deactivated_at = null
      returning id`, [program.organization_id, phone, firstName, lastName, `${firstName} ${lastName}`]);
    const row = customerResult.rows[0];
    await client.query(`
      insert into loyalty_balances (customer_id, program_id, points, rewards_available)
      values ($1, $2, 0, 0)
      on conflict (customer_id, program_id) do nothing`, [row.id, program.program_id]);
    return row;
  });

  const response = NextResponse.json({ ok: true, enrolled: true });
  response.cookies.set("fideliza_customer", createCustomerSession(customer.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });
  return response;
}
