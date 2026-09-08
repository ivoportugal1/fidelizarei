import { NextResponse } from "next/server";
import { query } from "@/lib/database";

export const runtime = "nodejs";

type AssetRow = {
  content_type: string;
  data: Buffer;
};

export async function GET(_: Request, { params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params;
  const result = await query<AssetRow>(
    "select content_type, data from wallet_card_assets where id = $1 limit 1",
    [assetId],
  );
  const asset = result.rows[0];
  if (!asset) return NextResponse.json({ ok: false, error: "asset_not_found" }, { status: 404 });

  return new NextResponse(new Uint8Array(asset.data), {
    headers: {
      "Content-Type": asset.content_type,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
