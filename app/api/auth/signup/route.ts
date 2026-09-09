import { NextResponse } from "next/server";
import { createAdminSession, hashPassword, setAdminCookie } from "@/lib/auth";
import { isTrialCouponValid } from "@/lib/billing";
import { query } from "@/lib/database";

export const runtime = "nodejs";

function slugify(value: string) {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 52);
  return slug || "empresa";
}

async function uniqueSlug(base: string) {
  for (let index = 0; index < 20; index += 1) {
    const candidate = index === 0 ? base : `${base}-${index + 1}`;
    const existing = await query<{ id: string }>("select id from organizations where slug = $1 limit 1", [candidate]);
    if (!existing.rows[0]) return candidate;
  }
  return `${base}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function POST(request: Request) {
  const body = await request.json() as {
    businessName?: string;
    ownerName?: string;
    taxId?: string;
    email?: string;
    password?: string;
    billingInterval?: "monthly" | "yearly";
    couponCode?: string;
  };

  const businessName = body.businessName?.trim();
  const ownerName = body.ownerName?.trim();
  const taxId = body.taxId?.replace(/\D/g, "") || "";
  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";
  const billingInterval = body.billingInterval === "yearly" ? "yearly" : "monthly";
  const couponCode = body.couponCode?.trim() || "";
  const hasTrialCoupon = isTrialCouponValid(couponCode);

  if (!businessName || !ownerName || !email || password.length < 8 || ![11, 14].includes(taxId.length)) {
    return NextResponse.json({ ok: false, error: "invalid_signup" }, { status: 400 });
  }
  if (couponCode && !hasTrialCoupon) {
    return NextResponse.json({ ok: false, error: "invalid_coupon" }, { status: 400 });
  }

  const existingUser = await query<{ id: string }>("select id from app_users where email = $1 limit 1", [email]);
  if (existingUser.rows[0]) {
    return NextResponse.json({ ok: false, error: "email_already_exists" }, { status: 409 });
  }

  const slug = await uniqueSlug(slugify(businessName));
  const org = await query<{ id: string }>(`
    insert into organizations (
      name, slug, tax_id, plan, subscription_status, trial_started_at, trial_ends_at,
      subscription_billing_interval, subscription_coupon_code
    )
    values (
      $1, $2, $3, 'starter', $4,
      case when $4 = 'trialing' then now() else null end,
      case when $4 = 'trialing' then now() + interval '30 days' else null end,
      $5, $6
    )
    returning id`, [businessName, slug, taxId, hasTrialCoupon ? "trialing" : "pending", billingInterval, hasTrialCoupon ? couponCode.toUpperCase() : null]);

  const user = await query<{ id: string }>(`
    insert into app_users (email, password_hash, full_name)
    values ($1, $2, $3)
    returning id`, [email, hashPassword(password), ownerName]);

  await query(`
    insert into organization_members (organization_id, user_id, role)
    values ($1, $2, 'owner')`, [org.rows[0].id, user.rows[0].id]);

  await query(`
    insert into loyalty_programs (organization_id, name, reward_name, points_to_reward, points_per_code)
    values ($1, 'Programa de Fidelidade', 'Recompensa', 7, 1)`, [org.rows[0].id]);

  await setAdminCookie(createAdminSession(user.rows[0].id));
  return NextResponse.json({ ok: true, nextUrl: hasTrialCoupon ? "/dashboard" : "/billing" });
}
