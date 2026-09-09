import { NextResponse } from "next/server";
import { query } from "@/lib/database";
import { validateApplePassAuth } from "@/lib/apple-wallet";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ deviceLibraryIdentifier: string; passTypeIdentifier: string; serialNumber: string }> }) {
  const { deviceLibraryIdentifier, passTypeIdentifier, serialNumber } = await params;
  if (passTypeIdentifier !== process.env.APPLE_PASS_TYPE_IDENTIFIER) {
    return NextResponse.json({ error: "pass_type_not_found" }, { status: 404 });
  }

  const customerId = await validateApplePassAuth(serialNumber, request.headers.get("authorization"));
  if (!customerId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({})) as { pushToken?: string };
  if (!body.pushToken) return NextResponse.json({ error: "push_token_required" }, { status: 400 });

  const existing = await query<{ device_library_identifier: string | null }>(
    "select device_library_identifier from wallet_passes where platform = 'apple' and serial_number = $1 limit 1",
    [serialNumber],
  );
  const wasRegistered = Boolean(existing.rows[0]?.device_library_identifier);

  await query(`
    update wallet_passes
    set device_library_identifier = $1,
        push_token = $2,
        updated_at = now()
    where platform = 'apple' and serial_number = $3`,
    [deviceLibraryIdentifier, body.pushToken, serialNumber]);

  return new NextResponse(null, { status: wasRegistered ? 200 : 201 });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ deviceLibraryIdentifier: string; passTypeIdentifier: string; serialNumber: string }> }) {
  const { deviceLibraryIdentifier, passTypeIdentifier, serialNumber } = await params;
  if (passTypeIdentifier !== process.env.APPLE_PASS_TYPE_IDENTIFIER) {
    return NextResponse.json({ error: "pass_type_not_found" }, { status: 404 });
  }

  const customerId = await validateApplePassAuth(serialNumber, request.headers.get("authorization"));
  if (!customerId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await query(`
    update wallet_passes
    set device_library_identifier = null,
        push_token = null,
        updated_at = now()
    where platform = 'apple'
      and serial_number = $1
      and device_library_identifier = $2`,
    [serialNumber, deviceLibraryIdentifier]);

  return new NextResponse(null, { status: 200 });
}
