-- =====================================================================
-- raktak ERP — pole Organisation : RH (paie) + Projets & Taches (additif)
-- =====================================================================
-- S'ajoute aux schemas 0001 (previsionnel), 0002 (facturation) et 0003
-- (finance) sans les modifier. Reutilise la fonction set_updated_at() (0001).
--
-- Conventions (identiques aux migrations precedentes) :
--  - Montants FCFA (XOF) : entiers => bigint.
--  - Taux : numeric en fraction (0.056 = 5,6 %).
--  - RLS activee, aucune policy publique => acces backend (service_role) seul.
--
-- Regle non negociable : les montants de paie (cotisations, net a payer, cout
-- employeur, masse salariale) et les agregats de projet (avancement, heures)
-- sont produits par le MOTEUR deterministe cote serveur, jamais dans le
-- navigateur. Les colonnes de snapshot ci-dessous stockent le resultat du moteur.
-- =====================================================================

-- ------------------------------------------------------------------
-- Types enumeres
-- ------------------------------------------------------------------
create type type_contrat as enum ('CDI', 'CDD', 'stage', 'prestation');
create type statut_tache as enum ('a_faire', 'en_cours', 'termine');
create type statut_projet as enum ('actif', 'en_pause', 'termine');

-- ==================================================================
-- RH — personnel & paie
-- ==================================================================

-- ------------------------------------------------------------------
-- employes — registre du personnel + elements de paie mensuels
-- ------------------------------------------------------------------
create table employes (
  id                    uuid primary key default gen_random_uuid(),
  nom                   text not null,
  poste                 text,
  type_contrat          type_contrat not null default 'CDI',
  date_embauche         date,
  telephone             text,
  actif                 boolean not null default true,
  -- Elements de paie (SAISIE).
  salaire_brut_mensuel  bigint not null default 0 check (salaire_brut_mensuel >= 0),
  primes                bigint not null default 0 check (primes >= 0),
  autres_retenues       bigint not null default 0 check (autres_retenues >= 0),
  -- Net a payer et cout employeur : SNAPSHOT calcule par le moteur.
  net_a_payer           bigint not null default 0 check (net_a_payer >= 0),
  cout_employeur        bigint not null default 0 check (cout_employeur >= 0),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
comment on table employes is 'Registre du personnel. Net/cout = snapshot du moteur de paie.';
create index idx_employes_actif on employes (actif);

create trigger trg_employes_updated
  before update on employes
  for each row execute function set_updated_at();

-- ==================================================================
-- Projets & Taches
-- ==================================================================

-- ------------------------------------------------------------------
-- projets — projets internes ou clients
-- ------------------------------------------------------------------
create table projets (
  id          uuid primary key default gen_random_uuid(),
  nom         text not null,
  client      text,
  statut      statut_projet not null default 'actif',
  echeance    date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table projets is 'Projets internes / clients (module Organisation).';
create index idx_projets_statut on projets (statut);

create trigger trg_projets_updated
  before update on projets
  for each row execute function set_updated_at();

-- ------------------------------------------------------------------
-- taches — taches rattachees a un projet (kanban + feuille de temps)
-- ------------------------------------------------------------------
create table taches (
  id                uuid primary key default gen_random_uuid(),
  projet_id         uuid not null references projets(id) on delete cascade,
  titre             text not null,
  statut            statut_tache not null default 'a_faire',
  assignee          text,
  echeance          date,
  -- Heures : charge, pas de la monnaie => numeric (peuvent etre decimales).
  heures_estimees   numeric(8,2) not null default 0 check (heures_estimees >= 0),
  heures_realisees  numeric(8,2) not null default 0 check (heures_realisees >= 0),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
comment on table taches is 'Taches de projet. L''avancement agrege est calcule par le moteur.';
create index idx_taches_projet on taches (projet_id);
create index idx_taches_statut on taches (statut);

create trigger trg_taches_updated
  before update on taches
  for each row execute function set_updated_at();

-- ------------------------------------------------------------------
-- Row Level Security (deny-by-default, acces service_role uniquement)
-- ------------------------------------------------------------------
alter table employes  enable row level security;
alter table projets   enable row level security;
alter table taches    enable row level security;
