create table if not exists agent_permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade unique,
  can_contact_landlords boolean default false,
  auto_reject_below_score integer default 60,
  can_initiate_introductions boolean default false,
  max_budget integer,
  max_commute_minutes integer default 45,
  voice_briefings_enabled boolean default true,
  briefing_frequency text check (
    briefing_frequency in ('on_demand', 'daily', 'important_only')
  ) default 'important_only',
  updated_at timestamptz default now()
);

alter table agent_permissions enable row level security;

create policy "users manage own permissions"
  on agent_permissions for all using (auth.uid() = user_id);
