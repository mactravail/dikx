/**
 * Etat de travail LOCAL du pole Organisation (RH / paie + projets / taches).
 *
 * Persiste dans le `localStorage` du navigateur en attendant le branchement
 * Supabase (tables prevues : db/migrations/0004_organisation.sql).
 *
 * Regle raktak respectee : ce fichier ne contient AUCUN calcul monetaire. Les
 * seuls montants stockes ici sont soit des SAISIES (brut, primes, retenues),
 * soit des SNAPSHOTS renvoyes par le moteur (server action) — jamais un total
 * calcule par l'UI. Les libelles/constantes ci-dessous sont des donnees de
 * REFERENCE (pas des taux) : ils servent la saisie, pas le calcul.
 */

import { scopedKey } from "./entreprise-active";
import type { StatutTache } from "./engine";

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

// Suffixes SCOPES par entreprise active (voir lib/entreprise-active.ts).
const SUFFIXES = {
  employes: "rh.employes",
  projets: "projets.projets",
  taches: "projets.taches",
} as const;

function load<T>(key: string, seed: T[]): T[] {
  if (typeof window === "undefined") return seed;
  try {
    const brut = window.localStorage.getItem(key);
    if (!brut) return seed;
    const val = JSON.parse(brut);
    return Array.isArray(val) ? (val as T[]) : seed;
  } catch {
    return seed;
  }
}

function save<T>(key: string, value: T[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / mode prive : on ignore, l'etat reste en memoire */
  }
}

export const store = {
  chargerEmployes: () => load<EmployeLocal>(scopedKey(SUFFIXES.employes), SEED_EMPLOYES),
  sauverEmployes: (v: EmployeLocal[]) => save(scopedKey(SUFFIXES.employes), v),
  chargerProjets: () => load<ProjetLocal>(scopedKey(SUFFIXES.projets), SEED_PROJETS),
  sauverProjets: (v: ProjetLocal[]) => save(scopedKey(SUFFIXES.projets), v),
  chargerTaches: () => load<TacheLocal>(scopedKey(SUFFIXES.taches), SEED_TACHES),
  sauverTaches: (v: TacheLocal[]) => save(scopedKey(SUFFIXES.taches), v),
};

/* --------------------------- donnees de demo ---------------------------- */
// Contexte PME senegalaise. Les net/cout des employes sont indicatifs ; ils
// seront remplaces par le snapshot du moteur des la 1re modification.

const SEED_EMPLOYES: EmployeLocal[] = [
  { id: "emp-demo-1", nom: "Awa Ndiaye", poste: "Responsable administrative", typeContrat: "CDI", dateEmbauche: "2022-03-01", telephone: "+221 77 234 56 78", actif: true, salaireBrutMensuel: 450_000, primes: 30_000, autresRetenues: 0, netAPayer: 453_120, coutEmployeur: 580_800 },
  { id: "emp-demo-2", nom: "Cheikh Fall", poste: "Chef de production", typeContrat: "CDI", dateEmbauche: "2021-09-15", telephone: "+221 76 345 67 89", actif: true, salaireBrutMensuel: 400_000, primes: 0, autresRetenues: 0, netAPayer: 377_600, coutEmployeur: 484_000 },
  { id: "emp-demo-3", nom: "Fatou Sarr", poste: "Comptable", typeContrat: "CDI", dateEmbauche: "2023-01-10", telephone: "+221 78 456 78 90", actif: true, salaireBrutMensuel: 350_000, primes: 0, autresRetenues: 0, netAPayer: 330_400, coutEmployeur: 423_500 },
  { id: "emp-demo-4", nom: "Ibrahima Ba", poste: "Livreur", typeContrat: "CDD", dateEmbauche: "2024-05-02", telephone: "+221 70 567 89 01", actif: true, salaireBrutMensuel: 180_000, primes: 15_000, autresRetenues: 0, netAPayer: 184_080, coutEmployeur: 235_950 },
  { id: "emp-demo-5", nom: "Mariama Diallo", poste: "Assistante commerciale", typeContrat: "stage", dateEmbauche: "2025-02-01", actif: true, salaireBrutMensuel: 120_000, primes: 0, autresRetenues: 0, netAPayer: 113_280, coutEmployeur: 145_200 },
];

const SEED_PROJETS: ProjetLocal[] = [
  { id: "prj-demo-1", nom: "Ouverture point de vente Thies", client: "Interne", statut: "actif", echeance: "2026-09-30" },
  { id: "prj-demo-2", nom: "Contrat farine — Boulangerie La Teranga", client: "Boulangerie La Teranga", statut: "actif", echeance: "2026-08-15" },
  { id: "prj-demo-3", nom: "Refonte site vitrine", client: "Interne", statut: "en_pause" },
];

const SEED_TACHES: TacheLocal[] = [
  // Projet 1 — ouverture Thies
  { id: "tsk-demo-1", projetId: "prj-demo-1", titre: "Trouver un local", statut: "termine", assignee: "Awa Ndiaye", heuresEstimees: 16, heuresRealisees: 20 },
  { id: "tsk-demo-2", projetId: "prj-demo-1", titre: "Negocier le bail", statut: "en_cours", assignee: "Awa Ndiaye", echeance: "2026-07-20", heuresEstimees: 8, heuresRealisees: 5 },
  { id: "tsk-demo-3", projetId: "prj-demo-1", titre: "Recruter 2 vendeurs", statut: "a_faire", assignee: "Fatou Sarr", echeance: "2026-08-31", heuresEstimees: 12, heuresRealisees: 0 },
  { id: "tsk-demo-4", projetId: "prj-demo-1", titre: "Amenagement et signaletique", statut: "a_faire", heuresEstimees: 24, heuresRealisees: 0 },
  // Projet 2 — contrat farine
  { id: "tsk-demo-5", projetId: "prj-demo-2", titre: "Signer le contrat cadre", statut: "termine", assignee: "Cheikh Fall", heuresEstimees: 4, heuresRealisees: 3 },
  { id: "tsk-demo-6", projetId: "prj-demo-2", titre: "Planifier les livraisons hebdo", statut: "en_cours", assignee: "Ibrahima Ba", echeance: "2026-07-15", heuresEstimees: 6, heuresRealisees: 4 },
  // Projet 3 — site vitrine
  { id: "tsk-demo-7", projetId: "prj-demo-3", titre: "Rediger les contenus", statut: "a_faire", assignee: "Mariama Diallo", heuresEstimees: 10, heuresRealisees: 0 },
];
