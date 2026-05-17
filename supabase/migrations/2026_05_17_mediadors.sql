-- =====================================================================
-- Migració multi-usuari: taula `mediadors` + columna `mediador_id` a les
-- taules CRUD principals + polítiques RLS "tothom autenticat veu tot".
--
-- Compatibilitat enrere:
--   • `mediador_id` és nullable a totes les taules — els registres existents
--     no canvien (continuen com `NULL`). El frontend tracta `NULL` com a
--     "sense propietari" i el filtre "Cartera meva" no els amaga si l'opció
--     ho indica.
--   • La taula `mediadors` és independent: si no s'omple, el dropdown del
--     header queda buit i el CRM segueix funcionant exactament com fins ara.
--
-- COM EXECUTAR-LA:
--   • Al panell Supabase → SQL Editor → enganxa i executa.
--   • O bé: `supabase db push` si tens la CLI configurada.
--
-- Pots executar-la per parts si vols revisar els canvis pas a pas.
-- =====================================================================

-- 1. Taula `mediadors`
create table if not exists public.mediadors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  nom text not null,
  email text,
  telefon text,
  rol text not null default 'mediador' check (rol in ('admin','mediador','lector')),
  data_alta timestamptz not null default now(),
  actiu boolean not null default true,
  -- Telegram (Tasca 5)
  telegram_chat_id text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mediadors_user_id_idx on public.mediadors(user_id);
create index if not exists mediadors_actiu_idx on public.mediadors(actiu);
create unique index if not exists mediadors_email_uq on public.mediadors(lower(email)) where email is not null;

-- updated_at trigger
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;$$;

drop trigger if exists mediadors_set_updated_at on public.mediadors;
create trigger mediadors_set_updated_at before update on public.mediadors
for each row execute function public.tg_set_updated_at();

-- 2. Afegim mediador_id a les taules que ho necessiten (NULLABLE per a
-- compatibilitat enrere). `if not exists` perquè la migració sigui idempotent.
alter table public.clients       add column if not exists mediador_id uuid references public.mediadors(id) on delete set null;
alter table public.ofertes       add column if not exists mediador_id uuid references public.mediadors(id) on delete set null;
alter table public.seguiments    add column if not exists mediador_id uuid references public.mediadors(id) on delete set null;
alter table public.tasques       add column if not exists mediador_id uuid references public.mediadors(id) on delete set null;
alter table public.venciments    add column if not exists mediador_id uuid references public.mediadors(id) on delete set null;
alter table public.oportunitats  add column if not exists mediador_id uuid references public.mediadors(id) on delete set null;

-- Índexs per fer rapid el filtre per mediador
create index if not exists clients_mediador_idx on public.clients(mediador_id);
create index if not exists ofertes_mediador_idx on public.ofertes(mediador_id);
create index if not exists seguiments_mediador_idx on public.seguiments(mediador_id);
create index if not exists tasques_mediador_idx on public.tasques(mediador_id);
create index if not exists venciments_mediador_idx on public.venciments(mediador_id);
create index if not exists oportunitats_mediador_idx on public.oportunitats(mediador_id);

-- 3. Activem RLS a `mediadors` (les altres ja la tenen)
alter table public.mediadors enable row level security;

-- 4. Polítiques RLS — "tothom autenticat veu tot, el filtre es fa al frontend".
--    El control real de qui pot escriure/editar/esborrar es manté: usuari
--    autenticat per crear, propietari (user_id) per modificar/esborrar.

-- Esborrem polítiques antigues per fer la migració idempotent
drop policy if exists "tothom_autenticat_llegeix" on public.mediadors;
drop policy if exists "tothom_autenticat_insereix" on public.mediadors;
drop policy if exists "propietari_o_admin_actualitza" on public.mediadors;
drop policy if exists "propietari_o_admin_esborra" on public.mediadors;

create policy "tothom_autenticat_llegeix"
  on public.mediadors for select
  using (auth.uid() is not null);

-- Només admins poden inserir/actualitzar/esborrar mediadors.
-- Mentre no tinguem cap admin definit, deixem que qualsevol autenticat
-- pugui crear-ne (cas inicial: el primer login crea el seu propi mediador).
create policy "autenticat_insereix"
  on public.mediadors for insert
  with check (auth.uid() is not null);

create policy "propietari_o_sense_propietari_actualitza"
  on public.mediadors for update
  using (auth.uid() is not null and (user_id is null or user_id = auth.uid()
         or exists (select 1 from public.mediadors m
                    where m.user_id = auth.uid() and m.rol = 'admin' and m.actiu)));

create policy "admin_esborra"
  on public.mediadors for delete
  using (exists (select 1 from public.mediadors m
                 where m.user_id = auth.uid() and m.rol = 'admin' and m.actiu));

-- 5. Polítiques RLS a les taules CRUD: "tothom autenticat veu tot"
--    NOTA: si tenies polítiques amb auth.uid() = user_id, aquestes les
--    substitueixen. El user_id segueix sent obligatori per a INSERT (que
--    cada registre pertanyi a algú) i per a UPDATE/DELETE (que només el
--    propietari hi pugui actuar).
--
--    Si vols mantenir polítiques estrictes (cadascú només veu les seves),
--    NO executis aquest bloc — el CRM segueix funcionant.

-- Helper macro: per a cada taula, esborrem polítiques de SELECT prèvies amb
-- nom "select_owned" i creem una nova "select_all_authenticated".
do $$
declare t text;
declare tables text[] := array['clients','ofertes','consolidats','seguiments','tasques','venciments','oportunitats','asseguradores','posts','notes','user_config'];
begin
  foreach t in array tables loop
    execute format('drop policy if exists "select_all_authenticated" on public.%I;', t);
    execute format('create policy "select_all_authenticated" on public.%I for select using (auth.uid() is not null);', t);
  end loop;
end$$;

-- =====================================================================
-- FI DE MIGRACIÓ.
--
-- Què fer després:
--   1) Comprovar que el CRM segueix funcionant igual (filtre per defecte
--      a frontend = "Tot l'equip" → no filtra per mediador).
--   2) Quan tinguis els emails dels 2 mediadors futurs, segueix
--      /docs/multi-usuari.md per donar-los d'alta.
--
-- Rollback (si cal):
--   alter table public.clients      drop column if exists mediador_id;
--   alter table public.ofertes      drop column if exists mediador_id;
--   alter table public.seguiments   drop column if exists mediador_id;
--   alter table public.tasques      drop column if exists mediador_id;
--   alter table public.venciments   drop column if exists mediador_id;
--   alter table public.oportunitats drop column if exists mediador_id;
--   drop table if exists public.mediadors cascade;
-- =====================================================================
