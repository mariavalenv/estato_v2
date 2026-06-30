-- Behavioural event log for future ML training.
-- Safe to paste into the Supabase SQL editor (idempotent).

create table if not exists user_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade,
  session_id uuid,
  event_type text not null,
  listing_id text,                          -- text so dummy ids ('dl1') and real uuids both fit
  metadata   jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- Indexes for the queries an ML/export job will actually run.
create index if not exists user_events_user_idx    on user_events (user_id, created_at);
create index if not exists user_events_type_idx    on user_events (event_type);
create index if not exists user_events_listing_idx on user_events (listing_id);
create index if not exists user_events_session_idx on user_events (session_id);

alter table user_events enable row level security;

-- Users may only write/read their OWN events (the client uses the anon key +
-- the logged-in user's session). Anonymous events can't satisfy this and are
-- kept client-side until the user logs in.
create policy "users insert own events"
  on user_events for insert with check (auth.uid() = user_id);

create policy "users read own events"
  on user_events for select using (auth.uid() = user_id);
