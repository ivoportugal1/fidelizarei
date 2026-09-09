import { NextResponse } from "next/server";
import { query } from "@/lib/database";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ deviceLibraryIdentifier: string; passTypeIdentifier: string }> }) {
  const { deviceLibraryIdentifier, passTypeIdentifier } = await params;
  if (passTypeIdentifier !== process.env.APPLE_PASS_TYPE_IDENTIFIER) {
    return NextResponse.json({ error: "pass_type_not_found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const updatedSince = url.searchParams.get("passesUpdatedSince");
  const values: unknown[] = [deviceLibraryIdentifier];
  let updatedFilter = "";
  if (updatedSince) {
    values.push(new Date(updatedSince));
    updatedFilter = "and updated_at > $2";
  }

  const result = await query<{ serial_number: string; updated_at: Date }>(`
    select serial_number, updated_at
    from wallet_passes
    where platform = 'apple'
      and status = 'active'
      and device_library_identifier = $1
      ${updatedFilter}
    order by updated_at asc`, values);

  if (!result.rows.length) return new NextResponse(null, { status: 204 });
  const lastUpdated = result.rows[result.rows.length - 1]?.updated_at.toISOString() ?? new Date().toISOString();
  return NextResponse.json({
    serialNumbers: result.rows.map((row) => row.serial_number),
    lastUpdated,
  });
}
