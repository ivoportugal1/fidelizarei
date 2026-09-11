import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  await request.json().catch(() => ({}));
  return NextResponse.json({ ok: false, error: "mercadopago_disabled" }, { status: 410 });
}
