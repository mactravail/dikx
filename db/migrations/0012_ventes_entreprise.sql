-- =====================================================================
-- Scoping par entreprise du module VENTES (clients + documents) + colonnes
-- manquantes du modele applicatif (additif)
-- =====================================================================
-- 0002 a cree clients / documents / lignes_document / paiements SANS
-- `entreprise_id` (RLS deny-by-default). Cette migration :
--   1. ajoute `entreprise_id` + policies `peut_acceder` (helpers 0009),
--   2. ajoute les colonnes que le modele applicatif utilise et qui manquaient
--      (documents.assujetti_tva / remise_globale_pct / client_nom ;
--       lignes_document.remise_pct),
--   3. rend le numero de document unique PAR ENTREPRISE (au lieu de global).
--
-- NB : tables supposees VIDES (pas de donnees en prod).
-- =====================================================================

-- ------------------------------------------------------------------
-- clients (0002)
-- ------------------------------------------------------------------
alter table clients
  add column entreprise_id uuid not null references entreprise(id) on delete cascade;
create index idx_clients_entreprise on clients (entreprise_id, actif);

create policy clients_select on clients for select using (peut_acceder(entreprise_id));
create policy clients_insert on clients for insert with check (peut_acceder(entreprise_id));
create policy clients_update on clients for update
  using (peut_acceder(entreprise_id)) with check (peut_acceder(entreprise_id));
create policy clients_delete on clients for delete using (peut_acceder(entreprise_id));

-- ------------------------------------------------------------------
-- documents (0002) — + colonnes applicatives + numero unique par entreprise
-- ------------------------------------------------------------------
alter table documents
  add column entreprise_id      uuid not null references entreprise(id) on delete cascade,
  add column client_nom         text,
  add column assujetti_tva      boolean not null default true,
  add column remise_globale_pct numeric(6,5) not null default 0 check (remise_globale_pct >= 0);

alter table documents drop constraint if exists uniq_document_numero;
create unique index uniq_document_numero_entreprise on documents (entreprise_id, type, numero);
create index idx_documents_entreprise on documents (entreprise_id, date_emission desc);

create policy documents_select on documents for select using (peut_acceder(entreprise_id));
create policy documents_insert on documents for insert with check (peut_acceder(entreprise_id));
create policy documents_update on documents for update
  using (peut_acceder(entreprise_id)) with check (peut_acceder(entreprise_id));
create policy documents_delete on documents for delete using (peut_acceder(entreprise_id));

-- ------------------------------------------------------------------
-- lignes_document (0002) — + remise_pct (fraction) + scope
-- ------------------------------------------------------------------
alter table lignes_document
  add column entreprise_id uuid not null references entreprise(id) on delete cascade,
  add column remise_pct    numeric(6,5) not null default 0 check (remise_pct >= 0);
create index idx_lignes_document_entreprise on lignes_document (entreprise_id);

create policy lignes_document_select on lignes_document for select using (peut_acceder(entreprise_id));
create policy lignes_document_insert on lignes_document for insert with check (peut_acceder(entreprise_id));
create policy lignes_document_update on lignes_document for update
  using (peut_acceder(entreprise_id)) with check (peut_acceder(entreprise_id));
create policy lignes_document_delete on lignes_document for delete using (peut_acceder(entreprise_id));

-- ------------------------------------------------------------------
-- paiements (0002) — scope + policies (coherence RLS ; non ecrit par l'app
-- aujourd'hui : les acomptes sont portes par documents.montant_paye)
-- ------------------------------------------------------------------
alter table paiements
  add column entreprise_id uuid not null references entreprise(id) on delete cascade;
create index idx_paiements_entreprise on paiements (entreprise_id);

create policy paiements_select on paiements for select using (peut_acceder(entreprise_id));
create policy paiements_insert on paiements for insert with check (peut_acceder(entreprise_id));
create policy paiements_update on paiements for update
  using (peut_acceder(entreprise_id)) with check (peut_acceder(entreprise_id));
create policy paiements_delete on paiements for delete using (peut_acceder(entreprise_id));
