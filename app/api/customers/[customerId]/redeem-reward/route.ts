import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { transaction } from "@/lib/database";

export const runtime = "nodejs";

type BalanceRow = {
  organization_id: string;
  program_id: string;
  reward_name: string;
  points: number;
  points_to_reward: number;
  rewards_available: number;
};

export async function POST(_: Request, { params }: { params: Promise<{ customerId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const { customerId } = await params;

  try {
    const result = await transaction(async (client) => {
      const balance = await client.query<BalanceRow>(`
        select o.id as organization_id, p.id as program_id, p.reward_name, lb.points, p.points_to_reward, lb.rewards_available
        from customers c
        join organizations o on o.id = c.organization_id
        join organization_members m on m.organization_id = o.id and m.user_id = $2
        join loyalty_programs p on p.organization_id = o.id and p.active = true
        join loyalty_balances lb on lb.customer_id = c.id and lb.program_id = p.id
        where c.id = $1 and c.status = 'active'
        for update of lb`, [customerId, user.id]);

      const row = balance.rows[0];
      if (!row) throw new Error("customer_not_found");
      if (Number(row.rewards_available) <= 0) throw new Error("reward_not_available");

      const updated = await client.query<{ points: number; rewards_available: number }>(`
        update loyalty_balances
        set rewards_available = rewards_available - 1,
            points = case when points >= $3 then points - $3 else points end,
            updated_at = now()
        where customer_id = $1 and program_id = $2
        returning points, rewards_available`, [customerId, row.program_id, Math.max(1, Number(row.points_to_reward))]);

      await client.query(`
        insert into reward_redemptions (
          organization_id, customer_id, program_id, reward_name, points_spent,
          points_remaining, rewards_remaining, redeemed_by_user_id
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          row.organization_id,
          customerId,
          row.program_id,
          row.reward_name,
          Math.max(1, Number(row.points_to_reward)),
          Number(updated.rows[0].points),
          Number(updated.rows[0].rewards_available),
          user.id,
        ]);

      await client.query(`
        insert into wallet_update_jobs (wallet_pass_id, event)
        select id, 'reward_redeemed' from wallet_passes
        where customer_id = $1 and program_id = $2 and status = 'active'`,
        [customerId, row.program_id]);

      await client.query(`
        update wallet_passes set updated_at = now()
        where customer_id = $1 and program_id = $2 and status = 'active'`,
        [customerId, row.program_id]);

      return updated.rows[0];
    });

    return NextResponse.json({ ok: true, rewardsAvailable: Number(result.rewards_available) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unable_to_redeem_reward";
    const status = message === "customer_not_found" ? 404 : message === "reward_not_available" ? 409 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
