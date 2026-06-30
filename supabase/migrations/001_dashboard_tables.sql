-- Matches table
create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  type text check (type in ('listing', 'flatmate')) not null,
  score integer check (score >= 0 and score <= 100) not null,
  status text check (status in (
    'pending', 'approved', 'rejected', 'contacted', 'viewing_scheduled'
  )) default 'pending',
  data jsonb not null,
  match_reasons text[] default '{}',
  trade_offs text[] default '{}',
  agent_reasoning text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Agent activity log
create table if not exists agent_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  action text not null,
  detail text,
  created_at timestamptz default now()
);

-- Agent status per user
create table if not exists agent_status (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade unique,
  is_active boolean default true,
  current_task text default 'Reviewing options',
  options_reviewed integer default 0,
  strong_matches_found integer default 0,
  confidence text check (confidence in ('Low', 'Medium', 'High')) default 'Medium',
  next_update_at timestamptz default now() + interval '2 hours',
  updated_at timestamptz default now()
);

-- Conversations
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references matches(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  other_user_id uuid references auth.users(id) on delete cascade,
  last_message text,
  last_message_at timestamptz,
  created_at timestamptz default now()
);

-- Messages
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete cascade,
  content text not null,
  created_at timestamptz default now()
);

-- Row level security
alter table matches enable row level security;
alter table agent_activity enable row level security;
alter table agent_status enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;

-- Policies: users can only see their own data
create policy "users see own matches"
  on matches for all using (auth.uid() = user_id);

create policy "users see own activity"
  on agent_activity for all using (auth.uid() = user_id);

create policy "users see own agent status"
  on agent_status for all using (auth.uid() = user_id);

create policy "users see own conversations"
  on conversations for all
  using (auth.uid() = user_id or auth.uid() = other_user_id);

create policy "users see own messages"
  on messages for all
  using (
    conversation_id in (
      select id from conversations
      where user_id = auth.uid() or other_user_id = auth.uid()
    )
  );
