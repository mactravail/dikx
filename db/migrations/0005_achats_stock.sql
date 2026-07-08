-- =====================================================================
-- raktak ERP — pole Achats & Stock : fournisseurs, stocks, achats,
-- production / MRP (additif)
-- =====================================================================
-- S'ajoute aux schemas 0001 (previsionnel), 0002 (facturation), 0003 (finance)
-- et 0004 (organisation) sans les modifier. Reutilise set_updated_at() (0001).
--
-- Conventions (identiques aux migrations precedentes) :
--  - Montants FCFA (XOF) : entiers => bigint.
--  - Taux : numeric en fraction (0.18 = 18 %).
--  - Quantites physiques (kg, L, pieces...) : numeric (peuvent etre decimales).
--  - RLS activee, aucune policy publique => acces backend (service_role) seul.
--
-- Regle non negociable : la valorisation du stock (CUMP, valeur), les totaux des
-- commandes d'achat (HT, TVA, TTC, reste a payer), les encours fournisseurs et
-- les besoins matiere (MRP) sont produits par le MOTEUR deterministe cote
-- serveur, jamais dans le navigateur. Les colonnes de snapshot ci-dessous
-- stockent le resultat du moteur.
-- =====================================================================

-- ------------------------------------------------------------------
-- Types enumeres
-- ------------------------------------------------------------------
create type type_article as enum ('matiere_premiere', 'produit_fini', 'marchandise');
create type type_mouvement as enum ('entree', 'sortie', 'inventaire');
create type statut_commande as enum ('brouillon', 'envoyee', 'recue_partiel', 'recue', 'annulee');
create type statut_ordre as enum ('planifie', 'en_cours', 'termine');

-- ==================================================================
-- Fournisseurs
-- ==================================================================
create table fournisseurs (
  id                    uuid primary key default gen_random_uuid(),
  nom                   text not null,
  contact               text,
  telephone             text,
  email                 text,
  ville                 text,
  delai_paiement_jours  integer not null default 30 check (delai_paiement_jours >= 0),
  -- Encours (solde du) : SAISIE ; l'agregation echu / a echoir est faite par le moteur.
  encours               bigint not null default 0 check (encours >= 0),
  echeance              date,
  actif                 boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
comment on table fournisseurs is 'Repertoire fournisseurs. Encours agrege par le moteur.';
create index idx_fournisseurs_actif on fournisseurs (actif);

create trigger trg_fournisseurs_updated
  before update on fournisseurs
  for each row execute function set_updated_at();

-- ==================================================================
-- Stocks — articles & mouvements
-- ==================================================================

-- ------------------------------------------------------------------
-- articles — matieres premieres, produits finis, marchandises
-- ------------------------------------------------------------------
create table articles (
  id             uuid primary key default gen_random_uuid(),
  ref            text not null unique,
  designation    text not null,
  type           type_article not null default 'matiere_premiere',
  unite          text not null default 'unite',
  seuil_alerte   numeric(14,3) not null default 0 check (seuil_alerte >= 0),
  -- Snapshot du moteur (rejeu des mouvements au CUMP).
  quantite       numeric(14,3) not null default 0,
  cump           bigint not null default 0 check (cump >= 0),
  valeur_stock   bigint not null default 0 check (valeur_stock >= 0),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
comment on table articles is 'Articles en stock. Quantite / CUMP / valeur = snapshot du moteur.';
create index idx_articles_type on articles (type);

create trigger trg_articles_updated
  before update on articles
  for each row execute function set_updated_at();

-- ------------------------------------------------------------------
-- mouvements_stock — historique valorise par le moteur (CUMP)
-- ------------------------------------------------------------------
create table mouvements_stock (
  id             uuid primary key default gen_random_uuid(),
  article_id     uuid not null references articles(id) on delete cascade,
  type           type_mouvement not null,
  quantite       numeric(14,3) not null check (quantite >= 0),
  -- Cout unitaire HT : requis pour une entree (valorisation), sinon null.
  cout_unitaire  bigint check (cout_unitaire is null or cout_unitaire >= 0),
  date_mouvement date not null default current_date,
  note           text,
  created_at     timestamptz not null default now()
);
comment on table mouvements_stock is 'Mouvements de stock (le moteur les rejoue pour le CUMP).';
create index idx_mouvements_article on mouvements_stock (article_id);

-- ==================================================================
-- Achats — commandes & lignes
-- ==================================================================

-- ------------------------------------------------------------------
-- commandes_achat — en-tete de commande
-- ------------------------------------------------------------------
create table commandes_achat (
  id             uuid primary key default gen_random_uuid(),
  numero         text not null,
  fournisseur_id uuid references fournisseurs(id) on delete set null,
  -- Denormalise pour l'affichage / l'historique meme si le fournisseur est efface.
  fournisseur    text not null,
  date_commande  date not null default current_date,
  statut         statut_commande not null default 'brouillon',
  assujetti_tva  boolean not null default true,
  montant_paye   bigint not null default 0 check (montant_paye >= 0),
  -- Totaux : SNAPSHOT du moteur.
  total_ht       bigint not null default 0 check (total_ht >= 0),
  total_tva      bigint not null default 0 check (total_tva >= 0),
  total_ttc      bigint not null default 0 check (total_ttc >= 0),
  reste_a_payer  bigint not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
comment on table commandes_achat is 'Commandes d''achat. Totaux = snapshot du moteur.';
create index idx_commandes_fournisseur on commandes_achat (fournisseur_id);
create index idx_commandes_statut on commandes_achat (statut);

create trigger trg_commandes_achat_updated
  before update on commandes_achat
  for each row execute function set_updated_at();

-- ------------------------------------------------------------------
-- lignes_commande_achat — lignes + suivi de reception
-- ------------------------------------------------------------------
create table lignes_commande_achat (
  id                uuid primary key default gen_random_uuid(),
  commande_id       uuid not null references commandes_achat(id) on delete cascade,
  article_id        uuid references articles(id) on delete set null,
  designation       text not null,
  quantite          numeric(14,3) not null default 0 check (quantite >= 0),
  quantite_recue    numeric(14,3) not null default 0 check (quantite_recue >= 0),
  prix_unitaire_ht  bigint not null default 0 check (prix_unitaire_ht >= 0),
  taux_tva          numeric(6,4),
  -- Montants de ligne : SNAPSHOT du moteur.
  montant_ht        bigint not null default 0,
  montant_tva       bigint not null default 0,
  montant_ttc       bigint not null default 0,
  position          integer not null default 0,
  created_at        timestamptz not null default now()
);
comment on table lignes_commande_achat is 'Lignes de commande. Montants = snapshot du moteur.';
create index idx_lignes_commande on lignes_commande_achat (commande_id);

-- ==================================================================
-- Production / MRP — nomenclatures, composants, ordres
-- ==================================================================

-- ------------------------------------------------------------------
-- nomenclatures — BOM d'un produit fini
-- ------------------------------------------------------------------
create table nomenclatures (
  id           uuid primary key default gen_random_uuid(),
  produit_ref  text not null unique,
  designation  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
comment on table nomenclatures is 'Nomenclatures (BOM) des produits fabriques.';

create trigger trg_nomenclatures_updated
  before update on nomenclatures
  for each row execute function set_updated_at();

-- ------------------------------------------------------------------
-- composants_nomenclature — un composant et sa quantite unitaire
-- ------------------------------------------------------------------
create table composants_nomenclature (
  id              uuid primary key default gen_random_uuid(),
  nomenclature_id uuid not null references nomenclatures(id) on delete cascade,
  composant_ref   text not null,
  designation     text,
  -- Quantite de composant par unite de produit fini.
  quantite        numeric(14,4) not null default 0 check (quantite >= 0),
  cout_unitaire   bigint not null default 0 check (cout_unitaire >= 0),
  created_at      timestamptz not null default now()
);
comment on table composants_nomenclature is 'Composants d''une nomenclature (quantite par unite produite).';
create index idx_composants_nomenclature on composants_nomenclature (nomenclature_id);

-- ------------------------------------------------------------------
-- ordres_fabrication — produire une quantite d'un produit
-- ------------------------------------------------------------------
create table ordres_fabrication (
  id            uuid primary key default gen_random_uuid(),
  produit_ref   text not null,
  quantite      numeric(14,3) not null default 0 check (quantite >= 0),
  statut        statut_ordre not null default 'planifie',
  echeance      date,
  -- Cout matiere : SNAPSHOT du moteur (MRP).
  cout_matiere  bigint not null default 0 check (cout_matiere >= 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
comment on table ordres_fabrication is 'Ordres de fabrication. Cout matiere = snapshot du moteur.';
create index idx_ordres_statut on ordres_fabrication (statut);

create trigger trg_ordres_fabrication_updated
  before update on ordres_fabrication
  for each row execute function set_updated_at();

-- ------------------------------------------------------------------
-- Row Level Security (deny-by-default, acces service_role uniquement)
-- ------------------------------------------------------------------
alter table fournisseurs             enable row level security;
alter table articles                 enable row level security;
alter table mouvements_stock         enable row level security;
alter table commandes_achat          enable row level security;
alter table lignes_commande_achat    enable row level security;
alter table nomenclatures            enable row level security;
alter table composants_nomenclature  enable row level security;
alter table ordres_fabrication       enable row level security;
