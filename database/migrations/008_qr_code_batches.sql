create table if not exists qr_code_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  program_id uuid not null references loyalty_programs(id) on delete cascade,
  quantity integer not null check (quantity between 1 and 500),
  created_by_user_id uuid references app_users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table redemption_codes
  add column if not exists batch_id uuid references qr_code_batches(id) on delete set null,
  add column if not exists code_value text;

create unique index if not exists redemption_codes_code_value_unique
  on redemption_codes (code_value)
  where code_value is not null;

create index if not exists qr_code_batches_org_program_created_idx
  on qr_code_batches (organization_id, program_id, created_at desc);

create index if not exists redemption_codes_batch_idx
  on redemption_codes (batch_id, created_at asc);
