alter table organizations add column if not exists subscription_coupon_code text;

create index if not exists organizations_subscription_coupon_code_idx on organizations (subscription_coupon_code);
