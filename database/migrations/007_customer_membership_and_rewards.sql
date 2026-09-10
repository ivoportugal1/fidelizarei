alter table customers
  add column if not exists status text not null default 'active' check (status in ('active', 'inactive')),
  add column if not exists deactivated_at timestamptz;

create table if not exists reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  program_id uuid not null references loyalty_programs(id) on delete cascade,
  reward_name text not null,
  points_spent integer not null,
  points_remaining integer not null,
  rewards_remaining integer not null,
  redeemed_by_user_id uuid references app_users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists reward_redemptions_customer_program_idx
  on reward_redemptions (customer_id, program_id, created_at desc);
