-- User memory profile, session-scoped conversations, and a listings table.
-- Safe to paste into the Supabase SQL editor (everything is idempotent).

-- ─── 1. User memory ───────────────────────────────────────────────────────────
-- One JSON memory blob per user. Claude reads it on every call and rewrites it
-- at the end of a session (budget, city, preferred_neighbourhoods, property_type,
-- deal_breakers, timeline, personal_notes, …).
create table if not exists user_memory (
  user_id    uuid references auth.users(id) on delete cascade primary key,
  memory     jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

alter table user_memory enable row level security;

create policy "users manage own memory"
  on user_memory for all using (auth.uid() = user_id);


-- ─── 2. Session conversations ─────────────────────────────────────────────────
-- The screening chat log already lives in `screening_messages` (the name
-- `conversations` is taken by the matched-user DM feature in migration 001).
-- Add a session_id so each page-load visit is its own fresh conversation.
alter table screening_messages
  add column if not exists session_id uuid;

-- Fast fetch of "just this session's messages, in order".
create index if not exists screening_messages_session_idx
  on screening_messages (user_id, session_id, created_at);


-- ─── 3. Listings ──────────────────────────────────────────────────────────────
-- Properties the assistant filters over. Columns map 1:1 to the filter keys in
-- src/lib/filters.js (FILTER_COLUMN_MAP) — adjust both together if your real
-- table differs. `create table if not exists` will NOT clobber an existing table.
create table if not exists listings (
  id            uuid primary key default gen_random_uuid(),
  title         text,
  city          text,
  neighbourhood text,
  price         integer,            -- monthly rent, used for budget filter
  property_type text,               -- 'flat' | 'studio' | 'room' | 'house' …
  bedrooms      integer,
  furnished     boolean default false,
  pet_friendly  boolean default false,
  bills_included boolean default false,
  floor         integer,            -- for min_floor / "not ground floor"
  orientation   text,               -- 'north' | 'south' | 'east' | 'west'
  near_metro    boolean default false,
  image         text,
  data          jsonb default '{}'::jsonb,  -- full listing payload for the UI
  created_at    timestamptz default now()
);

create index if not exists listings_city_price_idx on listings (city, price);
create index if not exists listings_neighbourhood_idx on listings (neighbourhood);

alter table listings enable row level security;

-- Listings are public catalogue data: any signed-in user may read them.
create policy "authenticated users read listings"
  on listings for select using (auth.role() = 'authenticated');
