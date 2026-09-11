import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/database";

export const runtime = "nodejs";

type CampaignBody = {
  name?: string;
  rewardName?: string;
  pointsToReward?: number;
  pointsPerCode?: number;
  active?: boolean;
};

async function getOrganizationId(userId: string) {
  const result = await query<{ organization_id: string }>(`
    select organization_id
    from organization_members
    where user_id = $1
    order by case when role = 'owner' then 0 else 1 end
    limit 1`, [userId]);
  return result.rows[0]?.organization_id ?? null;
}

function normalizeCampaign(body: CampaignBody) {
  const name = String(body.name || "").trim().slice(0, 80);
  const rewardName = String(body.rewardName || "").trim().slice(0, 80);
  const pointsToReward = Number(body.pointsToReward);
  const pointsPerCode = Number(body.pointsPerCode || 1);
  if (!name || !rewardName) throw new Error("invalid_campaign");
  if (!Number.isInteger(pointsToReward) || pointsToReward < 1 || pointsToReward > 1000) throw new Error("invalid_campaign");
  if (!Number.isInteger(pointsPerCode) || pointsPerCode < 1 || pointsPerCode > 100) throw new Error("invalid_campaign");
  return { name, rewardName, pointsToReward, pointsPerCode, active: body.active !== false };
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const organizationId = await getOrganizationId(user.id);
  if (!organizationId) return NextResponse.json({ ok: false, error: "organization_not_found" }, { status: 404 });

  try {
    const campaign = normalizeCampaign(await request.json().catch(() => ({})));
    const result = await query<{
      id: string; name: string; reward_name: string; points_to_reward: number; points_per_code: number; active: boolean; created_at: Date;
    }>(`
      insert into loyalty_programs (organization_id, name, reward_name, points_to_reward, points_per_code, active)
      values ($1, $2, $3, $4, $5, $6)
      returning id, name, reward_name, points_to_reward, points_per_code, active, created_at`,
      [organizationId, campaign.name, campaign.rewardName, campaign.pointsToReward, campaign.pointsPerCode, campaign.active]);
    const row = result.rows[0];
    return NextResponse.json({
      ok: true,
      campaign: {
        id: row.id,
        name: row.name,
        rewardName: row.reward_name,
        pointsToReward: Number(row.points_to_reward),
        pointsPerCode: Number(row.points_per_code),
        active: row.active,
        createdAt: row.created_at.toISOString(),
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_campaign" }, { status: 400 });
  }
}
