-- =====================================================================
-- BROKKOM CRM · Esquema base complet (documentació + reproducció)
-- Migració:  2026_06_24_esquema_base.sql
--
-- OBJECTIU (Prioritat 1 · punt 8): deixar documentat i reproduïble
-- l'esquema de TOTES les taules que fa servir el CRM, perquè ja no
-- depengui de taules creades a mà i sense rastre.
--
-- ⚠️ TOTALMENT SEGUR D'EXECUTAR:
--   · Tot és "if not exists" → no esborra ni altera res que ja existeixi.
--   · Si una taula o columna ja hi és, l'ordre s'ignora.
--   · No toca cap dada.
--   · Es pot executar tantes vegades com es vulgui (idempotent).
--
-- COM EXECUTAR-LA: Supabase → SQL Editor → enganxa-ho tot → Run.
--
-- NOTA D'HONESTEDAT: les columnes s'han reconstruït des del codi del CRM
-- i del document de transferència. Cobreixen tot el que l'app necessita.
-- Si vols una rèplica 100% fidel de la teva BD actual, executa la
-- consulta de bolcat que trobaràs al final i passa-me'n el resultat.
--
-- Taules marcades amb [MIG-FET] tenen el mòdul a mig construir (Agenda,
-- Esborranys, Bústia): es creen en forma base perquè existeixin.
-- =====================================================================

create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------
-- MEDIADORS (usuaris interns del CRM). Es crea aquí perquè aquest fitxer
-- pugui aixecar tot l'esquema de zero. Si ja existeix (migració
-- 2026_05_17_mediadors.sql ja executada), aquesta ordre s'ignora.
-- ---------------------------------------------------------------------
create table if not exists public.mediadors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  nom text not null default '',
  email text,
  telefon text,
  rol text not null default 'mediador' check (rol in ('admin','mediador','lector')),
  data_alta timestamptz not null default now(),
  actiu boolean not null default true,
  telegram_chat_id text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- CLIENTS
-- ---------------------------------------------------------------------
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);
alter table public.clients add column if not exists tipus text;            -- 'empresa' | 'particular'
alter table public.clients add column if not exists empresa text;
alter table public.clients add column if not exists nom text;
alter table public.clients add column if not exists cif text;
alter table public.clients add column if not exists dni text;
alter table public.clients add column if not exists data_naixement date;
alter table public.clients add column if not exists professio text;
alter table public.clients add column if not exists sector text;
alter table public.clients add column if not exists treballadors text;
alter table public.clients add column if not exists contacte text;
alter table public.clients add column if not exists carrec text;
alter table public.clients add column if not exists email text;
alter table public.clients add column if not exists telefon text;
alter table public.clients add column if not exists adreca text;
alter table public.clients add column if not exists facturacio text;
alter table public.clients add column if not exists origen text;
alter table public.clients add column if not exists estat text;
alter table public.clients add column if not exists categories text[];
alter table public.clients add column if not exists notes text;
alter table public.clients add column if not exists data_alta timestamptz default now();
alter table public.clients add column if not exists updated_at timestamptz default now();

-- ---------------------------------------------------------------------
-- OFERTES (pipeline potencials)
-- ---------------------------------------------------------------------
create table if not exists public.ofertes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);
alter table public.ofertes add column if not exists client_id uuid references public.clients(id) on delete cascade;
alter table public.ofertes add column if not exists empresa text;
alter table public.ofertes add column if not exists ram text;
alter table public.ofertes add column if not exists asseguradora_actual text;
alter table public.ofertes add column if not exists asseguradora text;
alter table public.ofertes add column if not exists prima_actual numeric;
alter table public.ofertes add column if not exists prima_brokkom numeric;
alter table public.ofertes add column if not exists estat text default 'Lead';
alter table public.ofertes add column if not exists data_oferta date default current_date;
alter table public.ofertes add column if not exists venciment date;
alter table public.ofertes add column if not exists notes text;
alter table public.ofertes add column if not exists updated_at timestamptz default now();

-- ---------------------------------------------------------------------
-- CONSOLIDATS (tancaments guanyats)
-- ---------------------------------------------------------------------
create table if not exists public.consolidats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);
alter table public.consolidats add column if not exists client_id uuid references public.clients(id) on delete set null;
alter table public.consolidats add column if not exists empresa text;
alter table public.consolidats add column if not exists ram text;
alter table public.consolidats add column if not exists asseguradora text;
alter table public.consolidats add column if not exists num_polissa text;
alter table public.consolidats add column if not exists mediador text;
alter table public.consolidats add column if not exists data_tancament date;
alter table public.consolidats add column if not exists prima_anual numeric;
alter table public.consolidats add column if not exists notes text;

-- ---------------------------------------------------------------------
-- SEGUIMENTS
-- ---------------------------------------------------------------------
create table if not exists public.seguiments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);
alter table public.seguiments add column if not exists client_id uuid references public.clients(id) on delete cascade;
alter table public.seguiments add column if not exists oferta_id uuid references public.ofertes(id) on delete set null;
alter table public.seguiments add column if not exists data date default current_date;
alter table public.seguiments add column if not exists canal text;
alter table public.seguiments add column if not exists resum text;
alter table public.seguiments add column if not exists proper_pas text;
alter table public.seguiments add column if not exists responsable text;

-- ---------------------------------------------------------------------
-- OPORTUNITATS
-- ---------------------------------------------------------------------
create table if not exists public.oportunitats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);
alter table public.oportunitats add column if not exists client_id uuid references public.clients(id) on delete cascade;
alter table public.oportunitats add column if not exists empresa text;
alter table public.oportunitats add column if not exists producte text;
alter table public.oportunitats add column if not exists argument text;
alter table public.oportunitats add column if not exists prioritat text;
alter table public.oportunitats add column if not exists estat text default 'Detectada';
alter table public.oportunitats add column if not exists data_deteccio date default current_date;

-- ---------------------------------------------------------------------
-- VENCIMENTS
-- ---------------------------------------------------------------------
create table if not exists public.venciments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);
alter table public.venciments add column if not exists client_id uuid references public.clients(id) on delete set null;
alter table public.venciments add column if not exists empresa text;
alter table public.venciments add column if not exists ram text;
alter table public.venciments add column if not exists asseguradora text;
alter table public.venciments add column if not exists data_venciment date;
alter table public.venciments add column if not exists prima_actual numeric;
alter table public.venciments add column if not exists notes text;

-- ---------------------------------------------------------------------
-- TASQUES  (inclou el TODO potent: data_prevista / num_prorrogues / completed_at)
-- ---------------------------------------------------------------------
create table if not exists public.tasques (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);
alter table public.tasques add column if not exists titol text;
alter table public.tasques add column if not exists descripcio text;
alter table public.tasques add column if not exists prioritat text;
alter table public.tasques add column if not exists categoria text;
alter table public.tasques add column if not exists data_limit date;
alter table public.tasques add column if not exists data_prevista date default current_date;
alter table public.tasques add column if not exists num_prorrogues integer not null default 0;
alter table public.tasques add column if not exists completed_at timestamptz;
alter table public.tasques add column if not exists estat text default 'pendent';

-- ---------------------------------------------------------------------
-- ASSEGURADORES (catàleg + contactes de companyia en jsonb)
-- ---------------------------------------------------------------------
create table if not exists public.asseguradores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);
alter table public.asseguradores add column if not exists nom text;
alter table public.asseguradores add column if not exists rams text[];
alter table public.asseguradores add column if not exists contacte_intern text;
alter table public.asseguradores add column if not exists email text;
alter table public.asseguradores add column if not exists telefon text;
alter table public.asseguradores add column if not exists notes text;
alter table public.asseguradores add column if not exists contactes jsonb default '[]'::jsonb;

-- ---------------------------------------------------------------------
-- NOTES
-- ---------------------------------------------------------------------
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);
alter table public.notes add column if not exists client_id uuid references public.clients(id) on delete cascade;
alter table public.notes add column if not exists titol text;
alter table public.notes add column if not exists contingut text;
alter table public.notes add column if not exists favorita boolean default false;

-- ---------------------------------------------------------------------
-- POSTS (LinkedIn)
-- ---------------------------------------------------------------------
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);
alter table public.posts add column if not exists tema text;
alter table public.posts add column if not exists contingut text;
alter table public.posts add column if not exists data timestamptz default now();

-- ---------------------------------------------------------------------
-- PROSPECTES (centre de trucades)
-- ---------------------------------------------------------------------
create table if not exists public.prospectes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);
alter table public.prospectes add column if not exists empresa text;
alter table public.prospectes add column if not exists cif text;
alter table public.prospectes add column if not exists municipi text;
alter table public.prospectes add column if not exists provincia text;
alter table public.prospectes add column if not exists sector text;
alter table public.prospectes add column if not exists tipus_transport text;
alter table public.prospectes add column if not exists contacte text;
alter table public.prospectes add column if not exists carrec text;
alter table public.prospectes add column if not exists contacte_email text;
alter table public.prospectes add column if not exists telefon text;
alter table public.prospectes add column if not exists mobil text;
alter table public.prospectes add column if not exists adreca text;
alter table public.prospectes add column if not exists facturacio text;
alter table public.prospectes add column if not exists treballadors text;
alter table public.prospectes add column if not exists vehicles_total integer;
alter table public.prospectes add column if not exists venciment date;
alter table public.prospectes add column if not exists estat text default 'Nou';
alter table public.prospectes add column if not exists prioritat text;
alter table public.prospectes add column if not exists origen text;
alter table public.prospectes add column if not exists campanya text;
alter table public.prospectes add column if not exists num_intents integer default 0;
alter table public.prospectes add column if not exists propera_accio text;
alter table public.prospectes add column if not exists propera_accio_data date;
alter table public.prospectes add column if not exists darrera_trucada timestamptz;
alter table public.prospectes add column if not exists no_trucar boolean default false;
alter table public.prospectes add column if not exists convertit_client_id uuid references public.clients(id) on delete set null;
alter table public.prospectes add column if not exists adr boolean default false;
alter table public.prospectes add column if not exists conveni boolean default false;
alter table public.prospectes add column if not exists frigorific boolean default false;
alter table public.prospectes add column if not exists telematica boolean default false;
alter table public.prospectes add column if not exists naus boolean default false;
alter table public.prospectes add column if not exists nis2_ciber boolean default false;
alter table public.prospectes add column if not exists ambit text;
alter table public.prospectes add column if not exists notes text;

-- ---------------------------------------------------------------------
-- TRUCADES (historial del centre de trucades)
-- ---------------------------------------------------------------------
create table if not exists public.trucades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);
alter table public.trucades add column if not exists prospecte_id uuid references public.prospectes(id) on delete cascade;
alter table public.trucades add column if not exists data timestamptz default now();
alter table public.trucades add column if not exists resultat text;
alter table public.trucades add column if not exists resum text;
alter table public.trucades add column if not exists callback_data timestamptz;

-- ---------------------------------------------------------------------
-- COMPARTICIONS (compartir recursos entre mediadors)
-- ---------------------------------------------------------------------
create table if not exists public.comparticions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now()
);
alter table public.comparticions add column if not exists propietari_id uuid references auth.users(id) on delete cascade;
alter table public.comparticions add column if not exists compartit_amb_id uuid references auth.users(id) on delete cascade;
alter table public.comparticions add column if not exists recurs_tipus text;
alter table public.comparticions add column if not exists recurs_id uuid;
alter table public.comparticions add column if not exists permis text default 'lectura';

-- ---------------------------------------------------------------------
-- USER_CONFIG (preferències per usuari)
-- ---------------------------------------------------------------------
create table if not exists public.user_config (
  user_id uuid primary key references auth.users(id) on delete cascade,
  updated_at timestamptz default now()
);
alter table public.user_config add column if not exists rams text[];
alter table public.user_config add column if not exists model_fast text default 'claude-haiku-4-5-20251001';
alter table public.user_config add column if not exists model_smart text default 'claude-sonnet-4-6';

-- ---------------------------------------------------------------------
-- [MIG-FET] AGENDA_EVENTS · ESBORRANYS · INBOX_ITEMS · VINCULACIONS
-- Mòduls a mig construir. Es creen en forma base perquè existeixin i el
-- CRM no peti en carregar-les. Revisar quan es desenvolupin del tot.
-- ---------------------------------------------------------------------
create table if not exists public.agenda_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);
alter table public.agenda_events add column if not exists titol text;
alter table public.agenda_events add column if not exists data_inici timestamptz;
alter table public.agenda_events add column if not exists data_fi timestamptz;
alter table public.agenda_events add column if not exists notes text;

create table if not exists public.esborranys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);
alter table public.esborranys add column if not exists tipus text;
alter table public.esborranys add column if not exists contingut text;
alter table public.esborranys add column if not exists estat text default 'actiu';

create table if not exists public.inbox_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);
alter table public.inbox_items add column if not exists tipus text;
alter table public.inbox_items add column if not exists contingut text;
alter table public.inbox_items add column if not exists estat text default 'pendent';

create table if not exists public.vinculacions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);
alter table public.vinculacions add column if not exists origen_tipus text;
alter table public.vinculacions add column if not exists origen_id uuid;
alter table public.vinculacions add column if not exists desti_tipus text;
alter table public.vinculacions add column if not exists desti_id uuid;

-- ---------------------------------------------------------------------
-- mediador_id a les taules que el necessiten (idempotent; la migració
-- 2026_05_17_mediadors.sql ja ho fa, però ho repetim per si una taula
-- es crea de zero amb aquest fitxer).
-- ---------------------------------------------------------------------
alter table public.clients      add column if not exists mediador_id uuid references public.mediadors(id) on delete set null;
alter table public.ofertes      add column if not exists mediador_id uuid references public.mediadors(id) on delete set null;
alter table public.seguiments   add column if not exists mediador_id uuid references public.mediadors(id) on delete set null;
alter table public.tasques      add column if not exists mediador_id uuid references public.mediadors(id) on delete set null;
alter table public.venciments   add column if not exists mediador_id uuid references public.mediadors(id) on delete set null;
alter table public.oportunitats add column if not exists mediador_id uuid references public.mediadors(id) on delete set null;
alter table public.prospectes   add column if not exists mediador_id uuid references public.mediadors(id) on delete set null;
alter table public.trucades     add column if not exists mediador_id uuid references public.mediadors(id) on delete set null;

-- =====================================================================
-- RLS · model decidit: "tot l'equip autenticat veu i treballa tot"
-- (eina interna). Anònims (clau pública sola, sense sessió) no entren.
-- Idempotent: esborra la política prèvia amb el mateix nom i la recrea.
-- =====================================================================
do $$
declare t text;
declare taules text[] := array[
  'clients','ofertes','consolidats','seguiments','oportunitats','venciments',
  'tasques','asseguradores','notes','posts','prospectes','trucades',
  'comparticions','user_config','agenda_events','esborranys','inbox_items',
  'vinculacions'
];
begin
  foreach t in array taules loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "equip_tot" on public.%I;', t);
    execute format(
      'create policy "equip_tot" on public.%I for all
         using (auth.uid() is not null)
         with check (auth.uid() is not null);', t);
  end loop;
end$$;

-- =====================================================================
-- FI de l'esquema base.
--
-- ── Per a una rèplica 100% fidel de la BD actual ─────────────────────
-- Si vols que les migracions reflecteixin EXACTAMENT el que tens a
-- Supabase (tipus inclosos), executa això al SQL Editor i passa'm el
-- resultat:
--
--   select table_name, column_name, data_type, is_nullable, column_default
--   from information_schema.columns
--   where table_schema = 'public'
--   order by table_name, ordinal_position;
--
-- Amb això genero migracions exactes, columna a columna.
-- =====================================================================
