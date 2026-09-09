import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createAppleWalletPass } from "@/lib/apple-wallet";
import { readCustomerSession } from "@/lib/customer-session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const session = readCustomerSession((await cookies()).get("fideliza_customer")?.value);
    if (!session) {
      return NextResponse.json({ ok: false, error: "identity_required" }, { status: 401 });
    }

    const pass = await createAppleWalletPass(session.customerId, new URL(request.url).origin);
    return new NextResponse(new Uint8Array(pass.buffer), {
      headers: {
        "Content-Type": "application/vnd.apple.pkpass",
        "Content-Disposition": `attachment; filename="${pass.filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "apple_wallet_unavailable";
    console.error("apple_wallet_error", message);
    const status = message === "apple_wallet_not_configured" ? 503 : message === "identity_required" ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
