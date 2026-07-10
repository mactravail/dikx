"use server";

/**
 * Server action du module Charges & Depenses : recoit les depenses saisies par
 * l'UI, appelle le MOTEUR (pur, teste) cote serveur et renvoie le snapshot
 * calcule (HT, TVA deductible, TTC, repartition, cout annuel). Aucun montant
 * n'est calcule dans le navigateur.
 */

import { calculerDepenses, PARAMETRES } from "../../../lib/engine";
import type { DepenseInput, ResultatDepenses } from "../../../lib/engine";

export type ResultatDepensesAction =
  | { ok: true; resultat: ResultatDepenses }
  | { ok: false; error: string };

export async function calculerDepensesAction(
  depenses: DepenseInput[],
): Promise<ResultatDepensesAction> {
  try {
    const resultat = calculerDepenses(depenses, {
      tauxTVADefaut: PARAMETRES.tva.taux,
    });
    return { ok: true, resultat };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
