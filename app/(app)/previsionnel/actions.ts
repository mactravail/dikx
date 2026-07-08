"use server";

/**
 * Server action du module Previsionnel : recoit le DossierInput collecte par le
 * formulaire, appelle le MOTEUR (pur, teste) cote serveur, et renvoie les
 * resultats + le rendu HTML des 9 tableaux. Aucun montant n'est calcule ici :
 * tout vient de `genererDossier`.
 */

import { genererDossier, genererHTML } from "../../../lib/engine";
import type { DossierInput, DossierOutput } from "../../../lib/engine";

export type ResultatGeneration =
  | { ok: true; output: DossierOutput; html: string }
  | { ok: false; error: string };

export async function genererDossierAction(
  input: DossierInput,
): Promise<ResultatGeneration> {
  try {
    const output = genererDossier(input);
    const html = genererHTML(output);
    return { ok: true, output, html };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
