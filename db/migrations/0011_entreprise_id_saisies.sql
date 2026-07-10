-- =====================================================================
-- Scoping par entreprise des tables de SAISIE : charges, RH, stock (additif)
-- =====================================================================
-- Les tables 0003 (depenses), 0004 (employes) et 0005 (articles,
-- mouvements_stock) ont ete creees SANS `entreprise_id` (RLS deny-by-default).
-- Cette migration ajoute la colonne de scope + les policies d'acces par
-- entreprise, sur le modele de 0010 (helpers de 0009 : peut_acceder()).
--
-- NB : tables supposees VIDES (pas de donnees en prod) -> ajout direct en NOT NULL.
-- =====================================================================

-- ------------------------------------------------------------------
-- Charges & depenses (0003)
-- ------------------------------------------------------------------
alter table depenses
  add column entreprise_id uuid not null references entreprise(id) on delete cascade;
create index idx_depenses_entreprise on depenses (entreprise_id, date_depense desc);

create policy depenses_select on depenses for select using (peut_acceder(entreprise_id));
create policy depenses_insert on depenses for insert with check (peut_acceder(entreprise_id));
create policy depenses_update on depenses for update
  using (peut_acceder(entreprise_id)) with check (peut_acceder(entreprise_id));
create policy depenses_delete on depenses for delete using (peut_acceder(entreprise_id));

-- ------------------------------------------------------------------
-- RH — employes (0004)
-- ------------------------------------------------------------------
alter table employes
  add column entreprise_id uuid not null references entreprise(id) on delete cascade;
create index idx_employes_entreprise on employes (entreprise_id, actif);

create policy employes_select on employes for select using (peut_acceder(entreprise_id));
create policy employes_insert on employes for insert with check (peut_acceder(entreprise_id));
create policy employes_update on employes for update
  using (peut_acceder(entreprise_id)) with check (peut_acceder(entreprise_id));
create policy employes_delete on employes for delete using (peut_acceder(entreprise_id));

-- ------------------------------------------------------------------
-- Stocks — articles + mouvements_stock (0005)
-- `ref` article etait unique globalement -> desormais unique PAR entreprise.
-- ------------------------------------------------------------------
alter table articles
  add column entreprise_id uuid not null references entreprise(id) on delete cascade;
alter table articles drop constraint if exists articles_ref_key;
create unique index idx_articles_ref_entreprise on articles (entreprise_id, ref);
create index idx_articles_entreprise on articles (entreprise_id, type);

create policy articles_select on articles for select using (peut_acceder(entreprise_id));
create policy articles_insert on articles for insert with check (peut_acceder(entreprise_id));
create policy articles_update on articles for update
  using (peut_acceder(entreprise_id)) with check (peut_acceder(entreprise_id));
create policy articles_delete on articles for delete using (peut_acceder(entreprise_id));

alter table mouvements_stock
  add column entreprise_id uuid not null references entreprise(id) on delete cascade;
create index idx_mouvements_stock_entreprise on mouvements_stock (entreprise_id, date_mouvement desc);

create policy mouvements_stock_select on mouvements_stock for select using (peut_acceder(entreprise_id));
create policy mouvements_stock_insert on mouvements_stock for insert with check (peut_acceder(entreprise_id));
create policy mouvements_stock_update on mouvements_stock for update
  using (peut_acceder(entreprise_id)) with check (peut_acceder(entreprise_id));
create policy mouvements_stock_delete on mouvements_stock for delete using (peut_acceder(entreprise_id));
