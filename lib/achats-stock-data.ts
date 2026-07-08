/**
 * Etat de travail LOCAL du pole Achats & Stock (fournisseurs, stocks, achats,
 * production / MRP).
 *
 * Persiste dans le `localStorage` du navigateur en attendant le branchement
 * Supabase (tables prevues : db/migrations/0005_achats_stock.sql).
 *
 * Regle raktak respectee : ce fichier ne contient AUCUN calcul monetaire. Les
 * montants stockes ici sont soit des SAISIES (prix, cout unitaire, encours), soit
 * des SNAPSHOTS renvoyes par le moteur (server action) — jamais un total calcule
 * par l'UI. Les libelles/constantes sont des donnees de REFERENCE (pas des taux).
 */

import { scopedKey } from "./entreprise-active";
import type {
  TypeArticle,
  TypeMouvement,
  StatutCommande,
} from "./engine";

/* ------------------------------ Fournisseurs ----------------------------- */

export interface FournisseurLocal {
  id: string;
  nom: string;
  contact?: string;
  telephone?: string;
  email?: string;
  ville?: string;
  delaiPaiementJours: number;
  /** Solde du (SAISIE), en FCFA. */
  encours: number;
  /** Echeance du solde (AAAA-MM-JJ). */
  echeance?: string;
  actif: boolean;
}

/* -------------------------------- Stocks --------------------------------- */

export interface MouvementLocal {
  id: string;
  type: TypeMouvement;
  quantite: number;
  /** Cout unitaire HT (SAISIE), requis pour une entree. */
  coutUnitaire?: number;
  date?: string; // AAAA-MM-JJ
  note?: string;
}

export interface ArticleLocal {
  id: string;
  ref: string;
  designation: string;
  type: TypeArticle;
  unite: string;
  seuilAlerte: number;
  mouvements: MouvementLocal[];
  // Snapshots du moteur (source: server action) — jamais recalcules dans l'UI.
  quantite: number;
  cump: number;
  valeurStock: number;
}

/* -------------------------------- Achats --------------------------------- */

export interface LigneCommandeLocal {
  id: string;
  designation: string;
  /** Reference de l'article receptionne (optionnelle). */
  articleRef?: string;
  quantite: number;
  quantiteRecue: number;
  prixUnitaireHT: number;
}

export interface CommandeLocal {
  id: string;
  numero: string;
  fournisseur: string;
  date: string; // AAAA-MM-JJ
  statut: StatutCommande;
  assujettiTVA: boolean;
  montantPaye: number;
  lignes: LigneCommandeLocal[];
  // Snapshots du moteur.
  totalTTC: number;
  resteAPayer: number;
}

/* ------------------------------ Production ------------------------------- */

export interface ComposantLocal {
  ref: string;
  designation?: string;
  quantite: number;
  coutUnitaire: number;
}

export interface NomenclatureLocal {
  id: string;
  produit: string; // ref du produit fini
  designation: string;
  composants: ComposantLocal[];
}

export type StatutOrdre = "planifie" | "en_cours" | "termine";

export interface OrdreLocal {
  id: string;
  produit: string; // ref du produit fabrique
  quantite: number;
  statut: StatutOrdre;
  echeance?: string; // AAAA-MM-JJ
}

/* ------------------------- libelles de reference ------------------------- */

export const TYPES_ARTICLE: ReadonlyArray<[TypeArticle, string]> = [
  ["matiere_premiere", "Matiere premiere"],
  ["produit_fini", "Produit fini"],
  ["marchandise", "Marchandise"],
];

export const TYPES_MOUVEMENT: ReadonlyArray<[TypeMouvement, string]> = [
  ["entree", "Entree (reception)"],
  ["sortie", "Sortie (consommation / vente)"],
  ["inventaire", "Inventaire (ajustement)"],
];

export const STATUTS_COMMANDE: ReadonlyArray<[StatutCommande, string]> = [
  ["brouillon", "Brouillon"],
  ["envoyee", "Envoyee"],
  ["recue_partiel", "Recue (partiel)"],
  ["recue", "Recue"],
  ["annulee", "Annulee"],
];

export const STATUTS_ORDRE: ReadonlyArray<[StatutOrdre, string]> = [
  ["planifie", "Planifie"],
  ["en_cours", "En cours"],
  ["termine", "Termine"],
];

export function libelleTypeArticle(t: TypeArticle): string {
  return TYPES_ARTICLE.find(([v]) => v === t)?.[1] ?? t;
}
export function libelleMouvement(t: TypeMouvement): string {
  return TYPES_MOUVEMENT.find(([v]) => v === t)?.[1] ?? t;
}
export function libelleStatutCommande(s: StatutCommande): string {
  return STATUTS_COMMANDE.find(([v]) => v === s)?.[1] ?? s;
}
export function libelleStatutOrdre(s: StatutOrdre): string {
  return STATUTS_ORDRE.find(([v]) => v === s)?.[1] ?? s;
}

/* ----------------------------- identifiants ------------------------------ */

export function genId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/* ------------------------------- stockage -------------------------------- */

// Suffixes SCOPES par entreprise active (voir lib/entreprise-active.ts).
const SUFFIXES = {
  fournisseurs: "achats.fournisseurs",
  articles: "stocks.articles",
  commandes: "achats.commandes",
  nomenclatures: "production.nomenclatures",
  ordres: "production.ordres",
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
  chargerFournisseurs: () => load<FournisseurLocal>(scopedKey(SUFFIXES.fournisseurs), SEED_FOURNISSEURS),
  sauverFournisseurs: (v: FournisseurLocal[]) => save(scopedKey(SUFFIXES.fournisseurs), v),
  chargerArticles: () => load<ArticleLocal>(scopedKey(SUFFIXES.articles), SEED_ARTICLES),
  sauverArticles: (v: ArticleLocal[]) => save(scopedKey(SUFFIXES.articles), v),
  chargerCommandes: () => load<CommandeLocal>(scopedKey(SUFFIXES.commandes), SEED_COMMANDES),
  sauverCommandes: (v: CommandeLocal[]) => save(scopedKey(SUFFIXES.commandes), v),
  chargerNomenclatures: () => load<NomenclatureLocal>(scopedKey(SUFFIXES.nomenclatures), SEED_NOMENCLATURES),
  sauverNomenclatures: (v: NomenclatureLocal[]) => save(scopedKey(SUFFIXES.nomenclatures), v),
  chargerOrdres: () => load<OrdreLocal>(scopedKey(SUFFIXES.ordres), SEED_ORDRES),
  sauverOrdres: (v: OrdreLocal[]) => save(scopedKey(SUFFIXES.ordres), v),
};

/* --------------------------- donnees de demo ----------------------------- */
// Contexte : petite boulangerie / patisserie senegalaise (coherent avec les
// seeds du pole Organisation). Les snapshots (quantite, CUMP, valeur, totaux)
// sont indicatifs : ils sont remplaces par le moteur des le 1er rendu / la 1re
// modification.

const SEED_FOURNISSEURS: FournisseurLocal[] = [
  { id: "four-1", nom: "Grands Moulins de Dakar", contact: "M. Sow", telephone: "+221 33 839 90 00", email: "commandes@gmd.sn", ville: "Dakar", delaiPaiementJours: 30, encours: 1_250_000, echeance: "2026-06-25", actif: true },
  { id: "four-2", nom: "Sucrerie Proche-Orient (CSS)", contact: "Mme Ba", telephone: "+221 33 951 10 00", email: "ventes@css.sn", ville: "Richard-Toll", delaiPaiementJours: 45, encours: 480_000, echeance: "2026-07-30", actif: true },
  { id: "four-3", nom: "Emballages Senegal SA", contact: "M. Diop", telephone: "+221 33 832 45 67", ville: "Rufisque", delaiPaiementJours: 30, encours: 165_000, echeance: "2026-07-05", actif: true },
  { id: "four-4", nom: "Levures & Ingredients SARL", contact: "M. Kane", telephone: "+221 77 512 34 56", ville: "Dakar", delaiPaiementJours: 15, encours: 0, actif: true },
];

const SEED_ARTICLES: ArticleLocal[] = [
  {
    id: "art-1", ref: "FAR-T55", designation: "Farine de ble T55", type: "matiere_premiere", unite: "kg", seuilAlerte: 200,
    mouvements: [
      { id: "m-1", type: "entree", quantite: 500, coutUnitaire: 380, date: "2026-06-01" },
      { id: "m-2", type: "entree", quantite: 250, coutUnitaire: 400, date: "2026-06-20" },
      { id: "m-3", type: "sortie", quantite: 600, date: "2026-06-30" },
    ],
    quantite: 150, cump: 387, valeurStock: 58_000,
  },
  {
    id: "art-2", ref: "SUC", designation: "Sucre cristallise", type: "matiere_premiere", unite: "kg", seuilAlerte: 50,
    mouvements: [
      { id: "m-4", type: "entree", quantite: 200, coutUnitaire: 650, date: "2026-06-05" },
      { id: "m-5", type: "sortie", quantite: 80, date: "2026-06-28" },
    ],
    quantite: 120, cump: 650, valeurStock: 78_000,
  },
  {
    id: "art-3", ref: "LEV", designation: "Levure boulangere", type: "matiere_premiere", unite: "kg", seuilAlerte: 10,
    mouvements: [
      { id: "m-6", type: "entree", quantite: 30, coutUnitaire: 2_500, date: "2026-06-10" },
      { id: "m-7", type: "sortie", quantite: 24, date: "2026-06-30" },
    ],
    quantite: 6, cump: 2_500, valeurStock: 15_000,
  },
  {
    id: "art-4", ref: "HUI", designation: "Huile vegetale", type: "matiere_premiere", unite: "L", seuilAlerte: 20,
    mouvements: [{ id: "m-8", type: "entree", quantite: 100, coutUnitaire: 1_100, date: "2026-06-08" }],
    quantite: 100, cump: 1_100, valeurStock: 110_000,
  },
  {
    id: "art-5", ref: "PAIN-MIE", designation: "Pain de mie (500 g)", type: "produit_fini", unite: "unite", seuilAlerte: 40,
    mouvements: [
      { id: "m-9", type: "entree", quantite: 300, coutUnitaire: 450, date: "2026-06-30", note: "Production" },
      { id: "m-10", type: "sortie", quantite: 220, date: "2026-07-02" },
    ],
    quantite: 80, cump: 450, valeurStock: 36_000,
  },
];

const SEED_COMMANDES: CommandeLocal[] = [
  {
    id: "cmd-1", numero: "CA-2026-014", fournisseur: "Grands Moulins de Dakar", date: "2026-07-01",
    statut: "recue_partiel", assujettiTVA: true, montantPaye: 0,
    lignes: [
      { id: "cl-1", designation: "Farine de ble T55", articleRef: "FAR-T55", quantite: 500, quantiteRecue: 300, prixUnitaireHT: 400 },
    ],
    totalTTC: 236_000, resteAPayer: 236_000,
  },
  {
    id: "cmd-2", numero: "CA-2026-015", fournisseur: "Levures & Ingredients SARL", date: "2026-07-04",
    statut: "envoyee", assujettiTVA: true, montantPaye: 0,
    lignes: [
      { id: "cl-2", designation: "Levure boulangere", articleRef: "LEV", quantite: 30, quantiteRecue: 0, prixUnitaireHT: 2_500 },
      { id: "cl-3", designation: "Ameliorant de panification", quantite: 10, quantiteRecue: 0, prixUnitaireHT: 3_200 },
    ],
    totalTTC: 126_260, resteAPayer: 126_260,
  },
];

const SEED_NOMENCLATURES: NomenclatureLocal[] = [
  {
    id: "nom-1", produit: "PAIN-MIE", designation: "Pain de mie (500 g)",
    composants: [
      { ref: "FAR-T55", designation: "Farine T55", quantite: 0.35, coutUnitaire: 400 },
      { ref: "SUC", designation: "Sucre", quantite: 0.03, coutUnitaire: 650 },
      { ref: "LEV", designation: "Levure", quantite: 0.008, coutUnitaire: 2_500 },
      { ref: "HUI", designation: "Huile", quantite: 0.02, coutUnitaire: 1_100 },
    ],
  },
  {
    id: "nom-2", produit: "BAGUETTE", designation: "Baguette tradition",
    composants: [
      { ref: "FAR-T55", designation: "Farine T55", quantite: 0.25, coutUnitaire: 400 },
      { ref: "LEV", designation: "Levure", quantite: 0.005, coutUnitaire: 2_500 },
    ],
  },
];

const SEED_ORDRES: OrdreLocal[] = [
  { id: "of-1", produit: "PAIN-MIE", quantite: 500, statut: "en_cours", echeance: "2026-07-12" },
  { id: "of-2", produit: "BAGUETTE", quantite: 1_200, statut: "planifie", echeance: "2026-07-15" },
];
