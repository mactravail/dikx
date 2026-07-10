/**
 * Contrat de donnees du pole Achats & Stock (fournisseurs, stocks, achats,
 * production / MRP).
 *
 * Persiste dans SUPABASE (tables 0005 + entreprise_id 0011/0014), sous RLS
 * scopee par entreprise, via les server actions stocks/fournisseurs/achats/
 * production. Le `store` ci-dessous ne fait que deleguer a ces actions (ASYNC).
 *
 * Regle raktak respectee : ce fichier ne contient AUCUN calcul monetaire. Les
 * montants stockes ici sont soit des SAISIES (prix, cout unitaire, encours), soit
 * des SNAPSHOTS renvoyes par le moteur (server action) — jamais un total calcule
 * par l'UI. Les libelles/constantes sont des donnees de REFERENCE (pas des taux).
 */

import type {
  TypeArticle,
  TypeMouvement,
  StatutCommande,
} from "./engine";
import {
  listerArticlesAction,
  upsertArticleAction,
  supprimerArticleAction,
  ajouterMouvementAction,
  supprimerMouvementAction,
} from "@/app/(app)/stocks/data-actions";
import {
  listerFournisseursAction,
  upsertFournisseurAction,
  supprimerFournisseurAction,
} from "@/app/(app)/fournisseurs/data-actions";
import {
  listerCommandesAction,
  upsertCommandeAction,
  supprimerCommandeAction,
} from "@/app/(app)/achats/data-actions";
import {
  listerNomenclaturesAction,
  upsertNomenclatureAction,
  supprimerNomenclatureAction,
  listerOrdresAction,
  upsertOrdreAction,
  supprimerOrdreAction,
} from "@/app/(app)/production/data-actions";

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
// Articles, fournisseurs, commandes et production (nomenclatures + ordres) sont
// tous persistes dans Supabase (RLS, scope par entreprise) via les data-actions.
// Toutes les methodes sont ASYNC et prennent l'id de l'entreprise active.

export const store = {
  // Articles (stocks) : Supabase (RLS), methodes ASYNC scopees par entreprise.
  chargerArticles: (entrepriseId: string) => listerArticlesAction(entrepriseId),
  enregistrerArticle: (entrepriseId: string, a: ArticleLocal) => upsertArticleAction(entrepriseId, a),
  supprimerArticle: (id: string) => supprimerArticleAction(id),
  /** Ajoute un mouvement ; renvoie l'article recalcule (snapshot moteur). */
  ajouterMouvement: (entrepriseId: string, articleId: string, m: MouvementLocal) =>
    ajouterMouvementAction(entrepriseId, articleId, m),
  /** Supprime un mouvement ; renvoie l'article recalcule. */
  supprimerMouvement: (articleId: string, mouvementId: string) =>
    supprimerMouvementAction(articleId, mouvementId),
  // Fournisseurs : Supabase (RLS), methodes ASYNC scopees par entreprise.
  chargerFournisseurs: (entrepriseId: string) => listerFournisseursAction(entrepriseId),
  enregistrerFournisseur: (entrepriseId: string, f: FournisseurLocal) => upsertFournisseurAction(entrepriseId, f),
  supprimerFournisseur: (id: string) => supprimerFournisseurAction(id),
  // Commandes d'achat : Supabase (RLS), methodes ASYNC scopees par entreprise.
  chargerCommandes: (entrepriseId: string) => listerCommandesAction(entrepriseId),
  /** Cree (id vide) ou met a jour une commande ; renvoie le snapshot persiste. */
  enregistrerCommande: (entrepriseId: string, c: CommandeLocal) => upsertCommandeAction(entrepriseId, c),
  supprimerCommande: (id: string) => supprimerCommandeAction(id),
  // Nomenclatures (BOM) : Supabase (RLS), methodes ASYNC scopees par entreprise.
  chargerNomenclatures: (entrepriseId: string) => listerNomenclaturesAction(entrepriseId),
  enregistrerNomenclature: (entrepriseId: string, n: NomenclatureLocal) => upsertNomenclatureAction(entrepriseId, n),
  supprimerNomenclature: (id: string) => supprimerNomenclatureAction(id),
  // Ordres de fabrication : Supabase (RLS), methodes ASYNC scopees par entreprise.
  chargerOrdres: (entrepriseId: string) => listerOrdresAction(entrepriseId),
  enregistrerOrdre: (entrepriseId: string, o: OrdreLocal) => upsertOrdreAction(entrepriseId, o),
  supprimerOrdre: (id: string) => supprimerOrdreAction(id),
};
