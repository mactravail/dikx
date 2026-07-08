-- =====================================================================
-- Multi-entreprise — cabinet comptable & portefeuille d'entreprises
-- =====================================================================
-- raktak est utilise par un comptable / cabinet qui gere plusieurs
-- entreprises clientes (formelles ET informelles). Cette migration introduit
-- l'entite `entreprise`, socle du multi-tenant :
--
--   auth.users (le cabinet)  1 ---- N  entreprise (les dossiers clients)
--
-- Changement de modele d'acces : jusqu'ici tout etait deny-all + service_role
-- (migration 0001). Ici on ouvre un acces AUTHENTIFIE par cabinet — un
-- comptable ne voit QUE ses propres entreprises (RLS `cabinet_id = auth.uid()`).
--
-- Le scoping des tables des modules (facturation, comptabilite, paie, stock,
-- previsionnel...) par `entreprise_id` sera ajoute au branchement Supabase de
-- chaque module (voir les migrations 0002-0005, aujourd'hui non cablees). Cette
-- migration ne cree que le socle cabinet -> entreprise.
--
-- Conventions : cf. 0001 (montants bigint FCFA, taux numeric fraction, RLS).
-- =====================================================================

-- ------------------------------------------------------------------
-- Types enumeres — regimes (Senegal / OHADA)
-- ------------------------------------------------------------------
-- normal        : Systeme Normal SYSCOHADA (comptabilite d'engagement complete).
-- smt           : Systeme Minimal de Tresorerie (TPE sous seuils, tresorerie).
-- entreprenant  : statut OHADA de l'Entreprenant (obligations minimales).
create type regime_comptable as enum ('normal', 'smt', 'entreprenant');

-- reel : imposition au reel (facture la TVA, releve de l'IS).
-- cgu  : Contribution Globale Unique (impot synthetique ; ni TVA ni IS).
create type regime_fiscal as enum ('reel', 'cgu');

-- ------------------------------------------------------------------
-- entreprise — une entreprise cliente du cabinet
-- ------------------------------------------------------------------
create table entreprise (
  id                 uuid primary key default gen_random_uuid(),
  -- Proprietaire : le cabinet = le compte utilisateur Supabase.
  cabinet_id         uuid not null references auth.users(id) on delete cascade,

  raison_sociale     text not null,
  sigle              text,
  ninea              text,                 -- identifiant fiscal SN
  rccm               text,                 -- registre du commerce
  secteur            text,
  forme_juridique    forme_juridique not null default 'SARL',

  regime_comptable   regime_comptable not null default 'normal',
  regime_fiscal      regime_fiscal   not null default 'reel',
  assujetti_tva      boolean not null default true,

  exercice_debut_mois smallint not null default 1
                        check (exercice_debut_mois between 1 and 12),

  actif       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- Coherence : sous la CGU, jamais de TVA facturee.
  constraint cgu_sans_tva check (regime_fiscal <> 'cgu' or assujetti_tva = false)
);
comment on table entreprise is
  'Entreprises clientes gerees par un cabinet (multi-tenant). Scope de tous les modules.';
create index idx_entreprise_cabinet on entreprise (cabinet_id, actif);

create trigger trg_entreprise_updated
  before update on entreprise
  for each row execute function set_updated_at();

-- ------------------------------------------------------------------
-- Row Level Security — un cabinet ne voit que SES entreprises
-- ------------------------------------------------------------------
-- Contrairement aux tables 0001 (deny-all, acces service_role uniquement),
-- `entreprise` est accessible par l'utilisateur authentifie proprietaire.
-- service_role (backend) continue de contourner la RLS.
alter table entreprise enable row level security;

create policy entreprise_select_own on entreprise
  for select using (cabinet_id = auth.uid());

create policy entreprise_insert_own on entreprise
  for insert with check (cabinet_id = auth.uid());

create policy entreprise_update_own on entreprise
  for update using (cabinet_id = auth.uid())
  with check (cabinet_id = auth.uid());

create policy entreprise_delete_own on entreprise
  for delete using (cabinet_id = auth.uid());
