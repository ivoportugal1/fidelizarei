import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { transaction } from "@/lib/database";
import { hashCode } from "@/lib/redemption";
import {
  getUserProgramContext,
  makePointCode,
  MAX_POINT_QR_BATCH,
  MIN_POINT_QR_BATCH,
  normalizeBatchQuantity,
  publicCodeUrl,
} from "@/lib/qr-batches";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({})) as { quantity?: number; expiresInDays?: number | null };
  let quantity: number;
  try {
    quantity = normalizeBatchQuantity(body.quantity ?? 25);
  } catch {
    return NextResponse.json({
      ok: false,
      error: "invalid_quantity",
      message: `Informe uma quantidade entre ${MIN_POINT_QR_BATCH} e ${MAX_POINT_QR_BATCH}.`,
    }, { status: 400 });
  }

  const expiresInDays = body.expiresInDays ? Math.max(1, Math.min(Number(body.expiresInDays), 365)) : null;
  const program = await getUserProgramContext(user.id);
  if (!program) return NextResponse.json({ ok: false, error: "program_not_found" }, { status: 404 });

  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const result = await transaction(async (client) => {
    const batch = await client.query<{ id: string; created_at: Date }>(`
      insert into qr_code_batches (organization_id, program_id, quantity, created_by_user_id)
      values ($1, $2, $3, $4)
      returning id, created_at`, [program.organization_id, program.program_id, quantity, user.id]);

    const batchId = batch.rows[0].id;
    const created: Array<{ id: string; code: string; url: string; status: "active"; createdAt: string; redeemedAt: null }> = [];
    while (created.length < quantity) {
      const code = makePointCode();
      const inserted = await client.query<{ id: string; created_at: Date }>(`
        insert into redemption_codes (organization_id, program_id, batch_id, code_value, code_hash, points, expires_at)
        values ($1, $2, $3, $4, $5, $6, case when $7::int is null then null else now() + ($7::int * interval '1 day') end)
        on conflict (code_hash) do nothing
        returning id, created_at`, [program.organization_id, program.program_id, batchId, code, hashCode(code), program.points_per_code, expiresInDays]);
      if (inserted.rowCount) {
        created.push({
          id: inserted.rows[0].id,
          code,
          url: publicCodeUrl(origin, code),
          status: "active",
          createdAt: inserted.rows[0].created_at.toISOString(),
          redeemedAt: null,
        });
      }
    }
    return {
      batch: {
        id: batchId,
        quantity,
        active: quantity,
        redeemed: 0,
        createdAt: batch.rows[0].created_at.toISOString(),
      },
      codes: created,
    };
  });

  return NextResponse.json({ ok: true, ...result });
}
