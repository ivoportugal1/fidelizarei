import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const configured = Boolean(
    process.env.APPLE_PASS_TYPE_IDENTIFIER &&
    process.env.APPLE_TEAM_IDENTIFIER &&
    process.env.APPLE_PASS_CERTIFICATE_BASE64,
  );

  if (!configured) {
    return NextResponse.json({
      ok: false,
      error: "apple_wallet_not_configured",
      message: "Apple Wallet requires an Apple Developer Pass Type ID and signing certificate before .pkpass files can be generated.",
    }, { status: 503 });
  }

  return NextResponse.json({
    ok: false,
    error: "apple_wallet_builder_pending",
    message: "Apple credentials are configured, but the .pkpass signing builder still needs to be enabled.",
  }, { status: 501 });
}
