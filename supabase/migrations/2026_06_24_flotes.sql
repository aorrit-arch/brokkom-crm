-- =====================================================================
-- BROKKOM CRM · Mòdul FLOTES  ·  2026_06_24_flotes.sql
--
-- Integra l'eina de flotes dins el CRM. Cada flota penja d'un CLIENT
-- (client_id). Si el client no existeix quan es crea/importa la flota,
-- el codi del CRM el crearà i hi enllaçarà (una sola base de dades).
-- Un client pot tenir diverses flotes (1 -> N).
--
-- IDEMPOTENT i SEGUR: tot "if not exists", no esborra ni altera res.
-- =====================================================================

-- ---------------------------------------------------------------------
-- FLOTES (capçalera, lligada al client)
-- ---------------------------------------------------------------------
create table if not exists public.flotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  created_at timestamptz default now()
);
alter table public.flotes add column if not exists mediador_id uuid references public.mediadors(id) on delete set null;
alter table public.flotes add column if not exists empresa text;                 -- còpia del nom per comoditat
alter table public.flotes add column if not exists asseguradora_actual text;
alter table public.flotes add column if not exists prima_global_override numeric;
alter table public.flotes add column if not exists ambit text default 'Nacional';
alter table public.flotes add column if not exists adr boolean default false;
alter table public.flotes add column if not exists venciment date;
alter table public.flotes add column if not exists tasa_dp numeric default 4;     -- % per al tarificador de danys propis
alter table public.flotes add column if not exists min_dp numeric default 150;    -- prima DP mínima
alter table public.flotes add column if not exists comprum boolean default false;
alter table public.flotes add column if not exists estat text default 'dades';    -- dades/mercat/oferta/negociacio/tancada
alter table public.flotes add column if not exists sini_anual_manual numeric;     -- cost sinistral anual si no hi ha loss run
alter table public.flotes add column if not exists notes text;
alter table public.flotes add column if not exists updated_at timestamptz default now();

-- ---------------------------------------------------------------------
-- FLOTA_VEHICLES (el parc)
-- ---------------------------------------------------------------------
create table if not exists public.flota_vehicles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  flota_id uuid references public.flotes(id) on delete cascade,
  created_at timestamptz default now()
);
alter table public.flota_vehicles add column if not exists mat text;             -- matrícula
alter table public.flota_vehicles add column if not exists tipus text;           -- Tractora/Camió, Remolc...
alter table public.flota_vehicles add column if not exists model text;
alter table public.flota_vehicles add column if not exists valor numeric;
alter table public.flota_vehicles add column if not exists venciment date;
alter table public.flota_vehicles add column if not exists prima_rc numeric;
alter table public.flota_vehicles add column if not exists prima_dp_ov numeric;  -- override manual de prima DP

-- ---------------------------------------------------------------------
-- FLOTA_SINISTRES (loss run)
-- ---------------------------------------------------------------------
create table if not exists public.flota_sinistres (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  flota_id uuid references public.flotes(id) on delete cascade,
  created_at timestamptz default now()
);
alter table public.flota_sinistres add column if not exists num text;            -- número de sinistre
alter table public.flota_sinistres add column if not exists mat text;
alter table public.flota_sinistres add column if not exists causa text;          -- R.C., LUNAS, CICOS DEUDOR...
alter table public.flota_sinistres add column if not exists tipo text;           -- Culpa, Reclamación, Daños propios...
alter table public.flota_sinistres add column if not exists estado text;         -- Abierto / Cerrado
alter table public.flota_sinistres add column if not exists f_sin date;
alter table public.flota_sinistres add column if not exists imp numeric default 0;
alter table public.flota_sinistres add column if not exists periode text;        -- 2024/25...
alter table public.flota_sinistres add column if not exists dp boolean default false; -- és danys propis

-- ---------------------------------------------------------------------
-- FLOTA_OFERTES (comparativa de companyies)
-- ---------------------------------------------------------------------
create table if not exists public.flota_ofertes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  flota_id uuid references public.flotes(id) on delete cascade,
  created_at timestamptz default now()
);
alter table public.flota_ofertes add column if not exists cia text;
alter table public.flota_ofertes add column if not exists comprum boolean default false;
alter table public.flota_ofertes add column if not exists prima numeric;
alter table public.flota_ofertes add column if not exists garanties jsonb default '{"rc":1,"danys":1,"llunes":1,"assist":1,"defensa":1,"robatori":1}'::jsonb;
alter table public.flota_ofertes add column if not exists franquicia numeric;
alter table public.flota_ofertes add column if not exists comissio numeric;       -- % comissió Brokkom (intern)
alter table public.flota_ofertes add column if not exists pros text;
alter table public.flota_ofertes add column if not exists contres text;
alter table public.flota_ofertes add column if not exists presentar boolean default true;

-- ---------------------------------------------------------------------
-- FLOTA_TASQUES (renovació, amb subtasques per CIA)
-- ---------------------------------------------------------------------
create table if not exists public.flota_tasques (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  flota_id uuid references public.flotes(id) on delete cascade,
  created_at timestamptz default now()
);
alter table public.flota_tasques add column if not exists text text;
alter table public.flota_tasques add column if not exists bloqueja text;          -- CIA / Client / Intern
alter table public.flota_tasques add column if not exists data date;
alter table public.flota_tasques add column if not exists estat text default 'obert';
alter table public.flota_tasques add column if not exists subtasks jsonb default '[]'::jsonb;

-- Índexs per a les consultes habituals
create index if not exists flotes_client_idx on public.flotes(client_id);
create index if not exists flota_vehicles_flota_idx on public.flota_vehicles(flota_id);
create index if not exists flota_sinistres_flota_idx on public.flota_sinistres(flota_id);
create index if not exists flota_ofertes_flota_idx on public.flota_ofertes(flota_id);
create index if not exists flota_tasques_flota_idx on public.flota_tasques(flota_id);

-- ---------------------------------------------------------------------
-- RLS · mateix model que la resta del CRM ("equip autenticat ho fa tot")
-- ---------------------------------------------------------------------
do $$
declare t text;
declare taules text[] := array['flotes','flota_vehicles','flota_sinistres','flota_ofertes','flota_tasques'];
begin
  foreach t in array taules loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "equip_tot" on public.%I;', t);
    execute format(
      'create policy "equip_tot" on public.%I for all
         using (auth.uid() is not null) with check (auth.uid() is not null);', t);
  end loop;
end$$;
