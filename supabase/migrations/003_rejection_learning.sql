-- Rejection reasons captured per match
create table if not exists rejection_reasons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  match_id uuid references matches(id) on delete cascade,
  match_type text check (match_type in ('listing', 'flatmate')),
  reasons text[] not null default '{}',
  free_text text,
  created_at timestamptz default now()
);

-- Learned preference updates derived from rejection patterns
create table if not exists preference_updates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  field_updated text not null,
  previous_value jsonb,
  new_value jsonb,
  derived_from_rejections uuid[] default '{}',
  confidence text check (
    confidence in ('low', 'medium', 'high')
  ) default 'medium',
  accepted_by_user boolean default true,
  agent_explanation text not null,
  created_at timestamptz default now()
);

-- RLS
alter table rejection_reasons enable row level security;
alter table preference_updates enable row level security;

create policy "users manage own rejection reasons"
  on rejection_reasons for all using (auth.uid() = user_id);

create policy "users manage own preference updates"
  on preference_updates for all using (auth.uid() = user_id);

-- Indexes for pattern detection queries
create index rejection_reasons_user_id_created_at
  on rejection_reasons(user_id, created_at desc);

create index preference_updates_user_id_created_at
  on preference_updates(user_id, created_at desc);

-- Add learned_overrides to search_preferences so high-confidence updates
-- can be merged in without mutating the original screened values
alter table search_preferences
  add column if not exists learned_overrides jsonb default '{}';
