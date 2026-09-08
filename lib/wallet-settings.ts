import { query } from "./database";

export const POINT_THEMES = [
  "cafeteria",
  "acaiteria",
  "sorveteria",
  "pizzaria",
  "hamburgueria",
  "padaria",
  "barbearia",
  "petshop",
  "universal",
] as const;

export type PointTheme = typeof POINT_THEMES[number];

export type WalletCardSettings = {
  businessName: string;
  programDescription: string;
  rewardText: string;
  pointsGoal: number;
  pointTheme: PointTheme;
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string | null;
  coverUrl: string | null;
};

type SettingsRow = {
  business_name: string;
  program_description: string;
  reward_text: string;
  points_goal: number;
  point_theme: PointTheme;
  primary_color: string;
  secondary_color: string;
  logo_asset_id: string | null;
  cover_asset_id: string | null;
};

export function defaultWalletSettings(input: {
  businessName: string;
  programName: string;
  rewardName: string;
  pointsToReward: number;
  backgroundColor?: string | null;
}): WalletCardSettings {
  return {
    businessName: input.businessName,
    programDescription: input.programName,
    rewardText: input.rewardName,
    pointsGoal: input.pointsToReward,
    pointTheme: "universal",
    primaryColor: input.backgroundColor || "#173D20",
    secondaryColor: "#F2B80F",
    logoUrl: null,
    coverUrl: null,
  };
}

export function assetUrl(origin: string, assetId: string | null) {
  if (!assetId) return null;
  return origin ? `${origin}/api/wallet/assets/${assetId}` : `/api/wallet/assets/${assetId}`;
}

export async function getWalletCardSettings(organizationId: string, defaults: WalletCardSettings, origin = "") {
  try {
    const result = await query<SettingsRow>(`
      select business_name, program_description, reward_text, points_goal, point_theme,
             primary_color, secondary_color, logo_asset_id, cover_asset_id
      from wallet_card_settings
      where organization_id = $1
      limit 1`, [organizationId]);
    const row = result.rows[0];
    if (!row) return defaults;
    return {
      businessName: row.business_name,
      programDescription: row.program_description,
      rewardText: row.reward_text,
      pointsGoal: Number(row.points_goal),
      pointTheme: row.point_theme,
      primaryColor: row.primary_color,
      secondaryColor: row.secondary_color,
      logoUrl: origin ? assetUrl(origin, row.logo_asset_id) : row.logo_asset_id,
      coverUrl: origin ? assetUrl(origin, row.cover_asset_id) : row.cover_asset_id,
    } satisfies WalletCardSettings;
  } catch (error) {
    if (error instanceof Error && /wallet_card_settings|does not exist|relation/i.test(error.message)) {
      return defaults;
    }
    throw error;
  }
}

export function normalizeWalletSettings(input: Partial<WalletCardSettings>, fallback: WalletCardSettings) {
  const theme = POINT_THEMES.includes(input.pointTheme as PointTheme) ? input.pointTheme as PointTheme : fallback.pointTheme;
  const color = /^#[0-9A-Fa-f]{6}$/;
  return {
    businessName: String(input.businessName || fallback.businessName).trim().slice(0, 80),
    programDescription: String(input.programDescription || fallback.programDescription).trim().slice(0, 120),
    rewardText: String(input.rewardText || fallback.rewardText).trim().slice(0, 120),
    pointsGoal: Math.max(1, Math.min(Number(input.pointsGoal || fallback.pointsGoal), 20)),
    pointTheme: theme,
    primaryColor: color.test(String(input.primaryColor)) ? String(input.primaryColor).toUpperCase() : fallback.primaryColor,
    secondaryColor: color.test(String(input.secondaryColor)) ? String(input.secondaryColor).toUpperCase() : fallback.secondaryColor,
    logoUrl: input.logoUrl ?? fallback.logoUrl,
    coverUrl: input.coverUrl ?? fallback.coverUrl,
  } satisfies WalletCardSettings;
}
