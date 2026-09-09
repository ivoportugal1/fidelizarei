import { NextResponse } from "next/server";
import sharp from "sharp";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/database";
import { assetUrl, defaultWalletSettings } from "@/lib/wallet-settings";

export const runtime = "nodejs";

type ContextRow = {
  organization_id: string;
  organization_name: string;
  program_id: string;
  program_name: string;
  reward_name: string;
  points_to_reward: number;
  pass_background_color: string;
};

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_BYTES = 2 * 1024 * 1024;

function isNearWhite(red: number, green: number, blue: number, alpha: number) {
  if (alpha < 8) return true;
  const min = Math.min(red, green, blue);
  const max = Math.max(red, green, blue);
  return min >= 238 && max - min <= 24;
}

async function processLogoAsset(input: Buffer) {
  const source = sharp(input).rotate().ensureAlpha().resize(1024, 1024, {
    fit: "inside",
    withoutEnlargement: true,
  });
  const { data, info } = await source.raw().toBuffer({ resolveWithObject: true });
  const width = info.width;
  const height = info.height;
  const visited = new Uint8Array(width * height);
  const stack: number[] = [];

  const enqueue = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const pixel = y * width + x;
    if (visited[pixel]) return;
    const offset = pixel * 4;
    if (!isNearWhite(data[offset], data[offset + 1], data[offset + 2], data[offset + 3])) return;
    visited[pixel] = 1;
    stack.push(pixel);
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }

  while (stack.length) {
    const pixel = stack.pop()!;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    const offset = pixel * 4;
    data[offset + 3] = 0;
    enqueue(x + 1, y);
    enqueue(x - 1, y);
    enqueue(x, y + 1);
    enqueue(x, y - 1);
  }

  return sharp(data, { raw: { width, height, channels: 4 } })
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 4 })
    .extend({ top: 24, bottom: 24, left: 24, right: 24, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize(512, 512, { fit: "inside", withoutEnlargement: true, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

async function processCoverAsset(input: Buffer) {
  return sharp(input)
    .rotate()
    .resize(1600, 900, { fit: "cover", withoutEnlargement: false })
    .png()
    .toBuffer();
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const context = await query<ContextRow>(`
    select o.id as organization_id, o.name as organization_name,
           p.id as program_id, p.name as program_name, p.reward_name,
           p.points_to_reward, p.pass_background_color
    from organization_members m
    join organizations o on o.id = m.organization_id
    join loyalty_programs p on p.organization_id = o.id and p.active = true
    where m.user_id = $1
    order by o.created_at asc
    limit 1`, [user.id]);
  const row = context.rows[0];
  if (!row) return NextResponse.json({ ok: false, error: "organization_not_found" }, { status: 404 });

  const formData = await request.formData();
  const file = formData.get("file");
  const kind = formData.get("kind") === "cover" ? "cover" : "logo";
  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "file_required" }, { status: 400 });
  if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ ok: false, error: "invalid_file_type" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ ok: false, error: "file_too_large" }, { status: 400 });

  const original = Buffer.from(await file.arrayBuffer());
  const data = kind === "logo" ? await processLogoAsset(original) : await processCoverAsset(original);
  const result = await query<{ id: string }>(`
    insert into wallet_card_assets (organization_id, filename, content_type, data)
    values ($1, $2, $3, $4)
    returning id`, [row.organization_id, `${kind}-${Date.now()}.png`, "image/png", data]);

  const id = result.rows[0].id;
  const defaults = defaultWalletSettings({
    businessName: row.organization_name,
    programName: row.program_name,
    rewardName: row.reward_name,
    pointsToReward: row.points_to_reward,
    backgroundColor: row.pass_background_color,
  });

  await query(`
    insert into wallet_card_settings (
      organization_id, program_id, business_name, program_description, reward_text,
      points_goal, point_theme, primary_color, secondary_color, background_color, text_color,
      progress_label, reward_title, accumulation_text, completed_message, terms_text,
      website_url, instagram_username, contact_phone, address_text,
      logo_asset_id, cover_asset_id, updated_at
    )
    values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, now())
    on conflict (organization_id) do update set
      ${kind === "logo" ? "logo_asset_id" : "cover_asset_id"} = excluded.${kind === "logo" ? "logo_asset_id" : "cover_asset_id"},
      updated_at = now()`,
    [
      row.organization_id,
      row.program_id,
      defaults.businessName,
      defaults.programDescription,
      defaults.rewardText,
      defaults.pointsGoal,
      defaults.pointTheme,
      defaults.primaryColor,
      defaults.secondaryColor,
      defaults.backgroundColor,
      defaults.textColor,
      defaults.progressLabel,
      defaults.rewardTitle,
      defaults.accumulationText,
      defaults.completedMessage,
      defaults.termsText,
      defaults.websiteUrl,
      defaults.instagramUsername,
      defaults.contactPhone,
      defaults.addressText,
      kind === "logo" ? id : null,
      kind === "cover" ? id : null,
    ]);

  return NextResponse.json({ ok: true, id, url: assetUrl(new URL(request.url).origin, id) });
}
