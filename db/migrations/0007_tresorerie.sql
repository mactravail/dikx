-- =====================================================================
-- raktak ERP — pole Finance : TRESORERIE (comptes de disponibilites) (additif)
-- =====================================================================
-- S'ajoute aux schemas precedents sans les modifier. Reutilise la fonction
-- set_updated_at() definie en 0001.
--
-- Objet : suivre OU se trouve l'argent (banques, caisses, mobile money :
-- Wave, Orange Money, Ria, MoneyGram...), COMBIEN chaque compte contient, et
-- POURQUOI l'argent entre / sort (categorie + motif de chaque mouvement).
--
-- Conventions (identiques a 0001) :
--  - Montants FCFA (XOF) : entiers => bigint.
--  - RLS activee, aucune policy publique => acces backend (service_role) seul.
--  - `entreprise_id` scope chaque ligne par entreprise cliente (cf. 0006).
--
-- Regle non negociable : les soldes courants et totaux sont produits par le
-- MOTEUR deterministe cote serveur (src/engine/tresorerie-comptes.ts), jamais
-- dans le navigateur. Les colonnes de solde ci-dessous stockent le SNAPSHOT.
-- =====================================================================

create type type_compte_tresorerie as enum ('banque', 'caisse', 'mobile_money');
create type sens_mouvement_tresorerie as enum ('entree', 'sortie');

-- ------------------------------------------------------------------
-- comptes_tresorerie — un compte de disponibilites (banque/caisse/mobile)
-- ------------------------------------------------------------------
create table comptes_tresorerie (
  id             uuid primary key default gen_random_uuid(),
  entreprise_id  uuid not null references entreprise(id) on delete cascade,
  nom            text not null,
  type           type_compte_tresorerie not null default 'banque',
  operateur      text,                       -- Wave, Orange Money, CBAO, Ria...
  solde_initial  bigint not null default 0,
  -- Solde courant : SNAPSHOT calcule par le moteur (initial + entrees - sorties).
  solde_courant  bigint not null default 0,
  actif          boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
comment on table comptes_tresorerie is
  'Comptes de disponibilites (banque/caisse/mobile money). Solde courant = snapshot du moteur.';
create index idx_comptes_tresorerie_entreprise on comptes_tresorerie (entreprise_id, actif);

create trigger trg_comptes_tresorerie_updated
  before update on comptes_tresorerie
  for each row execute function set_updated_at();

-- ------------------------------------------------------------------
-- mouvements_tresorerie — encaissements / decaissements
-- ------------------------------------------------------------------
create table mouvements_tresorerie (
  id             uuid primary key default gen_random_uuid(),
  entreprise_id  uuid not null references entreprise(id) on delete cascade,
  compte_id      uuid not null references comptes_tresorerie(id) on delete cascade,
  date_mouvement date not null default current_date,
  sens           sens_mouvement_tresorerie not null,
  montant        bigint not null check (montant > 0),   -- toujours positif
  categorie      text not null default 'autre',         -- « pourquoi » (code de reference)
  motif          text,                                   -- « a qui / pour quoi » (libre)
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
comment on table mouvements_tresorerie is
  'Mouvements de tresorerie. Montant positif ; le sens porte l''impact sur le solde.';
create index idx_mouvements_tresorerie_compte on mouvements_tresorerie (compte_id, date_mouvement desc);
create index idx_mouvements_tresorerie_entreprise on mouvements_tresorerie (entreprise_id, date_mouvement desc);
create index idx_mouvements_tresorerie_categorie on mouvements_tresorerie (categorie);

create trigger trg_mouvements_tresorerie_updated
  before update on mouvements_tresorerie
  for each row execute function set_updated_at();

-- ------------------------------------------------------------------
-- Row Level Security (deny-by-default, acces service_role uniquement)
-- Aligne sur les tables modules 0002-0005 ; le scoping par cabinet via
-- entreprise sera cable au branchement Supabase du module.
-- ------------------------------------------------------------------
alter table comptes_tresorerie     enable row level security;
alter table mouvements_tresorerie  enable row level security;
