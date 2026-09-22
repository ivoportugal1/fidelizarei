alter table organizations add column if not exists meta_purchase_tracking_consent_at timestamptz;

create table if not exists meta_purchase_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  stripe_invoice_id text not null,
  event_id text not null,
  amount_paid_minor bigint not null,
  currency text not null,
  event_time timestamptz not null,
  status text not null default 'pending',
  attempts integer not null default 0,
  last_attempted_at timestamptz,
  sent_at timestamptz,
  meta_trace_id text,
  last_error text,
  created_at timestamptz not null default now(),
  unique (organization_id),
  unique (stripe_invoice_id),
  unique (event_id)
);

create index if not exists meta_purchase_events_status_idx on meta_purchase_events (status, last_attempted_at);
