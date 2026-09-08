alter table organizations add column if not exists subscription_status text;
alter table organizations add column if not exists trial_started_at timestamptz;
alter table organizations add column if not exists trial_ends_at timestamptz;
alter table organizations add column if not exists access_blocked_at timestamptz;
alter table organizations add column if not exists mercado_pago_preapproval_id text;
alter table organizations add column if not exists mercado_pago_checkout_url text;
alter table organizations add column if not exists subscription_current_period_end timestamptz;
alter table organizations add column if not exists subscription_last_payment_id text;
alter table organizations add column if not exists subscription_last_synced_at timestamptz;
alter table organizations add column if not exists subscription_billing_interval text;

update organizations
set subscription_status = coalesce(subscription_status, 'trialing'),
    trial_started_at = coalesce(trial_started_at, created_at),
    trial_ends_at = coalesce(trial_ends_at, created_at + interval '30 days')
where subscription_status is null
   or trial_started_at is null
   or trial_ends_at is null;

alter table organizations alter column subscription_status set default 'trialing';
alter table organizations alter column trial_started_at set default now();
alter table organizations alter column trial_ends_at set default now() + interval '30 days';
alter table organizations alter column subscription_billing_interval set default 'monthly';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'organizations_subscription_status_check'
  ) then
    alter table organizations add constraint organizations_subscription_status_check
      check (subscription_status in ('trialing', 'pending', 'active', 'past_due', 'canceled', 'expired'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'organizations_subscription_billing_interval_check'
  ) then
    alter table organizations add constraint organizations_subscription_billing_interval_check
      check (subscription_billing_interval in ('monthly', 'yearly'));
  end if;
end $$;

create table if not exists billing_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'mercadopago',
  provider_event_id text,
  provider_resource_id text,
  event_type text,
  action text,
  organization_id uuid references organizations(id) on delete set null,
  payload jsonb not null,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

create index if not exists billing_events_resource_idx on billing_events (provider, provider_resource_id);
create index if not exists organizations_subscription_status_idx on organizations (subscription_status);
