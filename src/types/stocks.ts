/**
 * Types du module Stocks (matieres premieres, produits finis, marchandises).
 *
 * Ces types decrivent l'ENTREE collectee par l'UI (des articles et leurs
 * mouvements de stock) et la SORTIE produite par le moteur
 * (`src/engine/stocks.ts`). Regle non negociable (CLAUDE.md) : aucune
 * valorisation (CUMP, valeur du stock) n'est calculee dans le navigateur ; tout
 * vient du moteur deterministe et teste, cote serveur.
 *
 * Argent : FCFA (XOF) entiers. Les quantites ne sont PAS monetaires : ce sont
 * des unites physiques (kg, litres, pieces...) et peuvent etre decimales.
 */

import type { FCFA } from "./money.js";

/** Nature de l'article (segmente le stock : matieres vs produits). */
export type TypeArticle = "matiere_premiere" | "produit_fini" | "marchandise";

/**
 * Type de mouvement de stock :
 *  - "entree"     : reception (achat / production) — porte un cout unitaire.
 *  - "sortie"     : consommation / vente — valorisee au CUMP courant.
 *  - "inventaire" : ajustement a la quantite physique constatee (revalorisee
 *                   au CUMP courant), sans changer le cout moyen.
 */
export type TypeMouvement = "entree" | "sortie" | "inventaire";

/** Un mouvement de stock (SAISIE), dans l'ordre chronologique. */
export interface MouvementStock {
  type: TypeMouvement;
  /** Quantite du mouvement (>= 0). Pour "inventaire" : quantite constatee. */
  quantite: number;
  /** Cout unitaire HT en FCFA (requis pour "entree" ; ignore sinon). */
  coutUnitaire?: FCFA;
}

/** Un article et son historique de mouvements (SAISIE). */
export interface ArticleStockInput {
  /** Reference interne (SKU). */
  ref: string;
  designation: string;
  type: TypeArticle;
  /** Unite de mesure ("kg", "unite", "L", "sac"...). */
  unite: string;
  /** Seuil de reapprovisionnement (alerte si quantite <= seuil). Defaut 0. */
  seuilAlerte?: number;
  /** Mouvements dans l'ordre chronologique (le moteur les rejoue). */
  mouvements: MouvementStock[];
}

/** Un article apres valorisation (SNAPSHOT moteur). */
export interface ArticleStockCalc {
  ref: string;
  designation: string;
  type: TypeArticle;
  unite: string;
  /** Quantite en stock (peut etre decimale). */
  quantite: number;
  /** Cout unitaire moyen pondere (FCFA, arrondi) ; 0 si stock nul. */
  cump: FCFA;
  /** Valeur du stock = quantite x CUMP (FCFA, arrondi). */
  valeurStock: FCFA;
  seuilAlerte: number;
  /** Quantite <= seuil (et > 0) : a reapprovisionner. */
  sousSeuil: boolean;
  /** Quantite <= 0 : rupture. */
  enRupture: boolean;
}

/** Resultat de la valorisation du stock (SNAPSHOT). */
export interface ResultatStock {
  articles: ArticleStockCalc[];
  /** Valeur totale du stock = Σ valeurStock (FCFA). */
  valeurTotale: FCFA;
  nbArticles: number;
  /** Nombre d'articles sous le seuil de reappro (hors rupture). */
  nbSousSeuil: number;
  /** Nombre d'articles en rupture. */
  nbRuptures: number;
}
