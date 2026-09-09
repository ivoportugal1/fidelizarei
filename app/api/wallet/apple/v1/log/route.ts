import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { logs?: string[] };
  if (body.logs?.length) console.warn("apple_wallet_client_logs", body.logs.join("\n"));
  return new NextResponse(null, { status: 200 });
}
