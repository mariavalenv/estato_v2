-- Favourites table for saved listings/flatmates
create table if not exists favourites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  listing_id uuid not null,
  listing_data jsonb default '{}'::jsonb,
  note text default '',
  created_at timestamptz default now(),
  unique(user_id, listing_id)
);

-- Match decisions table for tracking swipe decisions
create table if not exists match_decisions (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null,
  decision text check (decision in ('keep', 'pass')) not null,
  decided_at timestamptz default now(),
  unique(match_id)
);
