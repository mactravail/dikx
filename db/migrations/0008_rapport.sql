-- =====================================================================
-- raktak ERP — Pilotage : RAPPORT FINANCIER (additif)
-- =====================================================================
-- S'ajoute aux schemas precedents sans les modifier. Reutilise la fonction
-- set_updated_at() (0001) et l'entite entreprise (0006).
--
-- Objet : produire un rapport d'exercice complet a partir des donnees deja
-- saisies (compte de resultat, bilan, tresorerie) + un narratif redige par le
-- comptable + des references de comparaison (N-1, budget).
--
-- Deux volets :
--   1. Coordonnees de l'entreprise (en-tete des documents/rapport) : colonnes
--      ajoutees a `entreprise`.
--   2. Snapshot d'un rapport financier : table `rapport_financier`.
--
-- Conventions (identiques a 0001) :
--  - Montants FCFA (XOF) : entiers => bigint.
--  - Taux : numeric (fraction ; 0.18 = 18 %).
--  - RLS activee ; le scoping par cabinet suit le modele de 0006/0007.
--
-- Regle non negociable : tous les montants et ratios du rapport sont produits
-- par le MOTEUR deterministe (src/engine/rapport-financier.ts), jamais dans le
-- navigateur. Les colonnes chiffrees ci-dessous stockent le SNAPSHOT du moteur ;
-- les colonnes de texte stockent le narratif (qui n'est pas un chiffre).
-- =====================================================================

-- ------------------------------------------------------------------
-- 1. Coordonnees de l'entreprise (en-tete des documents / du rapport)
-- ------------------------------------------------------------------
alter table entreprise
  add column if not exists adresse        text,
  add column if not exists ville          text,
  add column if not exists telephone      text,
  add column if not exists email          text,
  add column if not exists site_web       text,
  add column if not exists representant   text,   -- gerant / signataire des documents
  add column if not exists capital_social bigint  -- saisie statutaire (FCFA), pas un total calcule
    check (capital_social is null or capital_social >= 0);

comment on column entreprise.representant is
  'Representant legal / gerant : signataire des factures et du rapport financier.';
comment on column entreprise.capital_social is
  'Capital social en FCFA (saisie d''identite statutaire, pas un total calcule).';

-- ------------------------------------------------------------------
-- 2. rapport_financier — un rapport d'exercice (snapshot + narratif)
-- ------------------------------------------------------------------
create table rapport_financier (
  id             uuid primary key default gen_random_uuid(),
  entreprise_id  uuid not null references entreprise(id) on delete cascade,

  -- Parametres du rapport.
  exercice          smallint not null,            -- annee civile de cloture
  periode           text,                          -- ex. « Janvier – Decembre 2025 »
  lieu              text,
  date_presentation text,

  -- Narratif redige par le comptable (texte libre, pas un chiffre).
  faits_marquants       text,
  analyse_exploitation  text,
  analyse_ecarts        text,
  perspectives          text,
  conclusion            text,

  -- References de comparaison SAISIES (N-1, budget). NULL = non renseigne.
  n1_chiffre_affaires   bigint,
  n1_total_produits     bigint,
  n1_total_charges      bigint,
  n1_resultat_net       bigint,
  budget_chiffre_affaires bigint,
  budget_total_produits   bigint,
  budget_total_charges    bigint,
  budget_resultat_net     bigint,

  -- Snapshot des indicateurs calcules par le MOTEUR (jamais par l'UI).
  chiffre_affaires   bigint,
  total_produits     bigint,
  total_charges      bigint,
  resultat_net       bigint,
  marge_nette        numeric,          -- fraction (0.20 = 20 %)
  capitaux_propres   bigint,
  dettes_financieres bigint,
  fonds_de_roulement bigint,
  bfr                bigint,
  tresorerie_nette   bigint,
  -- Snapshot complet (synthese + ratios + exploitation) pour reimpression fidele.
  snapshot           jsonb,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint rapport_exercice_valide check (exercice between 2000 and 2100)
);
comment on table rapport_financier is
  'Rapport financier d''exercice : parametres + narratif + snapshot des indicateurs (moteur).';
comment on column rapport_financier.snapshot is
  'Snapshot JSON complet renvoye par calculerRapportFinancier (reimpression fidele).';
create index idx_rapport_entreprise on rapport_financier (entreprise_id, exercice desc);

create trigger trg_rapport_financier_updated
  before update on rapport_financier
  for each row execute function set_updated_at();

-- ------------------------------------------------------------------
-- Row Level Security (deny-by-default, acces service_role uniquement)
-- Aligne sur les tables modules 0002-0007 ; le scoping par cabinet via
-- entreprise sera cable au branchement Supabase du module.
-- ------------------------------------------------------------------
alter table rapport_financier enable row level security;
