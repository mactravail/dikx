-- =====================================================================
-- raktak ERP — module Facturation & Clients (schema additif)
-- =====================================================================
-- Premier module de gestion de l'ERP raktak. S'ajoute au schema du
-- previsionnel (0001_init.sql) sans le modifier.
--
-- Conventions (identiques a 0001) :
--  - Montants FCFA (XOF) : entiers => bigint.
--  - Taux : numeric en fraction (0.18 = 18 %).
--  - RLS activee, aucune policy publique => acces backend (service_role) seul.
--
-- Regle non negociable : les totaux (HT, TVA, TTC, net a payer) sont produits
-- par le MOTEUR de calcul deterministe cote serveur, jamais dans le navigateur.
-- Les colonnes de totaux ci-dessous stockent le SNAPSHOT calcule par le moteur.
-- =====================================================================

-- ------------------------------------------------------------------
-- Types enumeres
-- ------------------------------------------------------------------
create type type_document as enum ('devis', 'facture', 'avoir');

create type statut_document as enum (
  'brouillon', 'emis', 'partiellement_paye', 'paye', 'annule'
);

create type moyen_paiement as enum (
  'especes', 'virement', 'mobile_money', 'cheque', 'autre'
);

-- ------------------------------------------------------------------
-- clients — repertoire clients
-- ------------------------------------------------------------------
create table clients (
  id                    uuid primary key default gen_random_uuid(),
  code                  text unique,                       -- code interne (ex. CLI-0001)
  raison_sociale        text not null,
  ninea                 text,                              -- identifiant fiscal senegalais
  rccm                  text,                              -- registre du commerce
  contact_nom           text,
  telephone             text,
  email                 text,
  adresse               text,
  ville                 text,
  delai_paiement_jours  smallint not null default 0 check (delai_paiement_jours >= 0),
  actif                 boolean not null default true,
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
comment on table clients is 'Repertoire clients de l''ERP raktak (facturation).';
create index idx_clients_raison_sociale on clients (raison_sociale);
create index idx_clients_actif on clients (actif);

create trigger trg_clients_updated
  before update on clients
  for each row execute function set_updated_at();

-- ------------------------------------------------------------------
-- documents — devis / factures / avoirs
-- ------------------------------------------------------------------
create table documents (
  id             uuid primary key default gen_random_uuid(),
  type           type_document not null default 'facture',
  numero         text not null,                            -- ex. FAC-2026-0001
  client_id      uuid references clients(id) on delete restrict,
  statut         statut_document not null default 'brouillon',
  date_emission  date not null default current_date,
  date_echeance  date,
  devise         text not null default 'XOF',
  -- Totaux : SNAPSHOT calcule par le moteur (deterministe, teste).
  total_ht       bigint not null default 0 check (total_ht >= 0),
  total_tva      bigint not null default 0 check (total_tva >= 0),
  total_ttc      bigint not null default 0 check (total_ttc >= 0),
  montant_paye   bigint not null default 0 check (montant_paye >= 0),
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  -- Un numero unique par type de document.
  constraint uniq_document_numero unique (type, numero)
);
comment on table documents is 'Devis, factures et avoirs. Totaux = snapshot du moteur.';
create index idx_documents_client on documents (client_id);
create index idx_documents_statut on documents (statut);
create index idx_documents_date on documents (date_emission desc);

create trigger trg_documents_updated
  before update on documents
  for each row execute function set_updated_at();

-- ------------------------------------------------------------------
-- lignes_document — lignes de detail (boucle)
-- ------------------------------------------------------------------
create table lignes_document (
  id                uuid primary key default gen_random_uuid(),
  document_id       uuid not null references documents(id) on delete cascade,
  ordre             smallint not null default 0,
  designation       text not null,
  quantite          numeric not null default 1 check (quantite >= 0),
  prix_unitaire_ht  bigint not null check (prix_unitaire_ht >= 0),
  taux_tva          numeric(6,5) not null default 0.18 check (taux_tva >= 0),
  -- Montant HT de la ligne : SNAPSHOT calcule par le moteur.
  montant_ht        bigint not null default 0 check (montant_ht >= 0)
);
create index idx_lignes_document on lignes_document (document_id, ordre);

-- ------------------------------------------------------------------
-- paiements — encaissements rattaches a un document
-- ------------------------------------------------------------------
create table paiements (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references documents(id) on delete cascade,
  date_paiement date not null default current_date,
  montant      bigint not null check (montant > 0),
  moyen        moyen_paiement not null default 'virement',
  reference    text,
  created_at   timestamptz not null default now()
);
create index idx_paiements_document on paiements (document_id, date_paiement);

-- ------------------------------------------------------------------
-- Row Level Security (deny-by-default, acces service_role uniquement)
-- ------------------------------------------------------------------
alter table clients          enable row level security;
alter table documents        enable row level security;
alter table lignes_document  enable row level security;
alter table paiements        enable row level security;
