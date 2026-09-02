-- Fideliza MVP: multi-tenant loyalty, single-use QR codes and Wallet update queue.
-- Run this migration in a Supabase project before configuring the environment variables.
create extension if not exists pgcrypto;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,60}$'),
  plan text not null default 'starter' check (plan in ('starter', 'essential', 'pro')),
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'manager', 'staff')),
  primary key (organization_id, profile_id)
);

create table public.loyalty_programs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  reward_name text not null,
  points_to_reward integer not null check (points_to_reward > 0 and points_to_reward <= 1000),
  points_per_code integer not null default 1 check (points_per_code > 0 and points_per_code <= 100),
  pass_background_color text not null default '#12635A' check (pass_background_color ~ '^#[0-9A-Fa-f]{6}$'),
  pass_foreground_color text not null default '#FFFFFF' check (pass_foreground_color ~ '^#[0-9A-Fa-f]{6}$'),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  phone_e164 text,
  email text,
  full_name text,
  created_at timestamptz not null default now(),
  unique (organization_id, phone_e164),
  unique (organization_id, email)
);

create table public.loyalty_balances (
  customer_id uuid not null references public.customers(id) on delete cascade,
  program_id uuid not null references public.loyalty_programs(id) on delete cascade,
  points integer not null default 0 check (points >= 0),
  rewards_available integer not null default 0 check (rewards_available >= 0),
  updated_at timestamptz not null default now(),
  primary key (customer_id, program_id)
);

create table public.wallet_passes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  program_id uuid not null references public.loyalty_programs(id) on delete cascade,
  platform text not null check (platform in ('apple', 'google')),
  serial_number text not null unique,
  device_library_identifier text,
  push_token text,
  status text not null default 'active' check (status in ('active', 'voided')),
  created_at timestamptz not null default now(),
  unique (customer_id, program_id, platform)
);

create table public.redemption_codes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  program_id uuid not null references public.loyalty_programs(id) on delete cascade,
  -- Never store the printable QR token itself: this is SHA-256(token), encoded in hex.
  code_hash text not null unique check (length(code_hash) = 64),
  points integer not null default 1 check (points > 0 and points <= 100),
  customer_id uuid references public.customers(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'redeemed', 'voided', 'expired')),
  expires_at timestamptz,
  redeemed_at timestamptz,
  redeemed_by_customer_id uuid references public.customers(id) on delete set null,
  created_at timestamptz not null default now(),
  check ((status = 'redeemed') = (redeemed_at is not null))
);
create index redemption_codes_claimable on public.redemption_codes (code_hash) where status = 'active';

create table public.point_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  program_id uuid not null references public.loyalty_programs(id) on delete cascade,
  redemption_code_id uuid unique references public.redemption_codes(id) on delete restrict,
  kind text not null check (kind in ('earn', 'redeem', 'adjustment', 'reversal')),
  points_delta integer not null check (points_delta <> 0),
  created_at timestamptz not null default now()
);

create table public.wallet_update_jobs (
  id uuid primary key default gen_random_uuid(),
  wallet_pass_id uuid not null references public.wallet_passes(id) on delete cascade,
  event text not null check (event in ('balance_changed', 'reward_available', 'reward_redeemed')),
  status text not null default 'pending' check (status in ('pending', 'processing', 'done', 'failed')),
  attempts integer not null default 0,
  error_message text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);
create index wallet_update_jobs_pending on public.wallet_update_jobs (status, created_at) where status = 'pending';

-- Atomic redemption: lock the QR row, make it unusable, credit the ledger and queue Wallet updates.
create or replace function public.redeem_loyalty_code(p_code text, p_customer_id uuid)
returns table(points integer, rewards_available integer, points_to_reward integer)
language plpgsql security definer set search_path = public
as $$
declare
  v_code public.redemption_codes;
  v_program public.loyalty_programs;
  v_balance public.loyalty_balances;
begin
  select * into v_code
  from public.redemption_codes
  where code_hash = encode(digest(upper(trim(p_code)), 'sha256'), 'hex')
  for update;

  if not found then raise exception 'invalid_code'; end if;
  if v_code.status <> 'active' then raise exception 'code_already_used'; end if;
  if v_code.expires_at is not null and v_code.expires_at < now() then
    update public.redemption_codes set status = 'expired' where id = v_code.id;
    raise exception 'code_expired';
  end if;
  if v_code.customer_id is not null and v_code.customer_id <> p_customer_id then raise exception 'code_belongs_to_another_customer'; end if;

  select * into v_program from public.loyalty_programs where id = v_code.program_id and active = true;
  if not found then raise exception 'program_not_active'; end if;

  update public.redemption_codes
  set status = 'redeemed', redeemed_at = now(), redeemed_by_customer_id = p_customer_id
  where id = v_code.id;

  insert into public.point_transactions (organization_id, customer_id, program_id, redemption_code_id, kind, points_delta)
  values (v_code.organization_id, p_customer_id, v_code.program_id, v_code.id, 'earn', v_code.points);

  insert into public.loyalty_balances (customer_id, program_id, points, rewards_available)
  values (p_customer_id, v_code.program_id, v_code.points, 0)
  on conflict (customer_id, program_id) do update
  set points = public.loyalty_balances.points + excluded.points, updated_at = now()
  returning * into v_balance;

  while v_balance.points >= v_program.points_to_reward loop
    update public.loyalty_balances
    set points = points - v_program.points_to_reward,
        rewards_available = rewards_available + 1,
        updated_at = now()
    where customer_id = p_customer_id and program_id = v_code.program_id
    returning * into v_balance;
  end loop;

  insert into public.wallet_update_jobs (wallet_pass_id, event)
  select id, case when v_balance.rewards_available > 0 then 'reward_available' else 'balance_changed' end
  from public.wallet_passes
  where customer_id = p_customer_id and program_id = v_code.program_id and status = 'active';

  return query select v_balance.points, v_balance.rewards_available, v_program.points_to_reward;
end;
$$;
revoke execute on function public.redeem_loyalty_code(text, uuid) from public, anon, authenticated;

-- RLS: the browser may only see organizations for which its authenticated profile is a member.
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.loyalty_programs enable row level security;
alter table public.customers enable row level security;
alter table public.loyalty_balances enable row level security;
alter table public.redemption_codes enable row level security;
alter table public.point_transactions enable row level security;
create policy "members read organizations" on public.organizations for select using (exists (select 1 from public.organization_members m where m.organization_id = id and m.profile_id = auth.uid()));
create policy "members read memberships" on public.organization_members for select using (profile_id = auth.uid());
create policy "members read programs" on public.loyalty_programs for select using (exists (select 1 from public.organization_members m where m.organization_id = loyalty_programs.organization_id and m.profile_id = auth.uid()));
create policy "members read customers" on public.customers for select using (exists (select 1 from public.organization_members m where m.organization_id = customers.organization_id and m.profile_id = auth.uid()));
create policy "members read balances" on public.loyalty_balances for select using (exists (select 1 from public.customers c join public.organization_members m on m.organization_id = c.organization_id where c.id = loyalty_balances.customer_id and m.profile_id = auth.uid()));
create policy "members read codes" on public.redemption_codes for select using (exists (select 1 from public.organization_members m where m.organization_id = redemption_codes.organization_id and m.profile_id = auth.uid()));
create policy "members read transactions" on public.point_transactions for select using (exists (select 1 from public.organization_members m where m.organization_id = point_transactions.organization_id and m.profile_id = auth.uid()));
