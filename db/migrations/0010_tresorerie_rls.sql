-- =====================================================================
-- RLS des tables de SAISIE : Tresorerie (comptes + mouvements) — additif
-- =====================================================================
-- 0007 a cree comptes_tresorerie / mouvements_tresorerie avec `entreprise_id` et
-- la RLS ACTIVEE mais SANS policy (deny-by-default). Cette migration cable les
-- policies d'acces par entreprise, en s'appuyant sur les helpers de 0009 :
--
--   peut_acceder(entreprise_id) = le comptable proprietaire (entreprise.cabinet_id
--   = auth.uid()) OU un membre rattache (membre_entreprise). Les deux LISENT et
--   ECRIVENT (le comptable corrige/saisit ; l'entreprise saisit son activite).
--
-- service_role (backend/admin) continue de contourner la RLS.
-- =====================================================================

-- comptes_tresorerie
create policy comptes_tresorerie_select on comptes_tresorerie
  for select using (peut_acceder(entreprise_id));
create policy comptes_tresorerie_insert on comptes_tresorerie
  for insert with check (peut_acceder(entreprise_id));
create policy comptes_tresorerie_update on comptes_tresorerie
  for update using (peut_acceder(entreprise_id))
  with check (peut_acceder(entreprise_id));
create policy comptes_tresorerie_delete on comptes_tresorerie
  for delete using (peut_acceder(entreprise_id));

-- mouvements_tresorerie
create policy mouvements_tresorerie_select on mouvements_tresorerie
  for select using (peut_acceder(entreprise_id));
create policy mouvements_tresorerie_insert on mouvements_tresorerie
  for insert with check (peut_acceder(entreprise_id));
create policy mouvements_tresorerie_update on mouvements_tresorerie
  for update using (peut_acceder(entreprise_id))
  with check (peut_acceder(entreprise_id));
create policy mouvements_tresorerie_delete on mouvements_tresorerie
  for delete using (peut_acceder(entreprise_id));
