"use server";

/**
 * Server action du module RAPPORT FINANCIER. Elle rassemble les saisies de
 * l'entreprise active (ecritures comptables + comptes/mouvements de tresorerie)
 * et les references saisies (N-1, budget), appelle les MOTEURS testes cote
 * serveur, puis renvoie le SNAPSHOT complet :
 *   ecritures -> comptabilite -> balance -> etats financiers ;
 *   comptes/mouvements -> tresorerie -> disponible ;
 *   etats + balance + disponible + comparatifs -> rapport financier.
 *
 * Aucun chiffre n'est calcule dans le navigateur : classer, sommer et ratio-iser
 * des soldes est un calcul (regle CLAUDE.md).
 */

import {
  calculerComptabilite,
  calculerEtatsFinanciers,
  calculerTresorerie,
  calculerRapportFinancier,
} from "../../../lib/engine";
import type {
  EcritureInput,
  CompteTresorerieInput,
  MouvementTresorerieInput,
  ComparatifRapport,
  EtatsFinanciers,
  ResultatComptabilite,
  ResultatTresorerie,
  RapportFinancier,
} from "../../../lib/engine";

export interface EntreeRapport {
  ecritures: EcritureInput[];
  comptes: CompteTresorerieInput[];
  mouvements: MouvementTresorerieInput[];
  exercicePrecedent?: ComparatifRapport;
  budget?: ComparatifRapport;
}

export type ResultatRapportAction =
  | {
      ok: true;
      compta: ResultatComptabilite;
      etats: EtatsFinanciers;
      treso: ResultatTresorerie;
      rapport: RapportFinancier;
    }
  | { ok: false; error: string };

export async function calculerRapportAction(
  entree: EntreeRapport,
): Promise<ResultatRapportAction> {
  try {
    const compta = calculerComptabilite(entree.ecritures);
    const etats = calculerEtatsFinanciers(compta.balance);
    const treso = calculerTresorerie(entree.comptes, entree.mouvements);
    const rapport = calculerRapportFinancier({
      compteResultat: etats.compteResultat,
      bilan: etats.bilan,
      balance: compta.balance,
      tresorerieDisponible: treso.totalDisponible,
      exercicePrecedent: entree.exercicePrecedent,
      budget: entree.budget,
    });
    return { ok: true, compta, etats, treso, rapport };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
