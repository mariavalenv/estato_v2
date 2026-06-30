-- User-specific actions on shared inventory listings.
-- Replaces the pattern of copying inventory rows per user.
create table if not exists user_match_actions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade not null,
  match_id   uuid references matches(id) on delete cascade not null,
  action     text check (action in ('approved', 'rejected', 'viewed')) not null,
  note       text,
  created_at timestamptz default now(),
  unique(user_id, match_id)
);

alter table user_match_actions enable row level security;

create policy "users manage own actions"
  on user_match_actions for all using (auth.uid() = user_id);

-- Allow authenticated users to read inventory (the shared pool where user_id is null).
-- The existing "users see own matches" policy already covers user-specific rows;
-- this adds a separate select path for inventory-only reads.
create policy "authenticated users can read inventory"
  on matches for select
  using (user_id is null);

-- Index for fast inventory queries by city and type
create index if not exists matches_inventory_city_type
  on matches((data->>'city'), type)
  where user_id is null;

-- Index to quickly find unenriched inventory (agent_reasoning is null)
create index if not exists matches_inventory_unenriched
  on matches(type, created_at)
  where user_id is null and agent_reasoning is null;
