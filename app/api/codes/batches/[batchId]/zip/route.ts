import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { buildQrZip, getQrBatchCodes } from "@/lib/qr-batches";
import { publicAppUrl } from "@/lib/public-url";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ batchId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { batchId } = await params;
  const origin = publicAppUrl(new URL(request.url).origin);
  const codes = await getQrBatchCodes(user.id, batchId, origin);
  if (!codes) return NextResponse.json({ ok: false, error: "batch_not_found" }, { status: 404 });

  const zip = await buildQrZip(codes);
  return new NextResponse(zip, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="qrcodes-${batchId.slice(0, 8)}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
