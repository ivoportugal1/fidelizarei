import { NextResponse } from "next/server";
import { createAdminSession, setAdminCookie, verifyPassword } from "@/lib/auth";
import { query } from "@/lib/database";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json() as { email?: string; password?: string };
  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";
  if (!email || !password) return NextResponse.json({ ok: false, error: "invalid_credentials" }, { status: 400 });

  const result = await query<{ id: string; password_hash: string }>("select id, password_hash from app_users where email = $1", [email]);
  const user = result.rows[0];
  if (!user || !verifyPassword(password, user.password_hash)) {
    return NextResponse.json({ ok: false, error: "invalid_credentials" }, { status: 401 });
  }

  await setAdminCookie(createAdminSession(user.id));
  return NextResponse.json({ ok: true });
}
