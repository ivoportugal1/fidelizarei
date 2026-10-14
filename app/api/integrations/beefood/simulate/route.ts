import { NextResponse } from "next/server";
import { getBeefoodContext } from "@/lib/integrations/beefood/admin";
import { issuePointQr } from "@/lib/integrations/beefood/process-event";

export const runtime = "nodejs";

// Lets the lojista see the whole counter flow without BeeFood: it issues the same
// one-point QR a paid in-store sale would, labelled SIM-* so it is easy to spot.
export async function POST() {
  const context = await getBeefoodContext();
  if (!context) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  const { integration } = context;
  if (!integration.enabled) return NextResponse.json({ ok: false, error: "integration_disabled" }, { status: 409 });
  const orderId = `SIM-${Date.now()}`;
  const created = await issuePointQr(integration, orderId, Number(integration.min_amount));
  return NextResponse.json({ ok: created, orderId });
}
