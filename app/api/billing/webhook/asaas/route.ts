import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json({ ok: false, error: "asaas_disabled_use_stripe" }, { status: 410 });
}
