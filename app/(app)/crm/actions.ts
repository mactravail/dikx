"use server";

/**
 * Server action du module Ventes & CRM : agrege le pipeline via le MOTEUR
 * (pur, teste) cote serveur. Sommer des montants est un calcul : il n'est donc
 * pas fait dans le navigateur.
 */

import { calculerPipeline } from "../../../lib/engine";
import type { OpportuniteInput, ResultatPipeline } from "../../../lib/engine";

export type ResultatPipelineAction =
  | { ok: true; pipeline: ResultatPipeline }
  | { ok: false; error: string };

export async function calculerPipelineAction(
  opportunites: OpportuniteInput[],
  etapesOrdre: string[],
): Promise<ResultatPipelineAction> {
  try {
    const pipeline = calculerPipeline(opportunites, etapesOrdre);
    return { ok: true, pipeline };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
