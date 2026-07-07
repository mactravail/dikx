-- =====================================================================
-- Previsionnel Financier 5 ans — schema initial Supabase (Postgres)
-- =====================================================================
-- Stocke l'etat des conversations WhatsApp (collecte par n8n) et les
-- reponses qui alimentent le moteur de calcul (DossierInput).
--
-- Conventions :
--  - Montants FCFA (XOF) : entiers => type bigint (un projet peut depasser
--    la borne d'int4 = 2,147,483,647).
--  - Taux : numeric en fraction (0.18 = 18 %).
--  - Enums en snake_case ; le mapper TypeScript traduit vers le domaine
--    (ex. 'frais_etablissement' -> 'fraisEtablissement').
--  - Acces uniquement par le backend (service_role, qui contourne la RLS).
--    RLS activee partout sans policy publique => deny-by-default pour anon.
-- =====================================================================

create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ------------------------------------------------------------------
-- Types enumeres
-- ------------------------------------------------------------------
create type forme_juridique as enum ('SARL', 'SUARL', 'SA', 'GIE', 'EI');

create type nature_investissement as enum (
  'terrain', 'construction', 'materiel', 'mobilier',
  'informatique', 'vehicule', 'frais_etablissement', 'autre'
);

create type ca_mode as enum ('simple', 'detaille');

create type achats_mode as enum ('pourcentage_ca', 'montant');

create type statut_conversation as enum (
  'en_cours', 'en_recapitulatif', 'terminee', 'abandonnee'
);

create type statut_generation as enum (
  'en_attente', 'genere', 'envoye', 'erreur'
);

-- ------------------------------------------------------------------
-- Helper : maj automatique de updated_at
-- ------------------------------------------------------------------
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ------------------------------------------------------------------
-- conversations — etat de la session WhatsApp
-- ------------------------------------------------------------------
create table conversations (
  id              uuid primary key default gen_random_uuid(),
  telephone       text not null,                       -- numero WhatsApp
  locale          text not null default 'fr',
  statut          statut_conversation not null default 'en_cours',
  etape_courante  text,                                -- ex. '1.2' (numero de question)
  contexte        jsonb not null default '{}'::jsonb,  -- libre pour l'agent n8n
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  last_message_at timestamptz
);
comment on table conversations is 'Etat des sessions WhatsApp gerees par n8n.';
create index idx_conversations_telephone on conversations (telephone);
create index idx_conversations_statut on conversations (statut);
-- Une seule conversation active a la fois par numero.
create unique index uniq_conversation_active
  on conversations (telephone) where statut = 'en_cours';

create trigger trg_conversations_updated
  before update on conversations
  for each row execute function set_updated_at();

-- ------------------------------------------------------------------
-- dossiers — les reponses, miroir de DossierInput
-- ------------------------------------------------------------------
create table dossiers (
  id                          uuid primary key default gen_random_uuid(),
  conversation_id             uuid references conversations(id) on delete cascade,

  -- Bloc 0 — identite
  nom_projet                  text,
  secteur                     text,
  forme_juridique             forme_juridique not null default 'SARL',
  mois_demarrage_mois         smallint check (mois_demarrage_mois between 1 and 12),
  mois_demarrage_annee        smallint,
  assujetti_tva               boolean not null default true,

  -- Bloc 2 — financement
  apport_capital              bigint not null default 0 check (apport_capital >= 0),
  apport_compte_courant       bigint not null default 0 check (apport_compte_courant >= 0),
  subvention_investissement   bigint not null default 0 check (subvention_investissement >= 0),
  emprunt_present             boolean not null default false,
  emprunt_montant             bigint check (emprunt_montant >= 0),
  emprunt_taux_annuel         numeric(6,5) check (emprunt_taux_annuel >= 0),
  emprunt_duree_annees        smallint check (emprunt_duree_annees > 0),
  emprunt_differe_mois        smallint not null default 0 check (emprunt_differe_mois >= 0),

  -- Bloc 3 — chiffre d'affaires
  ca_mode                     ca_mode not null default 'simple',
  ca_montant_annee1           bigint check (ca_montant_annee1 >= 0),
  ca_taux_croissance          numeric(6,5) not null default 0,
  ca_saisonnier               boolean not null default false,
  ca_repartition_mensuelle    numeric[]
                                check (ca_repartition_mensuelle is null
                                       or array_length(ca_repartition_mensuelle, 1) = 12),

  -- Bloc 4 — charges d'exploitation
  achats_mode                 achats_mode not null default 'pourcentage_ca',
  achats_valeur               numeric not null default 0 check (achats_valeur >= 0),
  loyer_mensuel               bigint not null default 0 check (loyer_mensuel >= 0),
  eau_electricite_mensuel     bigint not null default 0 check (eau_electricite_mensuel >= 0),
  telecom_mensuel             bigint not null default 0 check (telecom_mensuel >= 0),
  transport_carburant_annuel  bigint not null default 0 check (transport_carburant_annuel >= 0),
  assurances_annuel           bigint not null default 0 check (assurances_annuel >= 0),
  honoraires_annuel           bigint not null default 0 check (honoraires_annuel >= 0),
  marketing_annuel            bigint not null default 0 check (marketing_annuel >= 0),
  entretien_divers_annuel     bigint not null default 0 check (entretien_divers_annuel >= 0),
  impots_taxes_annuel         bigint not null default 0 check (impots_taxes_annuel >= 0),

  -- Bloc 5 — salaire dirigeant (null = pas de salaire)
  salaire_dirigeant_mensuel   bigint check (salaire_dirigeant_mensuel >= 0),

  -- Bloc 6 — delais (BFR)
  delai_clients_jours         smallint not null default 0 check (delai_clients_jours >= 0),
  delai_fournisseurs_jours    smallint not null default 30 check (delai_fournisseurs_jours >= 0),
  delai_stock_jours           smallint not null default 0 check (delai_stock_jours >= 0),

  -- Bloc 7 — override des taux (null = parametres par defaut du moteur)
  taux_tva_override                 numeric(6,5),
  taux_is_override                  numeric(6,5),
  taux_charges_sociales_override    numeric(6,5),

  statut      statut_generation not null default 'en_attente',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- Coherence : si emprunt present, les champs cles sont renseignes.
  constraint emprunt_complet check (
    emprunt_present = false
    or (emprunt_montant is not null
        and emprunt_taux_annuel is not null
        and emprunt_duree_annees is not null)
  )
);
comment on table dossiers is 'Reponses collectees, miroir de DossierInput (moteur).';
create index idx_dossiers_conversation on dossiers (conversation_id);

create trigger trg_dossiers_updated
  before update on dossiers
  for each row execute function set_updated_at();

-- ------------------------------------------------------------------
-- investissements — boucle (bloc 1)
-- ------------------------------------------------------------------
create table investissements (
  id                  uuid primary key default gen_random_uuid(),
  dossier_id          uuid not null references dossiers(id) on delete cascade,
  ordre               smallint not null default 0,
  nature              nature_investissement not null,
  libelle             text,
  montant_ht          bigint not null check (montant_ht >= 0),
  duree_amortissement smallint check (duree_amortissement >= 0)  -- null = defaut selon nature
);
create index idx_investissements_dossier on investissements (dossier_id, ordre);

-- ------------------------------------------------------------------
-- postes_personnel — boucle (bloc 5)
-- ------------------------------------------------------------------
create table postes_personnel (
  id                   uuid primary key default gen_random_uuid(),
  dossier_id           uuid not null references dossiers(id) on delete cascade,
  ordre                smallint not null default 0,
  intitule             text not null,
  nombre               smallint not null default 1 check (nombre >= 0),
  salaire_brut_mensuel bigint not null check (salaire_brut_mensuel >= 0)
);
create index idx_postes_dossier on postes_personnel (dossier_id, ordre);

-- ------------------------------------------------------------------
-- produits_ca — boucle (bloc 3, mode detaille)
-- ------------------------------------------------------------------
create table produits_ca (
  id              uuid primary key default gen_random_uuid(),
  dossier_id      uuid not null references dossiers(id) on delete cascade,
  ordre           smallint not null default 0,
  libelle         text not null,
  prix_unitaire   bigint not null check (prix_unitaire >= 0),
  quantite_annee1 numeric not null check (quantite_annee1 >= 0)
);
create index idx_produits_dossier on produits_ca (dossier_id, ordre);

-- ------------------------------------------------------------------
-- generations — chaque production de dossier (PDF + email)
-- ------------------------------------------------------------------
create table generations (
  id                 uuid primary key default gen_random_uuid(),
  dossier_id         uuid not null references dossiers(id) on delete cascade,
  statut             statut_generation not null default 'en_attente',
  sortie             jsonb,          -- snapshot DossierOutput
  avertissements     jsonb,          -- copie des avertissements du moteur
  pdf_path           text,           -- chemin dans Supabase Storage
  email_destinataire text,
  email_envoye_at    timestamptz,
  erreur             text,
  created_at         timestamptz not null default now()
);
create index idx_generations_dossier on generations (dossier_id, created_at desc);

-- ------------------------------------------------------------------
-- messages — journal optionnel des echanges WhatsApp
-- ------------------------------------------------------------------
create table messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sens            text not null check (sens in ('entrant', 'sortant')),
  contenu         text,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);
create index idx_messages_conversation on messages (conversation_id, created_at);

-- ------------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------------
-- Acces serveur uniquement (service_role contourne la RLS). Aucune policy
-- publique => les roles anon / authenticated n'ont aucun acces.
alter table conversations     enable row level security;
alter table dossiers          enable row level security;
alter table investissements   enable row level security;
alter table postes_personnel  enable row level security;
alter table produits_ca       enable row level security;
alter table generations       enable row level security;
alter table messages          enable row level security;
