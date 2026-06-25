-- =====================================================================
-- BROKKOM CRM · Mòdul FLOTES — extres  ·  2026_06_24_flotes_extres.sql
--
-- Afegits per als 3 mòduls nous de Flotes:
--   1) Checklist de documentació  -> columna `documents` (jsonb)
--   3) Matriu de venda creuada / riscos -> camps de perfil de la flota
--      (frigorific, n_conductors, internacional, naus). `adr` i `ambit`
--      ja existeixen de la migració de flotes.
--   2) Textos i tasques -> no necessita base de dades.
--
-- La matriu de venda creuada NO crea cap taula nova: escriu les
-- oportunitats a la taula `oportunitats` que ja existeix al CRM.
--
-- IDEMPOTENT i SEGUR: tot "if not exists", no esborra ni altera res.
-- Requereix que la taula public.flotes ja existeixi
-- (migració 2026_06_24_flotes.sql).
-- =====================================================================

-- ---- Mòdul 1: checklist de documentació ----
-- Llista de documents/dades de la flota amb estat (rebut/pendent/na),
-- data i nota. Es desa com a jsonb, igual que les subtasques.
alter table public.flotes add column if not exists documents jsonb default '[]'::jsonb;

-- ---- Mòdul 3: perfil de risc per a la venda creuada ----
alter table public.flotes add column if not exists frigorific boolean default false;     -- transport frigorífic -> avaria equip fred
alter table public.flotes add column if not exists n_conductors integer;                 -- nº de conductors -> complement IT, CAP, pèrdua carnet
alter table public.flotes add column if not exists internacional boolean default false;  -- trànsit internacional / CMR -> ICC A, crèdit exportació
alter table public.flotes add column if not exists naus boolean default false;           -- naus o instal·lacions -> multiriscos industrial
