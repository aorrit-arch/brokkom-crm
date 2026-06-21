-- =====================================================================
-- Contactes de companyia (asseguradores) — 12/06/2026
-- Afegeix una llista de contactes a cada asseguradora del catàleg.
-- Compatible enrere: el camp antic `contacte_intern` es manté tal qual.
--
-- COM EXECUTAR-LA: Supabase → SQL Editor → enganxa i executa.
-- =====================================================================

alter table public.asseguradores
  add column if not exists contactes jsonb not null default '[]'::jsonb;

comment on column public.asseguradores.contactes is
  'Llista de contactes de la companyia: [{nom, carrec, email, telefon, notes}]';

-- ---------------------------------------------------------------------
-- OPCIONAL: executa aquest bloc NOMÉS si en guardar un contacte surt un
-- error de "row-level security" (vol dir que la política actual no
-- permet actualitzar asseguradores creades per un altre usuari).
-- ---------------------------------------------------------------------
-- drop policy if exists "asseguradores_update_authenticated" on public.asseguradores;
-- create policy "asseguradores_update_authenticated" on public.asseguradores
--   for update to authenticated using (true) with check (true);
