/**
 * Moteur STOCKS — valorisation au CUMP (cout unitaire moyen pondere). Pur et
 * deterministe (aucune I/O, aucun aleatoire).
 *
 * A partir de l'historique des mouvements de chaque article, il rejoue le stock
 * et produit : la quantite finale, le CUMP, la valeur du stock, et les alertes
 * (sous seuil / rupture) ; puis la valeur totale du stock. C'est le SEUL endroit
 * ou ces montants sont produits ; ni l'UI ni l'IA ne calculent un chiffre.
 *
 * CUMP : le cout moyen n'evolue qu'aux ENTREES (receptions valorisees). Les
 * SORTIES sont valorisees au CUMP courant (le cout moyen ne change pas).
 * L'INVENTAIRE ajuste la quantite a la valeur constatee, revalorisee au CUMP
 * courant (le cout moyen ne change pas non plus).
 *
 * Arrondi : la valeur du stock et le CUMP sont arrondis a l'entier FCFA au moment
 * de produire la ligne, via `arrondiFCFA()`. La valeur totale est la somme des
 * valeurs arrondies (Σ lignes = total).
 */

import type { FCFA } from "../types/money.js";
import type {
  ArticleStockInput,
  ArticleStockCalc,
  ResultatStock,
} from "../types/stocks.js";
import { arrondiFCFA } from "./arrondi.js";

export function calculerStock(articles: ArticleStockInput[]): ResultatStock {
  const lignes: ArticleStockCalc[] = articles.map(valoriser);

  const nbSousSeuil = lignes.filter((a) => a.sousSeuil).length;
  const nbRuptures = lignes.filter((a) => a.enRupture).length;

  return {
    articles: lignes,
    valeurTotale: somme(lignes.map((a) => a.valeurStock)),
    nbArticles: lignes.length,
    nbSousSeuil,
    nbRuptures,
  };
}

/** Rejoue les mouvements d'un article et renvoie son snapshot valorise. */
function valoriser(article: ArticleStockInput): ArticleStockCalc {
  // Etat courant en valeurs DECIMALES (l'arrondi FCFA se fait a la sortie).
  let quantite = 0;
  let valeur = 0; // valeur totale du stock, decimale

  for (const m of article.mouvements) {
    const q = quantiteValide(m.quantite);
    const cumpCourant = quantite > 0 ? valeur / quantite : 0;

    if (m.type === "entree") {
      valeur += q * montantValide(m.coutUnitaire ?? 0);
      quantite += q;
    } else if (m.type === "sortie") {
      const retrait = Math.min(q, quantite);
      valeur -= retrait * cumpCourant;
      quantite -= q;
      if (quantite <= 0) {
        quantite = Math.max(0, quantite);
        valeur = 0; // pas de valeur sans quantite
      }
    } else {
      // inventaire : la quantite constatee devient la quantite en stock,
      // revalorisee au CUMP courant (le cout moyen ne change pas).
      quantite = q;
      valeur = q * cumpCourant;
    }
  }

  const seuilAlerte = quantiteValide(article.seuilAlerte ?? 0);
  const valeurStock = arrondiFCFA(valeur);
  const cump = quantite > 0 ? arrondiFCFA(valeur / quantite) : 0;

  return {
    ref: article.ref,
    designation: article.designation,
    type: article.type,
    unite: article.unite,
    quantite,
    cump,
    valeurStock,
    seuilAlerte,
    enRupture: quantite <= 0,
    sousSeuil: quantite > 0 && quantite <= seuilAlerte,
  };
}

function somme(xs: FCFA[]): FCFA {
  return xs.reduce((s, x) => s + x, 0);
}

/** Normalise une quantite (les valeurs invalides / negatives -> 0). */
function quantiteValide(x: number | undefined): number {
  return Number.isFinite(x) && (x as number) > 0 ? (x as number) : 0;
}

/** Normalise un montant fini (les valeurs invalides / negatives -> 0). */
function montantValide(x: number): number {
  return Number.isFinite(x) && x > 0 ? x : 0;
}
