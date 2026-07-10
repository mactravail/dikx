/**
 * Contrat de donnees du pole Organisation (RH / paie + projets / taches).
 *
 * Persiste dans SUPABASE (tables 0004 + entreprise_id 0011/0014), sous RLS
 * scopee par entreprise, via les server actions rh/projets. Le `store` ci-dessous
 * ne fait que deleguer a ces actions (methodes ASYNC).
 *
 * Regle raktak respectee : ce fichier ne contient AUCUN calcul monetaire. Les
 * seuls montants stockes ici sont soit des SAISIES (brut, primes, retenues),
 * soit des SNAPSHOTS renvoyes par le moteur (server action) — jamais un total
 * calcule par l'UI. Les libelles/constantes ci-dessous sont des donnees de
 * REFERENCE (pas des taux) : ils servent la saisie, pas le calcul.
 */

import type { StatutTache } from "./engine";
import type { EtatTransmission } from "./transmission";
import {
  listerEmployesAction,
  upsertEmployeAction,
  supprimerEmployeAction,
} from "@/app/(app)/rh/data-actions";
import {
  listerProjetsAction,
  upsertProjetAction,
  supprimerProjetAction,
  listerTachesAction,
  upsertTacheAction,
  supprimerTacheAction,
} from "@/app/(app)/projets/data-actions";

/* ------------------------------- RH / paie ------------------------------- */

export type TypeContrat = "CDI" | "CDD" | "stage" | "prestation";

export interface EmployeLocal {
  id: string;
  nom: string;
  poste: string;
  typeContrat: TypeContrat;
  dateEmbauche: string; // AAAA-MM-JJ
  telephone?: string;
  actif: boolean;
  // Elements de paie mensuels (SAISIE).
  salaireBrutMensuel: number;
  primes: number;
  autresRetenues: number;
  // Snapshots du moteur (source: server action) — jamais recalcules dans l'UI.
  netAPayer: number;
  coutEmployeur: number;
  /** Etat de transmission au comptable (0013). Absent = brouillon. */
  transmission?: EtatTransmission;
}

export const TYPES_CONTRAT: ReadonlyArray<[TypeContrat, string]> = [
  ["CDI", "CDI"],
  ["CDD", "CDD"],
  ["stage", "Stage"],
  ["prestation", "Prestation"],
];

export function libelleContrat(t: TypeContrat): string {
  return TYPES_CONTRAT.find(([v]) => v === t)?.[1] ?? t;
}

/* ---------------------------- Projets / taches --------------------------- */

export type StatutProjet = "actif" | "en_pause" | "termine";

export interface ProjetLocal {
  id: string;
  nom: string;
  client?: string;
  statut: StatutProjet;
  echeance?: string; // AAAA-MM-JJ
}

export interface TacheLocal {
  id: string;
  projetId: string;
  titre: string;
  statut: StatutTache;
  assignee?: string;
  echeance?: string; // AAAA-MM-JJ
  heuresEstimees: number;
  heuresRealisees: number;
}

/** Etats d'une tache (colonnes kanban), dans l'ordre. */
export const STATUTS_TACHE: ReadonlyArray<[StatutTache, string]> = [
  ["a_faire", "A faire"],
  ["en_cours", "En cours"],
  ["termine", "Termine"],
];

export const STATUTS_PROJET: ReadonlyArray<[StatutProjet, string]> = [
  ["actif", "Actif"],
  ["en_pause", "En pause"],
  ["termine", "Termine"],
];

export function libelleStatutTache(s: StatutTache): string {
  return STATUTS_TACHE.find(([v]) => v === s)?.[1] ?? s;
}

export function libelleStatutProjet(s: StatutProjet): string {
  return STATUTS_PROJET.find(([v]) => v === s)?.[1] ?? s;
}

/* ----------------------------- identifiants ----------------------------- */

export function genId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/* ------------------------------- stockage ------------------------------- */
// Employes, projets & taches sont persistes dans Supabase (RLS, scope par
// entreprise) via les data-actions. Toutes les methodes sont ASYNC et prennent
// l'id de l'entreprise active (fourni par le contexte cote client).

export const store = {
  // Employes : Supabase (RLS), methodes ASYNC scopees par entreprise active.
  chargerEmployes: (entrepriseId: string) => listerEmployesAction(entrepriseId),
  /** Cree (id vide) ou met a jour un employe ; renvoie le snapshot persiste. */
  enregistrerEmploye: (entrepriseId: string, e: EmployeLocal) => upsertEmployeAction(entrepriseId, e),
  supprimerEmploye: (id: string) => supprimerEmployeAction(id),
  // Projets : Supabase (RLS), methodes ASYNC scopees par entreprise active.
  chargerProjets: (entrepriseId: string) => listerProjetsAction(entrepriseId),
  /** Cree (id vide) ou met a jour un projet ; renvoie le projet persiste. */
  enregistrerProjet: (entrepriseId: string, p: ProjetLocal) => upsertProjetAction(entrepriseId, p),
  supprimerProjet: (id: string) => supprimerProjetAction(id),
  // Taches : Supabase (RLS), methodes ASYNC scopees par entreprise active.
  chargerTaches: (entrepriseId: string) => listerTachesAction(entrepriseId),
  /** Cree (id vide) ou met a jour une tache ; renvoie la tache persistee. */
  enregistrerTache: (entrepriseId: string, t: TacheLocal) => upsertTacheAction(entrepriseId, t),
  supprimerTache: (id: string) => supprimerTacheAction(id),
};
