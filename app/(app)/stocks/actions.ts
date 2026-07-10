"use server";

/**
 * Server action du module Stocks : valorise le stock au CUMP via le MOTEUR (pur,
 * teste) cote serveur. Rejouer les mouvements pour obtenir la quantite, le CUMP
 * et la valeur du stock EST un calcul : il n'est jamais fait dans le navigateur.
 */

import { calculerStock } from "../../../lib/engine";
import type { ArticleStockInput, ResultatStock } from "../../../lib/engine";

export type ResultatStockAction =
  | { ok: true; resultat: ResultatStock }
  | { ok: false; error: string };

export async function calculerStockAction(
  articles: ArticleStockInput[],
): Promise<ResultatStockAction> {
  try {
    return { ok: true, resultat: calculerStock(articles) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
