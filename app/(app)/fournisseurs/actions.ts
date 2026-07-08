"use server";

/**
 * Server action du module Fournisseurs : agrege les encours (dettes) et ventile
 * echu / a echoir via le MOTEUR (pur, teste) cote serveur. Sommer des encours
 * EST un calcul : il n'est jamais fait dans le navigateur.
 *
 * La date de reference (pour departager echu / a echoir) est fixee cote serveur
 * afin que le moteur reste deterministe (il ne lit jamais l'horloge lui-meme).
 */

import { calculerFournisseurs } from "../../../lib/engine";
import type { FournisseurInput, ResultatFournisseurs } from "../../../lib/engine";

export type ResultatFournisseursAction =
  | { ok: true; resultat: ResultatFournisseurs }
  | { ok: false; error: string };

export async function calculerFournisseursAction(
  fournisseurs: FournisseurInput[],
): Promise<ResultatFournisseursAction> {
  try {
    const dateReference = new Date().toISOString().slice(0, 10);
    const resultat = calculerFournisseurs(fournisseurs, dateReference);
    return { ok: true, resultat };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
