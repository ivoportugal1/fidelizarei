create table if not exists wallet_card_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  filename text not null,
  content_type text not null check (content_type in ('image/png', 'image/jpeg', 'image/webp')),
  data bytea not null,
  created_at timestamptz not null default now()
);

create table if not exists wallet_card_settings (
  organization_id uuid primary key references organizations(id) on delete cascade,
  program_id uuid not null references loyalty_programs(id) on delete cascade,
  business_name text not null,
  program_description text not null,
  reward_text text not null,
  points_goal integer not null check (points_goal between 1 and 20),
  point_theme text not null default 'universal' check (point_theme in ('cafeteria', 'acaiteria', 'sorveteria', 'pizzaria', 'hamburgueria', 'padaria', 'barbearia', 'petshop', 'universal')),
  primary_color text not null default '#173D20' check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  secondary_color text not null default '#F2B80F' check (secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
  logo_asset_id uuid references wallet_card_assets(id) on delete set null,
  cover_asset_id uuid references wallet_card_assets(id) on delete set null,
  updated_at timestamptz not null default now()
);
