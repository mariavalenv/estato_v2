-- Screening chat history
--
-- NOTE: the per-message screening log is called `screening_messages` (NOT
-- `conversations`, which already exists for matched-user DMs in migration 001).

-- One row per screening-chat message (user + assistant), in send order.
create table if not exists screening_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role text check (role in ('user', 'assistant')) not null,
  content text not null,
  created_at timestamptz default now()
);

-- Fast history fetch: all of a user's messages in chronological order.
create index if not exists screening_messages_user_created_idx
  on screening_messages (user_id, created_at);

-- Row level security: users can only read/write their own messages.
alter table screening_messages enable row level security;

create policy "users see own screening messages"
  on screening_messages for all using (auth.uid() = user_id);
