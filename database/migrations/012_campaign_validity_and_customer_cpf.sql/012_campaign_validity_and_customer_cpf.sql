alter table loyalty_programs
  add column if not exists valid_until date;

alter table customers
  add column if not exists cpf_hash text;

create unique index if not exists customers_organization_cpf_hash_unique
  on customers (organization_id, cpf_hash)
  where cpf_hash is not null;
