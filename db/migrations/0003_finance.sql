-- =====================================================================
-- raktak ERP — pole Finance : Comptabilite + Charges & Depenses (additif)
-- =====================================================================
-- S'ajoute aux schemas 0001 (previsionnel) et 0002 (facturation) sans les
-- modifier. Reutilise la fonction set_updated_at() definie en 0001.
--
-- Conventions (identiques a 0001/0002) :
--  - Montants FCFA (XOF) : entiers => bigint.
--  - Taux : numeric en fraction (0.18 = 18 %).
--  - RLS activee, aucune policy publique => acces backend (service_role) seul.
--
-- Regle non negociable : les cumuls et totaux (TVA, TTC, total debit/credit,
-- soldes) sont produits par le MOTEUR deterministe cote serveur, jamais dans le
-- navigateur. Les colonnes de totaux ci-dessous stockent le SNAPSHOT du moteur.
-- =====================================================================

-- ------------------------------------------------------------------
-- Types enumeres
-- ------------------------------------------------------------------
create type categorie_depense as enum (
  'loyer', 'energie', 'eau', 'telecom', 'transport', 'fournitures',
  'entretien', 'honoraires', 'assurance', 'impots_taxes', 'salaires',
  'frais_bancaires', 'marketing', 'autre'
);

create type recurrence_depense as enum (
  'ponctuelle', 'mensuelle', 'trimestrielle', 'annuelle'
);

create type journal_comptable as enum ('VT', 'AC', 'BQ', 'CA', 'OD');

-- ==================================================================
-- Comptabilite
-- ==================================================================

-- ------------------------------------------------------------------
-- comptes — plan comptable SYSCOHADA revise (donnee de reference)
-- ------------------------------------------------------------------
create table comptes (
  numero   text primary key,                    -- ex. "601"
  libelle  text not null,
  classe   smallint not null check (classe between 1 and 9)
);
comment on table comptes is 'Plan comptable SYSCOHADA revise (reference de saisie).';
create index idx_comptes_classe on comptes (classe);

-- ------------------------------------------------------------------
-- ecritures — ecritures de journal (en-tete)
-- ------------------------------------------------------------------
create table ecritures (
  id             uuid primary key default gen_random_uuid(),
  date_ecriture  date not null default current_date,
  journal        journal_comptable not null default 'OD',
  libelle        text not null,
  reference      text,
  -- Totaux : SNAPSHOT calcule par le moteur (Σ debit = Σ credit si equilibree).
  total_debit    bigint not null default 0 check (total_debit >= 0),
  total_credit   bigint not null default 0 check (total_credit >= 0),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
comment on table ecritures is 'Ecritures de journal. Totaux = snapshot du moteur.';
create index idx_ecritures_date on ecritures (date_ecriture desc);
create index idx_ecritures_journal on ecritures (journal);

create trigger trg_ecritures_updated
  before update on ecritures
  for each row execute function set_updated_at();

-- ------------------------------------------------------------------
-- lignes_ecriture — lignes en partie double
-- ------------------------------------------------------------------
create table lignes_ecriture (
  id           uuid primary key default gen_random_uuid(),
  ecriture_id  uuid not null references ecritures(id) on delete cascade,
  ordre        smallint not null default 0,
  compte       text not null references comptes(numero) on delete restrict,
  libelle      text,
  debit        bigint not null default 0 check (debit >= 0),
  credit       bigint not null default 0 check (credit >= 0),
  -- Une ligne mouvemente le debit OU le credit, jamais les deux a la fois.
  constraint chk_ligne_debit_xor_credit check (debit = 0 or credit = 0)
);
create index idx_lignes_ecriture on lignes_ecriture (ecriture_id, ordre);
create index idx_lignes_ecriture_compte on lignes_ecriture (compte);

-- ==================================================================
-- Charges & Depenses
-- ==================================================================

create table depenses (
  id              uuid primary key default gen_random_uuid(),
  date_depense    date not null default current_date,
  libelle         text not null,
  categorie       categorie_depense not null default 'autre',
  fournisseur     text,
  recurrence      recurrence_depense not null default 'ponctuelle',
  montant_ht      bigint not null default 0 check (montant_ht >= 0),
  taux_tva        numeric(6,5) not null default 0 check (taux_tva >= 0),
  -- TVA deductible et TTC : SNAPSHOT calcule par le moteur.
  montant_tva     bigint not null default 0 check (montant_tva >= 0),
  montant_ttc     bigint not null default 0 check (montant_ttc >= 0),
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
comment on table depenses is 'Charges et depenses. TVA/TTC = snapshot du moteur.';
create index idx_depenses_date on depenses (date_depense desc);
create index idx_depenses_categorie on depenses (categorie);

create trigger trg_depenses_updated
  before update on depenses
  for each row execute function set_updated_at();

-- ------------------------------------------------------------------
-- Row Level Security (deny-by-default, acces service_role uniquement)
-- ------------------------------------------------------------------
alter table comptes          enable row level security;
alter table ecritures        enable row level security;
alter table lignes_ecriture  enable row level security;
alter table depenses         enable row level security;

-- ------------------------------------------------------------------
-- Amorce du plan comptable SYSCOHADA (extrait usuel)
-- Doit rester coherent avec PLAN_COMPTABLE (lib/finance-data.ts).
-- ------------------------------------------------------------------
insert into comptes (numero, libelle, classe) values
  ('101',  'Capital social', 1),
  ('106',  'Reserves', 1),
  ('12',   'Report a nouveau', 1),
  ('131',  'Resultat net de l''exercice', 1),
  ('162',  'Emprunts et dettes aupres des etablissements de credit', 1),
  ('213',  'Logiciels', 2),
  ('22',   'Terrains', 2),
  ('231',  'Batiments', 2),
  ('241',  'Materiel et outillage', 2),
  ('2441', 'Materiel de bureau', 2),
  ('2442', 'Materiel informatique', 2),
  ('245',  'Materiel de transport', 2),
  ('281',  'Amortissements des immobilisations', 2),
  ('311',  'Marchandises', 3),
  ('321',  'Matieres premieres', 3),
  ('36',   'Produits finis', 3),
  ('401',  'Fournisseurs', 4),
  ('409',  'Fournisseurs debiteurs (avances)', 4),
  ('411',  'Clients', 4),
  ('419',  'Clients crediteurs (avances recues)', 4),
  ('421',  'Personnel, remunerations dues', 4),
  ('431',  'Securite sociale (IPRES, CSS)', 4),
  ('4431', 'Etat, TVA facturee (collectee)', 4),
  ('4452', 'Etat, TVA recuperable (deductible)', 4),
  ('4453', 'Etat, TVA due', 4),
  ('447',  'Etat, impots retenus a la source', 4),
  ('448',  'Etat, charges a payer', 4),
  ('521',  'Banques', 5),
  ('531',  'Cheques postaux', 5),
  ('571',  'Caisse', 5),
  ('585',  'Virements internes (mobile money)', 5),
  ('601',  'Achats de marchandises', 6),
  ('602',  'Achats de matieres premieres', 6),
  ('605',  'Autres achats (eau, electricite, carburant)', 6),
  ('612',  'Locations (loyer)', 6),
  ('614',  'Charges de transport', 6),
  ('616',  'Primes d''assurance', 6),
  ('618',  'Frais de telecommunication', 6),
  ('622',  'Honoraires et prestations exterieures', 6),
  ('627',  'Services bancaires', 6),
  ('628',  'Frais de publicite et marketing', 6),
  ('631',  'Frais d''entretien et reparations', 6),
  ('641',  'Impots et taxes', 6),
  ('661',  'Remunerations du personnel', 6),
  ('664',  'Charges sociales', 6),
  ('681',  'Dotations aux amortissements', 6),
  ('701',  'Ventes de marchandises', 7),
  ('702',  'Ventes de produits finis', 7),
  ('706',  'Prestations de services', 7),
  ('707',  'Produits accessoires', 7),
  ('771',  'Produits financiers', 7);
