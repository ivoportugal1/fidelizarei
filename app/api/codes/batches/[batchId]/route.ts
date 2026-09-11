import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getQrBatchCodes } from "@/lib/qr-batches";
import { publicAppUrl } from "@/lib/public-url";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ batchId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { batchId } = await params;
  const origin = publicAppUrl(new URL(request.url).origin);
  const codes = await getQrBatchCodes(user.id, batchId, origin);
  if (!codes) return NextResponse.json({ ok: false, error: "batch_not_found" }, { status: 404 });

  return NextResponse.json({ ok: true, codes });
}
