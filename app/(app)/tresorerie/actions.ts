"use server";

/**
 * Server action du module Tresorerie : recoit les comptes et mouvements saisis
 * par l'UI, appelle le MOTEUR (pur, teste) cote serveur et renvoie le snapshot
 * calcule (soldes courants, totaux, repartitions). Sommer des mouvements est un
 * calcul : il n'est jamais fait dans le navigateur.
 */

import { calculerTresorerie } from "../../../lib/engine";
import type {
  CompteTresorerieInput,
  MouvementTresorerieInput,
  ResultatTresorerie,
} from "../../../lib/engine";

export type ResultatTresorerieAction =
  | { ok: true; resultat: ResultatTresorerie }
  | { ok: false; error: string };

export async function calculerTresorerieAction(
  comptes: CompteTresorerieInput[],
  mouvements: MouvementTresorerieInput[],
): Promise<ResultatTresorerieAction> {
  try {
    const resultat = calculerTresorerie(comptes, mouvements);
    return { ok: true, resultat };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
