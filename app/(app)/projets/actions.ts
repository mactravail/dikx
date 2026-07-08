"use server";

/**
 * Server action du module Projets & Taches : agrege les taches par projet via le
 * MOTEUR (pur, teste) cote serveur. Compter les taches, sommer des heures et
 * calculer un taux d'avancement EST un calcul : il n'est donc pas fait dans le
 * navigateur.
 */

import { calculerProjets } from "../../../lib/engine";
import type { TacheInput, ResultatProjets } from "../../../lib/engine";

export type ResultatProjetsAction =
  | { ok: true; resultat: ResultatProjets }
  | { ok: false; error: string };

export async function calculerProjetsAction(
  taches: TacheInput[],
  projetsOrdre: string[],
): Promise<ResultatProjetsAction> {
  try {
    const resultat = calculerProjets(taches, projetsOrdre);
    return { ok: true, resultat };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
