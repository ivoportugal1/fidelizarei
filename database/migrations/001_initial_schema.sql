-- Fideliza MVP: standard PostgreSQL for Render.
create extension if not exists pgcrypto;

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,60}$'),
  plan text not null default 'starter' check (plan in ('starter', 'essential', 'pro')),
  created_at timestamptz not null default now()
);

-- Company login is added in the next iteration. Keeping users separate supports multi-company roles.
create table app_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  full_name text,
  created_at timestamptz not null default now()
);
create table organization_members (
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references app_users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'manager', 'staff')),
  primary key (organization_id, user_id)
);

create table loyalty_programs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  reward_name text not null,
  points_to_reward integer not null check (points_to_reward between 1 and 1000),
  points_per_code integer not null default 1 check (points_per_code between 1 and 100),
  pass_background_color text not null default '#12635A' check (pass_background_color ~ '^#[0-9A-Fa-f]{6}$'),
  pass_foreground_color text not null default '#FFFFFF' check (pass_foreground_color ~ '^#[0-9A-Fa-f]{6}$'),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  phone_e164 text,
  email text,
  full_name text,
  created_at timestamptz not null default now(),
  unique (organization_id, phone_e164),
  unique (organization_id, email)
);
create table loyalty_balances (
  customer_id uuid not null references customers(id) on delete cascade,
  program_id uuid not null references loyalty_programs(id) on delete cascade,
  points integer not null default 0 check (points >= 0),
  rewards_available integer not null default 0 check (rewards_available >= 0),
  updated_at timestamptz not null default now(),
  primary key (customer_id, program_id)
);
create table wallet_passes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  program_id uuid not null references loyalty_programs(id) on delete cascade,
  platform text not null check (platform in ('apple', 'google')),
  serial_number text not null unique,
  device_library_identifier text,
  push_token text,
  status text not null default 'active' check (status in ('active', 'voided')),
  created_at timestamptz not null default now(),
  unique (customer_id, program_id, platform)
);
create table redemption_codes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  program_id uuid not null references loyalty_programs(id) on delete cascade,
  code_hash text not null unique check (length(code_hash) = 64),
  points integer not null default 1 check (points between 1 and 100),
  customer_id uuid references customers(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'redeemed', 'voided', 'expired')),
  expires_at timestamptz,
  redeemed_at timestamptz,
  redeemed_by_customer_id uuid references customers(id) on delete set null,
  created_at timestamptz not null default now(),
  check ((status = 'redeemed') = (redeemed_at is not null))
);
create index redemption_codes_claimable on redemption_codes (code_hash) where status = 'active';
create table point_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  program_id uuid not null references loyalty_programs(id) on delete cascade,
  redemption_code_id uuid unique references redemption_codes(id) on delete restrict,
  kind text not null check (kind in ('earn', 'redeem', 'adjustment', 'reversal')),
  points_delta integer not null check (points_delta <> 0),
  created_at timestamptz not null default now()
);
create table wallet_update_jobs (
  id uuid primary key default gen_random_uuid(),
  wallet_pass_id uuid not null references wallet_passes(id) on delete cascade,
  event text not null check (event in ('balance_changed', 'reward_available', 'reward_redeemed')),
  status text not null default 'pending' check (status in ('pending', 'processing', 'done', 'failed')),
  attempts integer not null default 0,
  error_message text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);
create index wallet_update_jobs_pending on wallet_update_jobs (status, created_at) where status = 'pending';
