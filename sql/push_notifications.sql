-- Device push token registry for backend-triggered APNs notifications

create table if not exists push_tokens (
  id uuid primary key default gen_random_uuid(),
  device_id text not null,
  user_id uuid references users(id) on delete set null,
  push_token text not null unique,
  platform text not null default 'ios',
  app_version text,
  build_number text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_push_tokens_device_id on push_tokens(device_id);
create index if not exists idx_push_tokens_user_id on push_tokens(user_id);
create index if not exists idx_push_tokens_last_seen_at on push_tokens(last_seen_at desc);

create or replace function set_push_tokens_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_push_tokens_updated_at on push_tokens;
create trigger trg_push_tokens_updated_at
before update on push_tokens
for each row execute function set_push_tokens_updated_at();
