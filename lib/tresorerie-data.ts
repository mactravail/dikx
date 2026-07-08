/**
 * Etat de travail LOCAL du module TRESORERIE (comptes de disponibilites +
 * mouvements). Persiste dans le `localStorage` du navigateur, SCOPE par
 * entreprise active, en attendant le branchement Supabase (table prevue :
 * db/migrations/0006_tresorerie.sql).
 *
 * Regle raktak respectee : ce fichier ne contient AUCUN calcul monetaire. Les
 * seuls montants stockes sont des SAISIES (solde initial, montant d'un
 * mouvement). Les soldes courants et les totaux viennent du moteur (server
 * action). Les listes ci-dessous (types, operateurs, categories) sont des
 * donnees de REFERENCE pour la saisie, pas des taux.
 */

import { scopedKey } from "./entreprise-active";
import type {
  TypeCompteTresorerie,
  SensMouvement,
} from "./engine";

/* --------------------------------- modeles --------------------------------- */

export interface CompteTresorerieLocal {
  id: string;
  nom: string;
  type: TypeCompteTresorerie;
  operateur?: string;
  soldeInitial: number;
}

export interface MouvementLocal {
  id: string;
  compteId: string;
  date: string; // AAAA-MM-JJ
  sens: SensMouvement;
  montant: number;
  categorie: string;
  /** « Pourquoi / a qui / pour quoi » — porte tel quel, non utilise au calcul. */
  motif: string;
}

/* ------------------------------- reference -------------------------------- */

export const TYPES_COMPTE: ReadonlyArray<[TypeCompteTresorerie, string]> = [
  ["banque", "Banque"],
  ["mobile_money", "Mobile money"],
  ["caisse", "Caisse (especes)"],
];

export function libelleTypeCompte(t: TypeCompteTresorerie): string {
  return TYPES_COMPTE.find(([v]) => v === t)?.[1] ?? t;
}

/**
 * Suggestions d'operateurs / etablissements (datalist de saisie). Mobile money
 * et transfert d'argent courants au Senegal + principales banques. Liste
 * indicative : le comptable peut saisir tout autre etablissement.
 */
export const OPERATEURS: readonly string[] = [
  // Mobile money & transfert d'argent
  "Wave",
  "Orange Money",
  "Free Money",
  "Wizall",
  "Wari",
  "Ria",
  "MoneyGram",
  "Western Union",
  // Banques
  "CBAO",
  "SGBS",
  "Ecobank",
  "Bank of Africa (BOA)",
  "UBA",
  "BICIS",
  "Orabank",
  "Banque Atlantique",
];

/** Categories de flux (« pourquoi » un mouvement). Code -> libelle. */
export const CATEGORIES_FLUX: ReadonlyArray<[string, string]> = [
  ["encaissement_client", "Encaissement client"],
  ["vente_comptant", "Vente au comptant"],
  ["apport", "Apport / financement"],
  ["emprunt", "Deblocage d'emprunt"],
  ["remboursement_recu", "Remboursement recu"],
  ["approvisionnement", "Achat / approvisionnement"],
  ["fournisseurs", "Reglement fournisseur"],
  ["salaires", "Salaires & paie"],
  ["loyer", "Loyer & charges"],
  ["impots", "Impots & taxes"],
  ["frais_bancaires", "Frais bancaires / mobile money"],
  ["transport", "Transport & logistique"],
  ["transfert", "Transfert entre comptes"],
  ["retrait", "Retrait especes"],
  ["depot", "Depot / versement"],
  ["remboursement_emprunt", "Remboursement d'emprunt"],
  ["autre", "Autre"],
];

export function libelleCategorieFlux(code: string): string {
  return CATEGORIES_FLUX.find(([v]) => v === code)?.[1] ?? code;
}

/* ----------------------------- identifiants ------------------------------ */

export function genId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/* -------------------------------- stockage -------------------------------- */

const SUFFIXES = {
  comptes: "tresorerie.comptes",
  mouvements: "tresorerie.mouvements",
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
  chargerComptes: () => load<CompteTresorerieLocal>(scopedKey(SUFFIXES.comptes), SEED_COMPTES),
  sauverComptes: (v: CompteTresorerieLocal[]) => save(scopedKey(SUFFIXES.comptes), v),
  chargerMouvements: () => load<MouvementLocal>(scopedKey(SUFFIXES.mouvements), SEED_MOUVEMENTS),
  sauverMouvements: (v: MouvementLocal[]) => save(scopedKey(SUFFIXES.mouvements), v),
};

/* ---------------------------- donnees de demo ----------------------------- */
// Contexte PME senegalaise. Montants indicatifs ; les soldes courants affiches
// sont TOUJOURS recalcules par le moteur, jamais lus depuis ces seeds.

const ANNEE = new Date().getFullYear();
const M = (m: number, j: number) => `${ANNEE}-${String(m).padStart(2, "0")}-${String(j).padStart(2, "0")}`;

const SEED_COMPTES: CompteTresorerieLocal[] = [
  { id: "tr-cbao", nom: "Compte courant CBAO", type: "banque", operateur: "CBAO", soldeInitial: 2_500_000 },
  { id: "tr-wave", nom: "Wave (caisse mobile)", type: "mobile_money", operateur: "Wave", soldeInitial: 350_000 },
  { id: "tr-om", nom: "Orange Money", type: "mobile_money", operateur: "Orange Money", soldeInitial: 180_000 },
  { id: "tr-caisse", nom: "Caisse principale", type: "caisse", soldeInitial: 120_000 },
];

const SEED_MOUVEMENTS: MouvementLocal[] = [
  { id: "mv-1", compteId: "tr-cbao", date: M(1, 6), sens: "entree", montant: 1_200_000, categorie: "encaissement_client", motif: "Virement client Boulangerie La Teranga (FAC-2026-0001)" },
  { id: "mv-2", compteId: "tr-cbao", date: M(1, 10), sens: "sortie", montant: 708_000, categorie: "fournisseurs", motif: "Reglement fournisseur — approvisionnement matieres" },
  { id: "mv-3", compteId: "tr-cbao", date: M(1, 28), sens: "sortie", montant: 450_000, categorie: "salaires", motif: "Virement salaires equipe (janvier)" },
  { id: "mv-4", compteId: "tr-wave", date: M(1, 12), sens: "entree", montant: 240_000, categorie: "vente_comptant", motif: "Ventes boutique payees par Wave" },
  { id: "mv-5", compteId: "tr-wave", date: M(1, 15), sens: "sortie", montant: 60_000, categorie: "transport", motif: "Livraisons — carburant & course" },
  { id: "mv-6", compteId: "tr-om", date: M(1, 18), sens: "sortie", montant: 35_000, categorie: "frais_bancaires", motif: "Frais de retrait Orange Money" },
  { id: "mv-7", compteId: "tr-caisse", date: M(1, 20), sens: "sortie", montant: 25_000, categorie: "loyer", motif: "Appoint gardiennage" },
];
