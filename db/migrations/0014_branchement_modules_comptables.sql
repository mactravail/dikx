-- =====================================================================
-- Scoping par entreprise des DERNIERS modules encore en localStorage
-- (comptabilite, projets/taches, fournisseurs, achats, production, CRM,
--  rapport financier) — additif
-- =====================================================================
-- Les tables 0003 (ecritures/lignes_ecriture), 0004 (projets/taches),
-- 0005 (fournisseurs, commandes_achat/lignes, nomenclatures/composants,
-- ordres_fabrication) ont ete creees SANS `entreprise_id` (RLS deny-by-default).
-- Cette migration :
--   1. ajoute `entreprise_id` + les policies `peut_acceder` (helpers 0009) sur
--      chacune de ces tables (parents ET enfants, pour un scoping direct),
--   2. cree la table `opportunites` (CRM) qui n'avait pas de table SQL,
--   3. rend uniques PAR ENTREPRISE les references qui etaient globales
--      (nomenclatures.produit_ref),
--   4. ajoute les policies RLS + un index d'upsert sur `rapport_financier` (0008).
--
-- Modele identique a 0011 / 0012 (saisies & ventes). Ces modules relevent du
-- COMPTABLE (pas du circuit brouillon/envoye : pas de colonne `transmission`) :
-- toutes les operations restent en `peut_acceder` (comptable + membre).
--
-- NB : tables supposees VIDES en prod -> ajout direct des colonnes en NOT NULL.
-- =====================================================================

-- ==================================================================
-- 1. Comptabilite — ecritures + lignes_ecriture (0003)
-- ==================================================================
alter table ecritures
  add column entreprise_id uuid not null references entreprise(id) on delete cascade;
create index idx_ecritures_entreprise on ecritures (entreprise_id, date_ecriture desc);

create policy ecritures_select on ecritures for select using (peut_acceder(entreprise_id));
create policy ecritures_insert on ecritures for insert with check (peut_acceder(entreprise_id));
create policy ecritures_update on ecritures for update
  using (peut_acceder(entreprise_id)) with check (peut_acceder(entreprise_id));
create policy ecritures_delete on ecritures for delete using (peut_acceder(entreprise_id));

alter table lignes_ecriture
  add column entreprise_id uuid not null references entreprise(id) on delete cascade;
create index idx_lignes_ecriture_entreprise on lignes_ecriture (entreprise_id);

create policy lignes_ecriture_select on lignes_ecriture for select using (peut_acceder(entreprise_id));
create policy lignes_ecriture_insert on lignes_ecriture for insert with check (peut_acceder(entreprise_id));
create policy lignes_ecriture_update on lignes_ecriture for update
  using (peut_acceder(entreprise_id)) with check (peut_acceder(entreprise_id));
create policy lignes_ecriture_delete on lignes_ecriture for delete using (peut_acceder(entreprise_id));

-- ==================================================================
-- 2. Organisation — projets + taches (0004)
-- ==================================================================
alter table projets
  add column entreprise_id uuid not null references entreprise(id) on delete cascade;
create index idx_projets_entreprise on projets (entreprise_id, statut);

create policy projets_select on projets for select using (peut_acceder(entreprise_id));
create policy projets_insert on projets for insert with check (peut_acceder(entreprise_id));
create policy projets_update on projets for update
  using (peut_acceder(entreprise_id)) with check (peut_acceder(entreprise_id));
create policy projets_delete on projets for delete using (peut_acceder(entreprise_id));

alter table taches
  add column entreprise_id uuid not null references entreprise(id) on delete cascade;
create index idx_taches_entreprise on taches (entreprise_id, projet_id);

create policy taches_select on taches for select using (peut_acceder(entreprise_id));
create policy taches_insert on taches for insert with check (peut_acceder(entreprise_id));
create policy taches_update on taches for update
  using (peut_acceder(entreprise_id)) with check (peut_acceder(entreprise_id));
create policy taches_delete on taches for delete using (peut_acceder(entreprise_id));

-- ==================================================================
-- 3. Achats & Stock — fournisseurs (0005)
-- ==================================================================
alter table fournisseurs
  add column entreprise_id uuid not null references entreprise(id) on delete cascade;
create index idx_fournisseurs_entreprise on fournisseurs (entreprise_id, actif);

create policy fournisseurs_select on fournisseurs for select using (peut_acceder(entreprise_id));
create policy fournisseurs_insert on fournisseurs for insert with check (peut_acceder(entreprise_id));
create policy fournisseurs_update on fournisseurs for update
  using (peut_acceder(entreprise_id)) with check (peut_acceder(entreprise_id));
create policy fournisseurs_delete on fournisseurs for delete using (peut_acceder(entreprise_id));

-- ------------------------------------------------------------------
-- commandes_achat + lignes_commande_achat (0005)
-- ------------------------------------------------------------------
alter table commandes_achat
  add column entreprise_id uuid not null references entreprise(id) on delete cascade;
create index idx_commandes_entreprise on commandes_achat (entreprise_id, date_commande desc);

create policy commandes_achat_select on commandes_achat for select using (peut_acceder(entreprise_id));
create policy commandes_achat_insert on commandes_achat for insert with check (peut_acceder(entreprise_id));
create policy commandes_achat_update on commandes_achat for update
  using (peut_acceder(entreprise_id)) with check (peut_acceder(entreprise_id));
create policy commandes_achat_delete on commandes_achat for delete using (peut_acceder(entreprise_id));

alter table lignes_commande_achat
  add column entreprise_id uuid not null references entreprise(id) on delete cascade;
create index idx_lignes_commande_entreprise on lignes_commande_achat (entreprise_id);

create policy lignes_commande_select on lignes_commande_achat for select using (peut_acceder(entreprise_id));
create policy lignes_commande_insert on lignes_commande_achat for insert with check (peut_acceder(entreprise_id));
create policy lignes_commande_update on lignes_commande_achat for update
  using (peut_acceder(entreprise_id)) with check (peut_acceder(entreprise_id));
create policy lignes_commande_delete on lignes_commande_achat for delete using (peut_acceder(entreprise_id));

-- ==================================================================
-- 4. Production / MRP — nomenclatures, composants, ordres (0005)
-- `produit_ref` etait unique globalement -> desormais unique PAR entreprise.
-- ==================================================================
alter table nomenclatures
  add column entreprise_id uuid not null references entreprise(id) on delete cascade;
alter table nomenclatures drop constraint if exists nomenclatures_produit_ref_key;
create unique index idx_nomenclatures_produit_entreprise on nomenclatures (entreprise_id, produit_ref);

create policy nomenclatures_select on nomenclatures for select using (peut_acceder(entreprise_id));
create policy nomenclatures_insert on nomenclatures for insert with check (peut_acceder(entreprise_id));
create policy nomenclatures_update on nomenclatures for update
  using (peut_acceder(entreprise_id)) with check (peut_acceder(entreprise_id));
create policy nomenclatures_delete on nomenclatures for delete using (peut_acceder(entreprise_id));

alter table composants_nomenclature
  add column entreprise_id uuid not null references entreprise(id) on delete cascade;
create index idx_composants_entreprise on composants_nomenclature (entreprise_id);

create policy composants_select on composants_nomenclature for select using (peut_acceder(entreprise_id));
create policy composants_insert on composants_nomenclature for insert with check (peut_acceder(entreprise_id));
create policy composants_update on composants_nomenclature for update
  using (peut_acceder(entreprise_id)) with check (peut_acceder(entreprise_id));
create policy composants_delete on composants_nomenclature for delete using (peut_acceder(entreprise_id));

alter table ordres_fabrication
  add column entreprise_id uuid not null references entreprise(id) on delete cascade;
create index idx_ordres_entreprise on ordres_fabrication (entreprise_id, statut);

create policy ordres_select on ordres_fabrication for select using (peut_acceder(entreprise_id));
create policy ordres_insert on ordres_fabrication for insert with check (peut_acceder(entreprise_id));
create policy ordres_update on ordres_fabrication for update
  using (peut_acceder(entreprise_id)) with check (peut_acceder(entreprise_id));
create policy ordres_delete on ordres_fabrication for delete using (peut_acceder(entreprise_id));

-- ==================================================================
-- 5. Ventes & CRM — opportunites (nouvelle table)
-- ==================================================================
-- Le pipeline (etapes) est du texte libre cote app (ETAPES_PIPELINE) : on ne
-- fige pas d'enum. Le montant est une SAISIE ; la prevision ponderee et les
-- totaux par etape restent produits par le moteur (calculerPipeline).
create table opportunites (
  id             uuid primary key default gen_random_uuid(),
  entreprise_id  uuid not null references entreprise(id) on delete cascade,
  titre          text not null,
  client_nom     text,
  etape          text not null default 'Prospection',
  montant        bigint not null default 0 check (montant >= 0),
  -- Probabilite en fraction (0.0 a 1.0).
  probabilite    numeric(4,3) not null default 0 check (probabilite >= 0 and probabilite <= 1),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
comment on table opportunites is 'Opportunites commerciales (CRM). Totaux/prevision = snapshot du moteur.';
create index idx_opportunites_entreprise on opportunites (entreprise_id, etape);

create trigger trg_opportunites_updated
  before update on opportunites
  for each row execute function set_updated_at();

alter table opportunites enable row level security;
create policy opportunites_select on opportunites for select using (peut_acceder(entreprise_id));
create policy opportunites_insert on opportunites for insert with check (peut_acceder(entreprise_id));
create policy opportunites_update on opportunites for update
  using (peut_acceder(entreprise_id)) with check (peut_acceder(entreprise_id));
create policy opportunites_delete on opportunites for delete using (peut_acceder(entreprise_id));

-- ==================================================================
-- 6. Pilotage — rapport_financier (0008) : policies RLS + upsert par exercice
-- ==================================================================
-- 0008 a active la RLS sans policy (le scoping restait a cabler). Un rapport est
-- unique par (entreprise, exercice) -> index d'upsert.
create unique index if not exists idx_rapport_entreprise_exercice
  on rapport_financier (entreprise_id, exercice);

create policy rapport_select on rapport_financier for select using (peut_acceder(entreprise_id));
create policy rapport_insert on rapport_financier for insert with check (peut_acceder(entreprise_id));
create policy rapport_update on rapport_financier for update
  using (peut_acceder(entreprise_id)) with check (peut_acceder(entreprise_id));
create policy rapport_delete on rapport_financier for delete using (peut_acceder(entreprise_id));
