"use server";

/**
 * Server action du module Comptabilite : recoit les ecritures saisies par l'UI,
 * appelle le MOTEUR (pur, teste) cote serveur et renvoie le snapshot calcule
 * (controle des ecritures, balance, totaux, equilibre) AINSI QUE les etats
 * financiers derives (compte de resultat / « compte economique » + bilan
 * actif/passif). Classer et sommer des mouvements est un calcul : il n'est
 * jamais fait dans le navigateur.
 */

import { calculerComptabilite, calculerEtatsFinanciers } from "../../../lib/engine";
import type {
  EcritureInput,
  ResultatComptabilite,
  EtatsFinanciers,
} from "../../../lib/engine";

export type ResultatComptabiliteAction =
  | { ok: true; resultat: ResultatComptabilite; etats: EtatsFinanciers }
  | { ok: false; error: string };

export async function calculerComptabiliteAction(
  ecritures: EcritureInput[],
): Promise<ResultatComptabiliteAction> {
  try {
    const resultat = calculerComptabilite(ecritures);
    const etats = calculerEtatsFinanciers(resultat.balance);
    return { ok: true, resultat, etats };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
