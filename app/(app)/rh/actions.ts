"use server";

/**
 * Server action du module RH (paie) : recoit les elements de paie saisis par
 * l'UI, appelle le MOTEUR (pur, teste) cote serveur et renvoie le snapshot
 * calcule (cotisations, net a payer, cout employeur, masse salariale). Aucun
 * montant n'est calcule dans le navigateur.
 *
 * Les taux de cotisations (salarial / patronal) viennent des PARAMETRES
 * (marques « a valider par un expert paie SN ») — jamais codes dans l'UI.
 */

import { calculerPaie, PARAMETRES } from "../../../lib/engine";
import type { BulletinInput, ResultatPaie } from "../../../lib/engine";

export type ResultatPaieAction =
  | { ok: true; resultat: ResultatPaie }
  | { ok: false; error: string };

export async function calculerPaieAction(
  bulletins: BulletinInput[],
): Promise<ResultatPaieAction> {
  try {
    const resultat = calculerPaie(bulletins, {
      tauxCotisationsSalariales: PARAMETRES.chargesSocialesSalariales.taux,
      tauxCotisationsPatronales: PARAMETRES.chargesSocialesPatronales.taux,
    });
    return { ok: true, resultat };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
