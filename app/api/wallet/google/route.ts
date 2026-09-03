import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { readCustomerSession } from "@/lib/customer-session";
import { createGoogleWalletSaveLink } from "@/lib/google-wallet";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = readCustomerSession((await cookies()).get("fideliza_customer")?.value);
    if (!session) return NextResponse.json({ ok: false, error: "identity_required" }, { status: 401 });
    const url = await createGoogleWalletSaveLink(session.customerId, new URL(request.url).origin);
    return NextResponse.json({ ok: true, url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "wallet_unavailable";
    const status = message === "google_wallet_not_configured" ? 503 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
