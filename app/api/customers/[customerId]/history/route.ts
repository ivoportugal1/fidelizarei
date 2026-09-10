import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/database";

export const runtime = "nodejs";

type CustomerAccessRow = {
  organization_id: string;
  program_id: string;
  customer_name: string;
  joined_at: Date;
};

type HistoryRow = {
  id: string;
  type: "joined" | "points_earned" | "reward_redeemed";
  title: string;
  details: string | null;
  points_delta: number | null;
  created_at: Date;
};

export async function GET(_: Request, { params }: { params: Promise<{ customerId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const { customerId } = await params;

  const access = await query<CustomerAccessRow>(`
    select c.organization_id, p.id as program_id, c.full_name as customer_name, c.created_at as joined_at
    from customers c
    join organization_members m on m.organization_id = c.organization_id and m.user_id = $2
    join loyalty_programs p on p.organization_id = c.organization_id and p.active = true
    where c.id = $1
    limit 1`, [customerId, user.id]);

  const customer = access.rows[0];
  if (!customer) return NextResponse.json({ ok: false, error: "customer_not_found" }, { status: 404 });

  const history = await query<HistoryRow>(`
    select
      'joined:' || c.id::text as id,
      'joined'::text as type,
      'Adesão ao programa'::text as title,
      c.full_name as details,
      null::integer as points_delta,
      c.created_at
    from customers c
    where c.id = $1 and c.organization_id = $2

    union all

    select
      'points:' || pt.id::text as id,
      'points_earned'::text as type,
      'Ponto recebido'::text as title,
      pt.kind as details,
      pt.points_delta,
      pt.created_at
    from point_transactions pt
    where pt.customer_id = $1 and pt.organization_id = $2 and pt.program_id = $3 and pt.kind = 'earn'

    union all

    select
      'reward:' || rr.id::text as id,
      'reward_redeemed'::text as type,
      'Recompensa resgatada'::text as title,
      rr.reward_name as details,
      -rr.points_spent as points_delta,
      rr.created_at
    from reward_redemptions rr
    where rr.customer_id = $1 and rr.organization_id = $2 and rr.program_id = $3

    order by created_at desc`, [customerId, customer.organization_id, customer.program_id]);

  return NextResponse.json({
    ok: true,
    customer: {
      id: customerId,
      name: customer.customer_name,
      joinedAt: customer.joined_at,
    },
    history: history.rows.map((item) => ({
      id: item.id,
      type: item.type,
      title: item.title,
      details: item.details,
      pointsDelta: item.points_delta === null ? null : Number(item.points_delta),
      createdAt: item.created_at,
    })),
  });
}
