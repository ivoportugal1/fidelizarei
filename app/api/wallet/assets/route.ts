import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/database";
import { assetUrl } from "@/lib/wallet-settings";

export const runtime = "nodejs";

type ContextRow = {
  organization_id: string;
};

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_BYTES = 2 * 1024 * 1024;

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const context = await query<ContextRow>(`
    select o.id as organization_id
    from organization_members m
    join organizations o on o.id = m.organization_id
    where m.user_id = $1
    order by o.created_at asc
    limit 1`, [user.id]);
  const organizationId = context.rows[0]?.organization_id;
  if (!organizationId) return NextResponse.json({ ok: false, error: "organization_not_found" }, { status: 404 });

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "file_required" }, { status: 400 });
  if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ ok: false, error: "invalid_file_type" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ ok: false, error: "file_too_large" }, { status: 400 });

  const data = Buffer.from(await file.arrayBuffer());
  const result = await query<{ id: string }>(`
    insert into wallet_card_assets (organization_id, filename, content_type, data)
    values ($1, $2, $3, $4)
    returning id`, [organizationId, file.name || "wallet-image", file.type, data]);

  const id = result.rows[0].id;
  return NextResponse.json({ ok: true, id, url: assetUrl(new URL(request.url).origin, id) });
}
