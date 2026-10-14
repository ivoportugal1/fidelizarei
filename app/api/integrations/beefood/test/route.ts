import { NextResponse } from "next/server";
import { testConnection } from "@/lib/integrations/beefood/client";
import { getBeefoodContext } from "@/lib/integrations/beefood/admin";

export const runtime = "nodejs";

export async function POST() {
  const context = await getBeefoodContext();
  if (!context) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  const { integration } = context;
  if (!integration.client_id || !integration.client_secret_enc) {
    return NextResponse.json({ ok: false, error: "credentials_missing" }, { status: 400 });
  }
  try {
    const connected = await testConnection(integration);
    return NextResponse.json({ ok: connected });
  } catch {
    return NextResponse.json({ ok: false, error: "connection_failed" }, { status: 502 });
  }
}
