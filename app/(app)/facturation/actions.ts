"use server";

/**
 * Server action du module Facturation : recoit le document saisi par l'UI,
 * appelle le MOTEUR (pur, teste) cote serveur et renvoie le snapshot calcule
 * (HT, TVA, TTC, reste a payer). Aucun montant n'est calcule dans le navigateur.
 */

import { calculerDocument, PARAMETRES } from "../../../lib/engine";
import type { DocumentInput, DocumentCalc } from "../../../lib/engine";

export type ResultatDocument =
  | { ok: true; calc: DocumentCalc }
  | { ok: false; error: string };

export async function calculerDocumentAction(
  input: DocumentInput,
): Promise<ResultatDocument> {
  try {
    const calc = calculerDocument(input, { tauxTVADefaut: PARAMETRES.tva.taux });
    return { ok: true, calc };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
