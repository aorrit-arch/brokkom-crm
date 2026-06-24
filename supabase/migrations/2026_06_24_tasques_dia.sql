-- =====================================================================
-- Migració: TODO potent diari  ·  2026_06_24
-- Afegeix a `tasques` el suport per a:
--   · traspàs dia a dia (el que no fas avui apareix l'endemà, automàtic)
--   · omplir la llista en començar el dia (data_prevista)
--   · prorrogar una tasca a una data futura (mou data_prevista + comptador)
--
-- Model simple basat en UNA sola data:
--   "tasca d'avui" = pendent AND (data_prevista IS NULL OR data_prevista <= avui)
--   "endarrerida"  = pendent AND data_prevista < avui   (s'arrossega sola)
--   "prorrogar"    = posar data_prevista a una data futura (+1 a num_prorrogues)
--
-- És IDEMPOTENT i NO toca cap dada existent: només afegeix columnes si falten.
-- Executar a Supabase -> SQL Editor.
-- =====================================================================

alter table public.tasques
  add column if not exists data_prevista date default current_date;

alter table public.tasques
  add column if not exists num_prorrogues integer not null default 0;

alter table public.tasques
  add column if not exists completed_at timestamptz;

create index if not exists tasques_data_prevista_idx on public.tasques(data_prevista);

-- Backfill suau: tasques pendents sense data_prevista -> avui.
update public.tasques
  set data_prevista = current_date
  where data_prevista is null and estat = 'pendent';

-- =====================================================================
-- Rollback (si calgués):
--   alter table public.tasques drop column if exists data_prevista;
--   alter table public.tasques drop column if exists num_prorrogues;
--   alter table public.tasques drop column if exists completed_at;
-- =====================================================================
