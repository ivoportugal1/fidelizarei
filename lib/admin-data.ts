import { query } from "./database";

export type DashboardData = {
  user: { name: string; email: string };
  organization: { id: string; name: string; plan: string };
  program: {
    id: string;
    name: string;
    rewardName: string;
    pointsToReward: number;
    pointsPerCode: number;
    backgroundColor: string;
  };
  metrics: {
    customers: number;
    points: number;
    rewards: number;
    activeCodes: number;
    redeemedCodes: number;
  };
  customers: Array<{
    id: string;
    name: string;
    phone: string | null;
    points: number;
    rewards: number;
    updatedAt: string | null;
  }>;
  recent: Array<{
    id: string;
    customerName: string;
    points: number;
    createdAt: string;
  }>;
};

type ContextRow = {
  organization_id: string;
  organization_name: string;
  plan: string;
  program_id: string;
  program_name: string;
  reward_name: string;
  points_to_reward: number;
  points_per_code: number;
  pass_background_color: string;
};

export async function getDashboardData(userId: string, userEmail: string, userName: string | null): Promise<DashboardData> {
  const context = await query<ContextRow>(`
    select o.id as organization_id, o.name as organization_name, o.plan,
           p.id as program_id, p.name as program_name, p.reward_name, p.points_to_reward,
           p.points_per_code, p.pass_background_color
    from organization_members m
    join organizations o on o.id = m.organization_id
    join loyalty_programs p on p.organization_id = o.id
    where m.user_id = $1 and p.active = true
    order by o.created_at asc, p.created_at asc
    limit 1`, [userId]);

  const row = context.rows[0];
  if (!row) throw new Error("dashboard_not_configured");

  const [customerCount, pointCount, rewardCount, activeCodeCount, redeemedCodeCount, customers, recent] = await Promise.all([
    query<{ count: string }>("select count(*) from customers where organization_id = $1", [row.organization_id]),
    query<{ total: string | null }>("select coalesce(sum(points_delta), 0) as total from point_transactions where organization_id = $1 and kind = 'earn'", [row.organization_id]),
    query<{ total: string | null }>("select coalesce(sum(rewards_available), 0) as total from loyalty_balances lb join loyalty_programs p on p.id = lb.program_id where p.organization_id = $1", [row.organization_id]),
    query<{ count: string }>("select count(*) from redemption_codes where organization_id = $1 and status = 'active'", [row.organization_id]),
    query<{ count: string }>("select count(*) from redemption_codes where organization_id = $1 and status = 'redeemed'", [row.organization_id]),
    query<{ id: string; full_name: string | null; phone_e164: string | null; points: number; rewards_available: number; updated_at: Date | null }>(`
      select c.id, c.full_name, c.phone_e164, coalesce(lb.points, 0) as points,
             coalesce(lb.rewards_available, 0) as rewards_available, lb.updated_at
      from customers c
      left join loyalty_balances lb on lb.customer_id = c.id and lb.program_id = $2
      where c.organization_id = $1
      order by lb.updated_at desc nulls last, c.created_at desc
      limit 20`, [row.organization_id, row.program_id]),
    query<{ id: string; full_name: string | null; phone_e164: string | null; points_delta: number; created_at: Date }>(`
      select t.id, c.full_name, c.phone_e164, t.points_delta, t.created_at
      from point_transactions t
      join customers c on c.id = t.customer_id
      where t.organization_id = $1
      order by t.created_at desc
      limit 12`, [row.organization_id]),
  ]);

  return {
    user: { name: userName || userEmail, email: userEmail },
    organization: { id: row.organization_id, name: row.organization_name, plan: row.plan },
    program: {
      id: row.program_id,
      name: row.program_name,
      rewardName: row.reward_name,
      pointsToReward: row.points_to_reward,
      pointsPerCode: row.points_per_code,
      backgroundColor: row.pass_background_color,
    },
    metrics: {
      customers: Number(customerCount.rows[0]?.count ?? 0),
      points: Number(pointCount.rows[0]?.total ?? 0),
      rewards: Number(rewardCount.rows[0]?.total ?? 0),
      activeCodes: Number(activeCodeCount.rows[0]?.count ?? 0),
      redeemedCodes: Number(redeemedCodeCount.rows[0]?.count ?? 0),
    },
    customers: customers.rows.map((customer) => ({
      id: customer.id,
      name: customer.full_name || customer.phone_e164 || "Cliente",
      phone: customer.phone_e164,
      points: Number(customer.points),
      rewards: Number(customer.rewards_available),
      updatedAt: customer.updated_at?.toISOString() ?? null,
    })),
    recent: recent.rows.map((item) => ({
      id: item.id,
      customerName: item.full_name || item.phone_e164 || "Cliente",
      points: Number(item.points_delta),
      createdAt: item.created_at.toISOString(),
    })),
  };
}
