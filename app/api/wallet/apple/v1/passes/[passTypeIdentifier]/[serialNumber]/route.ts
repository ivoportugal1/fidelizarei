import { NextResponse } from "next/server";
import { createAppleWalletPass, validateApplePassAuth } from "@/lib/apple-wallet";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ passTypeIdentifier: string; serialNumber: string }> }) {
  const { passTypeIdentifier, serialNumber } = await params;
  if (passTypeIdentifier !== process.env.APPLE_PASS_TYPE_IDENTIFIER) {
    return NextResponse.json({ error: "pass_type_not_found" }, { status: 404 });
  }

  const customerId = await validateApplePassAuth(serialNumber, request.headers.get("authorization"));
  if (!customerId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const pass = await createAppleWalletPass(customerId, new URL(request.url).origin, serialNumber);
    return new NextResponse(new Uint8Array(pass.buffer), {
      headers: {
        "Content-Type": "application/vnd.apple.pkpass",
        "Content-Disposition": `attachment; filename="${pass.filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "apple_wallet_unavailable";
    console.error("apple_wallet_update_error", message);
    return NextResponse.json({ error: message }, { status: message === "pass_not_found" ? 404 : 500 });
  }
}
