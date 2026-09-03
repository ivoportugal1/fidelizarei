import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query, transaction } from "@/lib/database";
import { hashCode } from "@/lib/redemption";

export const runtime = "nodejs";

type ProgramRow = {
  organization_id: string;
  program_id: string;
  points_per_code: number;
};

function makeCode() {
  const raw = randomBytes(8).toString("base64url").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
  return `FID-${raw.slice(0, 5)}-${raw.slice(5)}`;
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({})) as { quantity?: number; expiresInDays?: number | null };
  const quantity = Math.max(1, Math.min(Number(body.quantity || 25), 500));
  const expiresInDays = body.expiresInDays ? Math.max(1, Math.min(Number(body.expiresInDays), 365)) : null;

  const context = await query<ProgramRow>(`
    select o.id as organization_id, p.id as program_id, p.points_per_code
    from organization_members m
    join organizations o on o.id = m.organization_id
    join loyalty_programs p on p.organization_id = o.id
    where m.user_id = $1 and p.active = true
    order by o.created_at asc, p.created_at asc
    limit 1`, [user.id]);
  const program = context.rows[0];
  if (!program) return NextResponse.json({ ok: false, error: "program_not_found" }, { status: 404 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const codes = await transaction(async (client) => {
    const created: Array<{ code: string; url: string }> = [];
    while (created.length < quantity) {
      const code = makeCode();
      const result = await client.query<{ id: string }>(`
        insert into redemption_codes (organization_id, program_id, code_hash, points, expires_at)
        values ($1, $2, $3, $4, case when $5::int is null then null else now() + ($5::int * interval '1 day') end)
        on conflict (code_hash) do nothing
        returning id`, [program.organization_id, program.program_id, hashCode(code), program.points_per_code, expiresInDays]);
      if (result.rowCount) created.push({ code, url: `${appUrl}/r/${code}` });
    }
    return created;
  });

  return NextResponse.json({ ok: true, codes });
}
