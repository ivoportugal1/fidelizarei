import { NextResponse } from "next/server";
import { getCodeForEnrollment } from "@/lib/redemption";

export const runtime = "nodejs";

export async function POST(_: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const codeRecord = await getCodeForEnrollment(code);
    if (!codeRecord || codeRecord.status !== "active") return NextResponse.json({ ok: false, error: "invalid_or_used_code" }, { status: 409 });
    return NextResponse.json({
      ok: false,
      error: "join_required",
      joinUrl: `/join/${codeRecord.program_id}`,
    }, { status: 403 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "join_required";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
