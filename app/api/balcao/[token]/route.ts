import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { getCounterState } from "@/lib/integrations/beefood/counter";
import { publicAppUrl } from "@/lib/public-url";
import { publicCodeUrl } from "@/lib/qr-batches";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const state = await getCounterState(token);
    if (!state) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    if (state.state !== "qr") return NextResponse.json({ ok: true, ...state }, { headers: { "Cache-Control": "no-store" } });
    const url = publicCodeUrl(publicAppUrl(new URL(request.url).origin), state.code);
    const qr = await QRCode.toDataURL(url, { margin: 1, width: 420, errorCorrectionLevel: "M" });
    return NextResponse.json(
      { ok: true, state: "qr", storeName: state.storeName, expiresAt: state.expiresAt, qr },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ ok: false, error: "service_unavailable" }, { status: 503 });
  }
}
