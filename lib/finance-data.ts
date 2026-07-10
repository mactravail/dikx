/**
 * Contrat de donnees du pole Finance (depenses + ecritures comptables).
 *
 * Persiste dans SUPABASE (tables 0003 + entreprise_id 0011/0014), sous RLS
 * scopee par entreprise, via les server actions charges/comptabilite. Le `store`
 * ci-dessous ne fait que deleguer a ces actions (methodes ASYNC).
 *
 * Regle raktak respectee : ce fichier ne contient AUCUN calcul monetaire. Les
 * seuls montants stockes ici sont soit des SAISIES (HT, debit, credit), soit des
 * SNAPSHOTS renvoyes par le moteur (server action) — jamais un total calcule par
 * l'UI. Le plan comptable et les libelles ci-dessous sont des donnees de
 * REFERENCE (pas des taux fiscaux) : ils servent la saisie, pas le calcul.
 */

import type {
  CategorieDepense,
  CompteComptable,
  Recurrence,
} from "./engine";
import type { EtatTransmission } from "./transmission";
import {
  listerDepensesAction,
  upsertDepenseAction,
  supprimerDepenseAction,
} from "@/app/(app)/charges/data-actions";
import {
  listerEcrituresAction,
  upsertEcritureAction,
  supprimerEcritureAction,
} from "@/app/(app)/comptabilite/data-actions";

/* ---------------------------- Charges & depenses ---------------------------- */

export interface DepenseLocal {
  id: string;
  date: string; // AAAA-MM-JJ
  libelle: string;
  categorie: CategorieDepense;
  montantHT: number;
  tauxTVA: number; // fraction
  recurrence: Recurrence;
  fournisseur?: string;
  // Snapshot du moteur (source: server action) — jamais recalcule dans l'UI.
  montantTTC: number;
  /** Etat de transmission au comptable (0013). Absent = brouillon. */
  transmission?: EtatTransmission;
}

/** Libelles d'affichage des categories de charge. */
export const CATEGORIES_DEPENSE: ReadonlyArray<[CategorieDepense, string]> = [
  ["loyer", "Loyer"],
  ["energie", "Energie (electricite, carburant)"],
  ["eau", "Eau"],
  ["telecom", "Telecom & internet"],
  ["transport", "Transport & deplacements"],
  ["fournitures", "Fournitures & petit materiel"],
  ["entretien", "Entretien & reparations"],
  ["honoraires", "Honoraires & prestations"],
  ["assurance", "Assurances"],
  ["impots_taxes", "Impots & taxes"],
  ["salaires", "Salaires & charges"],
  ["frais_bancaires", "Frais bancaires"],
  ["marketing", "Marketing & publicite"],
  ["autre", "Autre"],
];

export const RECURRENCES: ReadonlyArray<[Recurrence, string]> = [
  ["ponctuelle", "Ponctuelle"],
  ["mensuelle", "Mensuelle"],
  ["trimestrielle", "Trimestrielle"],
  ["annuelle", "Annuelle"],
];

export function libelleCategorie(c: CategorieDepense): string {
  return CATEGORIES_DEPENSE.find(([v]) => v === c)?.[1] ?? c;
}

/* ------------------------------- Comptabilite ------------------------------- */

export interface LigneEcritureLocal {
  compte: string;
  libelle: string;
  debit: number;
  credit: number;
}

export interface EcritureLocal {
  id: string;
  date: string; // AAAA-MM-JJ
  journal: string;
  libelle: string;
  reference?: string;
  lignes: LigneEcritureLocal[];
}

/** Journaux comptables (code -> libelle). */
export const JOURNAUX: ReadonlyArray<[string, string]> = [
  ["VT", "Ventes"],
  ["AC", "Achats"],
  ["BQ", "Banque"],
  ["CA", "Caisse"],
  ["OD", "Operations diverses"],
];

/** Classes du plan comptable SYSCOHADA revise. */
export const CLASSES_COMPTABLES: ReadonlyArray<[number, string]> = [
  [1, "Comptes de ressources durables"],
  [2, "Comptes d'actif immobilise"],
  [3, "Comptes de stocks"],
  [4, "Comptes de tiers"],
  [5, "Comptes de tresorerie"],
  [6, "Comptes de charges"],
  [7, "Comptes de produits"],
  [8, "Comptes des autres charges et produits"],
];

/**
 * Extrait usuel du plan comptable SYSCOHADA revise (donnee de reference, a
 * completer selon les besoins). Sert a alimenter les listes de saisie ; le
 * moteur ne s'en sert pas (les libelles transitent avec chaque ecriture).
 */
export const PLAN_COMPTABLE: readonly CompteComptable[] = [
  // Classe 1 — ressources durables
  { numero: "101", libelle: "Capital social", classe: 1 },
  { numero: "106", libelle: "Reserves", classe: 1 },
  { numero: "12", libelle: "Report a nouveau", classe: 1 },
  { numero: "131", libelle: "Resultat net de l'exercice", classe: 1 },
  { numero: "162", libelle: "Emprunts et dettes aupres des etablissements de credit", classe: 1 },
  // Classe 2 — immobilisations
  { numero: "213", libelle: "Logiciels", classe: 2 },
  { numero: "22", libelle: "Terrains", classe: 2 },
  { numero: "231", libelle: "Batiments", classe: 2 },
  { numero: "241", libelle: "Materiel et outillage", classe: 2 },
  { numero: "2441", libelle: "Materiel de bureau", classe: 2 },
  { numero: "2442", libelle: "Materiel informatique", classe: 2 },
  { numero: "245", libelle: "Materiel de transport", classe: 2 },
  { numero: "281", libelle: "Amortissements des immobilisations", classe: 2 },
  // Classe 3 — stocks
  { numero: "311", libelle: "Marchandises", classe: 3 },
  { numero: "321", libelle: "Matieres premieres", classe: 3 },
  { numero: "36", libelle: "Produits finis", classe: 3 },
  // Classe 4 — tiers
  { numero: "401", libelle: "Fournisseurs", classe: 4 },
  { numero: "409", libelle: "Fournisseurs debiteurs (avances)", classe: 4 },
  { numero: "411", libelle: "Clients", classe: 4 },
  { numero: "419", libelle: "Clients crediteurs (avances recues)", classe: 4 },
  { numero: "421", libelle: "Personnel, remunerations dues", classe: 4 },
  { numero: "431", libelle: "Securite sociale (IPRES, CSS)", classe: 4 },
  { numero: "4431", libelle: "Etat, TVA facturee (collectee)", classe: 4 },
  { numero: "4452", libelle: "Etat, TVA recuperable (deductible)", classe: 4 },
  { numero: "4453", libelle: "Etat, TVA due", classe: 4 },
  { numero: "447", libelle: "Etat, impots retenus a la source", classe: 4 },
  { numero: "448", libelle: "Etat, charges a payer", classe: 4 },
  // Classe 5 — tresorerie
  { numero: "521", libelle: "Banques", classe: 5 },
  { numero: "531", libelle: "Cheques postaux", classe: 5 },
  { numero: "571", libelle: "Caisse", classe: 5 },
  { numero: "585", libelle: "Virements internes (mobile money)", classe: 5 },
  // Classe 6 — charges
  { numero: "601", libelle: "Achats de marchandises", classe: 6 },
  { numero: "602", libelle: "Achats de matieres premieres", classe: 6 },
  { numero: "605", libelle: "Autres achats (eau, electricite, carburant)", classe: 6 },
  { numero: "612", libelle: "Locations (loyer)", classe: 6 },
  { numero: "614", libelle: "Charges de transport", classe: 6 },
  { numero: "616", libelle: "Primes d'assurance", classe: 6 },
  { numero: "618", libelle: "Frais de telecommunication", classe: 6 },
  { numero: "622", libelle: "Honoraires et prestations exterieures", classe: 6 },
  { numero: "627", libelle: "Services bancaires", classe: 6 },
  { numero: "628", libelle: "Frais de publicite et marketing", classe: 6 },
  { numero: "631", libelle: "Frais d'entretien et reparations", classe: 6 },
  { numero: "641", libelle: "Impots et taxes", classe: 6 },
  { numero: "661", libelle: "Remunerations du personnel", classe: 6 },
  { numero: "664", libelle: "Charges sociales", classe: 6 },
  { numero: "681", libelle: "Dotations aux amortissements", classe: 6 },
  // Classe 7 — produits
  { numero: "701", libelle: "Ventes de marchandises", classe: 7 },
  { numero: "702", libelle: "Ventes de produits finis", classe: 7 },
  { numero: "706", libelle: "Prestations de services", classe: 7 },
  { numero: "707", libelle: "Produits accessoires", classe: 7 },
  { numero: "771", libelle: "Produits financiers", classe: 7 },
];

export function libelleCompte(numero: string): string {
  return PLAN_COMPTABLE.find((c) => c.numero === numero)?.libelle ?? numero;
}

/* ----------------------------- identifiants ----------------------------- */

export function genId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/* ------------------------------- stockage ------------------------------- */
// Depenses & ecritures sont persistees dans Supabase (RLS, scope par entreprise)
// via les data-actions. Toutes les methodes sont ASYNC et prennent l'id de
// l'entreprise active (fourni par le contexte cote client).

export const store = {
  // Depenses : Supabase (RLS), methodes ASYNC scopees par entreprise active.
  chargerDepenses: (entrepriseId: string) => listerDepensesAction(entrepriseId),
  /** Cree (id vide) ou met a jour une depense ; renvoie le snapshot persiste. */
  enregistrerDepense: (entrepriseId: string, d: DepenseLocal) => upsertDepenseAction(entrepriseId, d),
  supprimerDepense: (id: string) => supprimerDepenseAction(id),
  // Ecritures comptables : Supabase (RLS), methodes ASYNC scopees par entreprise.
  chargerEcritures: (entrepriseId: string) => listerEcrituresAction(entrepriseId),
  /** Cree (id vide) ou met a jour une ecriture ; renvoie le snapshot persiste. */
  enregistrerEcriture: (entrepriseId: string, e: EcritureLocal) => upsertEcritureAction(entrepriseId, e),
  supprimerEcriture: (id: string) => supprimerEcritureAction(id),
};
