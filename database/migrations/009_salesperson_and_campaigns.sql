alter table organizations
  add column if not exists salesperson_name text;

create index if not exists loyalty_programs_org_created_idx
  on loyalty_programs (organization_id, created_at desc);
