-- SBO:Rebirth Wiki Data Schema for Supabase
-- Run in Supabase Dashboard → SQL Editor

-- Weapons (from wiki-raw weapons.json)
create table if not exists wiki_weapons (
  id uuid default gen_random_uuid() primary key,
  name text unique not null,
  attack int,
  skill_req int,
  skill_max boolean default false,
  col_value int,
  location text,
  weapon_type text,
  wiki_url text,
  extracted_at timestamptz default now()
);

-- Armor (from wiki-raw armor.json)
create table if not exists wiki_armor (
  id uuid default gen_random_uuid() primary key,
  name text unique not null,
  level_req int,
  defense numeric,
  dexterity int,
  worth int,
  how_to_obtain text,
  wiki_url text,
  extracted_at timestamptz default now()
);

-- Shields (from wiki-raw shields.json)
create table if not exists wiki_shields (
  id uuid default gen_random_uuid() primary key,
  name text unique not null,
  level_req int,
  defense numeric,
  dexterity int,
  worth int,
  how_to_obtain text,
  wiki_url text,
  extracted_at timestamptz default now()
);

-- Bosses (from wiki-raw bosses.json)
create table if not exists wiki_bosses (
  id uuid default gen_random_uuid() primary key,
  name text unique not null,
  hp bigint,
  rec_level int,
  exp int,
  col int,
  respawn text,
  location text,
  drops text,
  rare_drops text,
  last_hit_bonus text,
  wiki_url text,
  extracted_at timestamptz default now()
);

-- Enable RLS — allow anon to read and write (for wiki-to-supabase.js sync)
alter table wiki_weapons enable row level security;
alter table wiki_armor enable row level security;
alter table wiki_shields enable row level security;
alter table wiki_bosses enable row level security;

create policy "Allow anon all" on wiki_weapons for all using (true) with check (true);
create policy "Allow anon all" on wiki_armor for all using (true) with check (true);
create policy "Allow anon all" on wiki_shields for all using (true) with check (true);
create policy "Allow anon all" on wiki_bosses for all using (true) with check (true);
