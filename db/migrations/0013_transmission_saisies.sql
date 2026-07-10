-- =====================================================================
-- Circuit « brouillon -> envoi au comptable » sur les tables de SAISIE (additif)
-- =====================================================================
-- Jusqu'ici, toute saisie de l'entreprise etait vue IMMEDIATEMENT par le
-- comptable (RLS `peut_acceder`). On introduit un etat de TRANSMISSION :
--
--   brouillon : saisi par l'entreprise, encore prive (le comptable NE LE VOIT PAS).
--   envoye    : transmis au comptable (par lot, depuis le tableau de bord entreprise).
--
-- Regles portees par cette migration :
--   1. Le comptable ne voit QUE le non-brouillon  -> reecriture des policies SELECT
--      (le membre de l'entreprise continue de voir TOUTES ses lignes, brouillons compris).
--   2. La saisie faite par le comptable lui-meme doit rester visible : les
--      server actions la taguent `envoye` a l'insert (cf. lib/roles-serveur.ts).
--
-- Colonne dediee `transmission` : `documents.statut` est deja le cycle de vie de
-- la facture (brouillon/emis/paye...), on ne le reutilise donc pas.
--
-- NB : tables supposees VIDES en prod -> les rares lignes existantes prendraient
-- la valeur par defaut `brouillon` (donc invisibles au comptable jusqu'a envoi).
-- =====================================================================

create type etat_transmission as enum ('brouillon', 'envoye');

-- ------------------------------------------------------------------
-- Ajout de la colonne d'etat + horodatage d'envoi sur les 4 tables de chiffres.
-- ------------------------------------------------------------------
alter table mouvements_tresorerie
  add column transmission etat_transmission not null default 'brouillon',
  add column transmis_le  timestamptz;
alter table depenses
  add column transmission etat_transmission not null default 'brouillon',
  add column transmis_le  timestamptz;
alter table employes
  add column transmission etat_transmission not null default 'brouillon',
  add column transmis_le  timestamptz;
alter table documents
  add column transmission etat_transmission not null default 'brouillon',
  add column transmis_le  timestamptz;

-- Index partiels : compter/lister rapidement les brouillons d'une entreprise.
create index idx_mvt_tresorerie_brouillon on mouvements_tresorerie (entreprise_id)
  where transmission = 'brouillon';
create index idx_depenses_brouillon on depenses (entreprise_id)
  where transmission = 'brouillon';
create index idx_employes_brouillon on employes (entreprise_id)
  where transmission = 'brouillon';
create index idx_documents_brouillon on documents (entreprise_id)
  where transmission = 'brouillon';

-- ------------------------------------------------------------------
-- Reecriture des policies SELECT : le comptable exclut les brouillons.
--   membre de l'entreprise      -> voit TOUT (y compris ses brouillons)
--   comptable proprietaire      -> voit uniquement transmission <> 'brouillon'
-- (INSERT/UPDATE/DELETE restent en `peut_acceder` : cf. 0010/0011/0012.)
-- service_role (admin) contourne la RLS et voit tout.
-- ------------------------------------------------------------------
drop policy if exists mouvements_tresorerie_select on mouvements_tresorerie;
create policy mouvements_tresorerie_select on mouvements_tresorerie for select using (
  est_membre_de(entreprise_id)
  or (est_comptable_du(entreprise_id) and transmission <> 'brouillon')
);

drop policy if exists depenses_select on depenses;
create policy depenses_select on depenses for select using (
  est_membre_de(entreprise_id)
  or (est_comptable_du(entreprise_id) and transmission <> 'brouillon')
);

drop policy if exists employes_select on employes;
create policy employes_select on employes for select using (
  est_membre_de(entreprise_id)
  or (est_comptable_du(entreprise_id) and transmission <> 'brouillon')
);

drop policy if exists documents_select on documents;
create policy documents_select on documents for select using (
  est_membre_de(entreprise_id)
  or (est_comptable_du(entreprise_id) and transmission <> 'brouillon')
);
