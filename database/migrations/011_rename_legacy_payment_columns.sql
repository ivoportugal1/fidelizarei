do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'organizations' and column_name = 'mercado_pago_preapproval_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_name = 'organizations' and column_name = 'payment_provider_subscription_id'
  ) then
    alter table organizations rename column mercado_pago_preapproval_id to payment_provider_subscription_id;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_name = 'organizations' and column_name = 'mercado_pago_checkout_url'
  ) and not exists (
    select 1 from information_schema.columns
    where table_name = 'organizations' and column_name = 'payment_checkout_url'
  ) then
    alter table organizations rename column mercado_pago_checkout_url to payment_checkout_url;
  end if;
end $$;

alter table organizations add column if not exists payment_provider_subscription_id text;
alter table organizations add column if not exists payment_checkout_url text;

update billing_events
set provider = 'stripe'
where provider in ('mercadopago', 'asaas');
