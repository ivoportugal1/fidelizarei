import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import { query, transaction } from "./database";

export const normalizeCode = (code: string) => code.trim().toUpperCase();
export const hashCode = (code: string) => createHash("sha256").update(normalizeCode(code)).digest("hex");

type CodeRow = {
  id: string; organization_id: string; program_id: string; points: number; customer_id: string | null;
  status: "active" | "redeemed" | "voided" | "expired"; expires_at: Date | null;
  points_to_reward: number; program_active: boolean;
};

export async function redeemCode(code: string, customerId: string) {
  return transaction(async (client) => redeemWithClient(client, code, customerId));
}

async function redeemWithClient(client: PoolClient, code: string, customerId: string) {
  const locked = await client.query<CodeRow>(`
    select c.id, c.organization_id, c.program_id, c.points, c.customer_id, c.status, c.expires_at,
           p.points_to_reward, p.active as program_active
    from redemption_codes c join loyalty_programs p on p.id = c.program_id
    where c.code_hash = $1 for update of c`, [hashCode(code)]);
  const record = locked.rows[0];
  if (!record) throw new Error("invalid_code");
  if (record.status !== "active") throw new Error("code_already_used");
  if (record.expires_at && record.expires_at < new Date()) {
    await client.query("update redemption_codes set status = 'expired' where id = $1", [record.id]);
    throw new Error("code_expired");
  }
  if (!record.program_active) throw new Error("program_not_active");
  if (record.customer_id && record.customer_id !== customerId) throw new Error("code_belongs_to_another_customer");

  await client.query("update redemption_codes set status = 'redeemed', redeemed_at = now(), redeemed_by_customer_id = $1 where id = $2", [customerId, record.id]);
  await client.query(`insert into point_transactions (organization_id, customer_id, program_id, redemption_code_id, kind, points_delta)
                      values ($1, $2, $3, $4, 'earn', $5)`, [record.organization_id, customerId, record.program_id, record.id, record.points]);
  const balanceResult = await client.query<{ points: number; rewards_available: number }>(`
    insert into loyalty_balances (customer_id, program_id, points, rewards_available)
    values ($1, $2, $3, 0)
    on conflict (customer_id, program_id) do update set points = loyalty_balances.points + excluded.points, updated_at = now()
    returning points, rewards_available`, [customerId, record.program_id, record.points]);
  let balance = balanceResult.rows[0];
  if (balance.points >= record.points_to_reward) {
    const rewards = Math.floor(balance.points / record.points_to_reward);
    const updated = await client.query<{ points: number; rewards_available: number }>(`
      update loyalty_balances set points = points - $3, rewards_available = rewards_available + $4, updated_at = now()
      where customer_id = $1 and program_id = $2 returning points, rewards_available`,
      [customerId, record.program_id, rewards * record.points_to_reward, rewards]);
    balance = updated.rows[0];
  }
  const event = balance.rewards_available > 0 ? "reward_available" : "balance_changed";
  await client.query(`insert into wallet_update_jobs (wallet_pass_id, event)
                      select id, $3 from wallet_passes where customer_id = $1 and program_id = $2 and status = 'active'`,
                    [customerId, record.program_id, event]);
  return { points: balance.points, rewards_available: balance.rewards_available, points_to_reward: record.points_to_reward };
}

export async function getCodeForEnrollment(code: string) {
  const result = await query<{ id: string; organization_id: string; program_id: string; status: string; expires_at: Date | null; program_name: string; organization_name: string }>(`
    select c.id, c.organization_id, c.program_id, c.status, c.expires_at, p.name as program_name, o.name as organization_name
    from redemption_codes c join loyalty_programs p on p.id = c.program_id join organizations o on o.id = c.organization_id
    where c.code_hash = $1`, [hashCode(code)]);
  return result.rows[0] ?? null;
}
