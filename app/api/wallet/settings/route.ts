import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/database";
import { defaultWalletSettings, getWalletCardSettings, normalizeWalletSettings } from "@/lib/wallet-settings";

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

async function getContext(userId: string) {
  const result = await query<ContextRow>(`
    select o.id as organization_id, o.name as organization_name,
           p.id as program_id, p.name as program_name, p.reward_name,
           p.points_to_reward, p.pass_background_color
    from organization_members m
    join organizations o on o.id = m.organization_id
    join loyalty_programs p on p.organization_id = o.id and p.active = true
    where m.user_id = $1
    order by o.created_at asc, p.created_at asc
    limit 1`, [userId]);
  return result.rows[0] ?? null;
}

function defaultsFrom(row: ContextRow) {
  return defaultWalletSettings({
    businessName: row.organization_name,
    programName: row.program_name,
    rewardName: row.reward_name,
    pointsToReward: row.points_to_reward,
    backgroundColor: row.pass_background_color,
  });
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const context = await getContext(user.id);
  if (!context) return NextResponse.json({ ok: false, error: "program_not_found" }, { status: 404 });
  const settings = await getWalletCardSettings(context.organization_id, defaultsFrom(context), new URL(request.url).origin);
  return NextResponse.json({ ok: true, settings });
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const context = await getContext(user.id);
  if (!context) return NextResponse.json({ ok: false, error: "program_not_found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const fallback = await getWalletCardSettings(context.organization_id, defaultsFrom(context), new URL(request.url).origin);
  const settings = normalizeWalletSettings(body.settings ?? body, fallback);
  const logoId = settings.logoUrl?.match(/\/api\/wallet\/assets\/([^/?#]+)/)?.[1] ?? null;
  const coverId = settings.coverUrl?.match(/\/api\/wallet\/assets\/([^/?#]+)/)?.[1] ?? null;

  await query(`
    insert into wallet_card_settings (
      organization_id, program_id, business_name, program_description, reward_text,
      points_goal, point_theme, primary_color, secondary_color, logo_asset_id, cover_asset_id, updated_at
    )
    values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now())
    on conflict (organization_id) do update set
      program_id = excluded.program_id,
      business_name = excluded.business_name,
      program_description = excluded.program_description,
      reward_text = excluded.reward_text,
      points_goal = excluded.points_goal,
      point_theme = excluded.point_theme,
      primary_color = excluded.primary_color,
      secondary_color = excluded.secondary_color,
      logo_asset_id = coalesce(excluded.logo_asset_id, wallet_card_settings.logo_asset_id),
      cover_asset_id = coalesce(excluded.cover_asset_id, wallet_card_settings.cover_asset_id),
      updated_at = now()`,
    [
      context.organization_id,
      context.program_id,
      settings.businessName,
      settings.programDescription,
      settings.rewardText,
      settings.pointsGoal,
      settings.pointTheme,
      settings.primaryColor,
      settings.secondaryColor,
      logoId,
      coverId,
    ]);

  const saved = await getWalletCardSettings(context.organization_id, defaultsFrom(context), new URL(request.url).origin);
  return NextResponse.json({ ok: true, settings: saved });
}
