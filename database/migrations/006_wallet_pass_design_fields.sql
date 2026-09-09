alter table wallet_card_settings
  add column if not exists background_color text not null default '#F8F3E8' check (background_color ~ '^#[0-9A-Fa-f]{6}$'),
  add column if not exists text_color text not null default '#173D20' check (text_color ~ '^#[0-9A-Fa-f]{6}$'),
  add column if not exists progress_label text not null default 'compras',
  add column if not exists reward_title text,
  add column if not exists accumulation_text text,
  add column if not exists completed_message text not null default 'Sua recompensa está disponível!',
  add column if not exists terms_text text,
  add column if not exists website_url text,
  add column if not exists instagram_username text,
  add column if not exists contact_phone text,
  add column if not exists address_text text;

alter table wallet_passes
  add column if not exists authentication_token text,
  add column if not exists updated_at timestamptz not null default now();
