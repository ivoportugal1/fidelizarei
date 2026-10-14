-- BeeFood PDV integration. Additive only: new tables, no changes to existing ones.
create table if not exists beefood_integrations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  program_id uuid not null references loyalty_programs(id) on delete cascade,
  enabled boolean not null default false,
  client_id text,
  client_secret_enc text,
  webhook_token text not null unique,
  counter_token text not null unique,
  webhook_secret text not null,
  min_amount numeric(10,2) not null default 0 check (min_amount >= 0),
  qr_ttl_seconds integer not null default 180 check (qr_ttl_seconds between 30 and 3600),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, program_id)
);

-- One row per BeeFood order that produced a point QR. The unique key makes a
-- repeated webhook delivery harmless: one order = at most one point.
create table if not exists beefood_orders (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid not null references beefood_integrations(id) on delete cascade,
  order_id text not null,
  order_amount numeric(10,2),
  redemption_code_id uuid references redemption_codes(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (integration_id, order_id)
);

create index if not exists beefood_orders_code_idx on beefood_orders (redemption_code_id);
