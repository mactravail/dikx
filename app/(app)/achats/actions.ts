"use server";

/**
 * Server action du module Achats : calcule les totaux des commandes d'achat
 * (HT, TVA deductible, TTC, reste a payer, receptions, encours) via le MOTEUR
 * (pur, teste) cote serveur. Aucun montant n'est calcule dans le navigateur.
 *
 * Le taux de TVA par defaut vient des PARAMETRES (jamais code dans l'UI).
 */

import { calculerAchats, PARAMETRES } from "../../../lib/engine";
import type { CommandeAchatInput, ResultatAchats } from "../../../lib/engine";

export type ResultatAchatsAction =
  | { ok: true; resultat: ResultatAchats }
  | { ok: false; error: string };

export async function calculerAchatsAction(
  commandes: CommandeAchatInput[],
): Promise<ResultatAchatsAction> {
  try {
    const resultat = calculerAchats(commandes, {
      tauxTVADefaut: PARAMETRES.tva.taux,
    });
    return { ok: true, resultat };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
