alter table organizations add column if not exists tax_id text;
alter table customers add column if not exists first_name text;
alter table customers add column if not exists last_name text;

create index if not exists organizations_tax_id_idx on organizations (tax_id);
