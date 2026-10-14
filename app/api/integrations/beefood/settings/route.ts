import { NextResponse } from "next/server";
import { query } from "@/lib/database";
import { getBeefoodContext } from "@/lib/integrations/beefood/admin";
import { encryptSecret } from "@/lib/integrations/beefood/crypto";

export const runtime = "nodejs";

function fail(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function PUT(request: Request) {
  const context = await getBeefoodContext();
  if (!context) return fail("not_found", 404);

  const body = await request.json().catch(() => null) as {
    clientId?: unknown; clientSecret?: unknown; minAmount?: unknown; enabled?: unknown;
  } | null;
  if (!body) return fail("invalid_body");

  const sets: string[] = [];
  const values: unknown[] = [];
  const add = (column: string, value: unknown) => { values.push(value); sets.push(`${column} = $${values.length}`); };

  if (body.clientId !== undefined) {
    if (typeof body.clientId !== "string" || body.clientId.length > 200) return fail("invalid_client_id");
    add("client_id", body.clientId.trim() || null);
  }
  if (body.clientSecret !== undefined && body.clientSecret !== "") {
    if (typeof body.clientSecret !== "string" || body.clientSecret.length > 500) return fail("invalid_client_secret");
    try {
      add("client_secret_enc", encryptSecret(body.clientSecret.trim()));
    } catch {
      return fail("encryption_not_configured", 500);
    }
  }
  if (body.minAmount !== undefined) {
    const amount = Number(body.minAmount);
    if (!Number.isFinite(amount) || amount < 0 || amount > 100000) return fail("invalid_min_amount");
    add("min_amount", Math.round(amount * 100) / 100);
  }
  if (body.enabled !== undefined) {
    if (typeof body.enabled !== "boolean") return fail("invalid_enabled");
    add("enabled", body.enabled);
  }
  if (!sets.length) return fail("nothing_to_update");

  values.push(context.integration.id);
  await query(`update beefood_integrations set ${sets.join(", ")}, updated_at = now() where id = $${values.length}`, values);
  return NextResponse.json({ ok: true });
}
