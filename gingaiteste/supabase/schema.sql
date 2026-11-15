-- gingaiteste: banco completo para um projeto Supabase NOVO.
-- Cole tudo no SQL Editor do painel e clique em Run. Pode rodar de novo sem quebrar.
--
-- Este arquivo foi reconstruído a partir de apps/web/src/lib/supabase/types.ts e do uso
-- que o app faz de cada tabela. As migrations originais do projeto do professor não
-- vieram junto, então as regras de acesso (RLS) abaixo são a nossa versão, não a dele.

create extension if not exists pgcrypto;

-- ---------- tipos ----------
do $$ begin
  create type public.event_visibility as enum ('public', 'private');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.user_role as enum ('user', 'admin');
exception when duplicate_object then null; end $$;

-- ---------- tabelas ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null default '',
  avatar_url text,
  role public.user_role not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.events (
  code text primary key,
  name text not null,
  style text,
  visibility public.event_visibility not null default 'public',
  owner_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.participant_scores (
  event_code text not null references public.events (code) on delete cascade,
  participant_id text not null,
  nickname text not null,
  avatar_url text,
  points double precision not null default 0,
  dance_seconds double precision not null default 0,
  top_style text,
  current_style text,
  simulated boolean not null default false,
  user_id uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (event_code, participant_id)
);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  points double precision not null default 0,
  dance_seconds double precision not null default 0,
  max_combo double precision not null default 0,
  top_style text,
  style_seconds jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.dance_styles_catalog (
  slug text primary key,
  name text not null,
  emoji text not null default '🎶',
  is_control boolean not null default false,
  sort_order integer not null default 100,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.collection_recordings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id text,
  label text not null,
  duration_s double precision not null default 0,
  windows jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, client_id)
);

create table if not exists public.trained_models (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  model jsonb not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);
-- no máximo um modelo ativo por pessoa (o app desativa o anterior antes de inserir)
create unique index if not exists trained_models_one_active
  on public.trained_models (user_id) where is_active;

create table if not exists public.global_models (
  id integer primary key default 1,
  model jsonb not null,
  users_count integer not null default 0,
  windows_count integer not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists events_public_idx on public.events (visibility, created_at desc);
create index if not exists events_owner_idx on public.events (owner_id);
create index if not exists sessions_user_idx on public.sessions (user_id);

-- ---------- funções ----------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- cria o perfil no primeiro login com o nome e a foto do Google
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nickname, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- impede que alguém se promova a admin editando o próprio perfil
create or replace function public.protect_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- auth.uid() nulo = comando rodado pelo SQL Editor do painel (dono do banco): liberado.
  -- Pelo site, só um admin consegue mudar o papel de alguém.
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.is_admin() then
    new.role := old.role;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role
  before update on public.profiles
  for each row execute function public.protect_role();

-- ---------- RLS ----------
alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.participant_scores enable row level security;
alter table public.sessions enable row level security;
alter table public.dance_styles_catalog enable row level security;
alter table public.collection_recordings enable row level security;
alter table public.trained_models enable row level security;
alter table public.global_models enable row level security;

-- profiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  using (id = auth.uid() or public.is_admin());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update
  using (id = auth.uid() or public.is_admin());

-- events: qualquer um lê (festa privada só não aparece na lista; entra-se pelo código);
-- criar exige login, como no README do projeto original
drop policy if exists events_select on public.events;
create policy events_select on public.events for select using (true);
drop policy if exists events_insert on public.events;
create policy events_insert on public.events for insert
  with check (auth.uid() is not null and owner_id = auth.uid());
drop policy if exists events_update on public.events;
create policy events_update on public.events for update
  using (owner_id = auth.uid() or public.is_admin());
drop policy if exists events_delete on public.events;
create policy events_delete on public.events for delete
  using (owner_id = auth.uid() or public.is_admin());

-- participant_scores: participante pode ser anônimo (só apelido)
drop policy if exists scores_select on public.participant_scores;
create policy scores_select on public.participant_scores for select using (true);
drop policy if exists scores_insert on public.participant_scores;
create policy scores_insert on public.participant_scores for insert
  with check (user_id is null or user_id = auth.uid());
drop policy if exists scores_update on public.participant_scores;
create policy scores_update on public.participant_scores for update
  using (user_id is null or user_id = auth.uid())
  with check (user_id is null or user_id = auth.uid());
drop policy if exists scores_delete on public.participant_scores;
create policy scores_delete on public.participant_scores for delete
  using (
    public.is_admin()
    or user_id = auth.uid()
    or exists (select 1 from public.events e where e.code = event_code and e.owner_id = auth.uid())
  );

-- sessions
drop policy if exists sessions_own on public.sessions;
create policy sessions_own on public.sessions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists sessions_admin on public.sessions;
create policy sessions_admin on public.sessions for select using (public.is_admin());

-- catálogo de estilos: todos leem, só admin muda
drop policy if exists styles_select on public.dance_styles_catalog;
create policy styles_select on public.dance_styles_catalog for select using (true);
drop policy if exists styles_admin on public.dance_styles_catalog;
create policy styles_admin on public.dance_styles_catalog for all
  using (public.is_admin()) with check (public.is_admin());

-- gravações de coleta
drop policy if exists recordings_own on public.collection_recordings;
create policy recordings_own on public.collection_recordings for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists recordings_admin on public.collection_recordings;
create policy recordings_admin on public.collection_recordings for select using (public.is_admin());

-- modelos treinados
drop policy if exists models_own on public.trained_models;
create policy models_own on public.trained_models for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- modelo global: todos leem, só admin escreve
drop policy if exists global_select on public.global_models;
create policy global_select on public.global_models for select using (true);
drop policy if exists global_admin on public.global_models;
create policy global_admin on public.global_models for all
  using (public.is_admin()) with check (public.is_admin());

-- ---------- Realtime (ranking ao vivo) ----------
do $$ begin
  alter publication supabase_realtime add table public.participant_scores;
exception when duplicate_object then null; end $$;

-- ---------- dados iniciais ----------
insert into public.dance_styles_catalog (slug, name, emoji, is_control, sort_order) values
  ('forro',  'Forró',           '🪗', false, 10),
  ('samba',  'Samba',           '🥁', false, 20),
  ('funk',   'Funk',            '🔊', false, 30),
  ('parado', 'Parado',          '🧍', true,  90),
  ('outro',  'Outro movimento', '🚶', true,  91)
on conflict (slug) do nothing;

-- Depois do seu primeiro login no site, rode (trocando o e-mail) para virar admin:
-- update public.profiles set role = 'admin'
--   where id = (select id from auth.users where email = 'seu-email@gmail.com');
