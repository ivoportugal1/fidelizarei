import { query } from "@/lib/database";

export const USED_SCREEN_SECONDS = 5;

export type CounterState =
  | { state: "idle"; storeName: string }
  | { state: "qr"; storeName: string; code: string; expiresAt: string }
  | { state: "used"; storeName: string };

type Row = {
  store_name: string;
  code_value: string | null;
  status: string | null;
  expires_at: Date | null;
  recently_redeemed: boolean | null;
  not_expired: boolean | null;
};

// What the counter tablet should show right now, looked up by its own token.
export async function getCounterState(counterToken: string): Promise<CounterState | null> {
  const result = await query<Row>(`
    select o.name as store_name, c.code_value, c.status, c.expires_at,
           (c.redeemed_at is not null and c.redeemed_at > now() - ($2::int * interval '1 second')) as recently_redeemed,
           (c.expires_at is null or c.expires_at > now()) as not_expired
    from beefood_integrations i
    join organizations o on o.id = i.organization_id
    left join lateral (
      select rc.code_value, rc.status, rc.expires_at, rc.redeemed_at
      from beefood_orders bo join redemption_codes rc on rc.id = bo.redemption_code_id
      where bo.integration_id = i.id
      order by bo.created_at desc limit 1
    ) c on true
    where i.counter_token = $1 and i.enabled = true
    limit 1`, [counterToken, USED_SCREEN_SECONDS]);
  const row = result.rows[0];
  if (!row) return null;
  const storeName = row.store_name;
  if (row.status === "active" && row.not_expired && row.code_value && row.expires_at) {
    return { state: "qr", storeName, code: row.code_value, expiresAt: row.expires_at.toISOString() };
  }
  if (row.status === "redeemed" && row.recently_redeemed) return { state: "used", storeName };
  return { state: "idle", storeName };
}
