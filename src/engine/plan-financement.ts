/**
 * T8 — Plan de financement emplois/ressources sur 5 ans.
 *
 * Emplois   : investissements (annee 1), variation du BFR, remboursements de
 *             capital de l'emprunt.
 * Ressources: CAF, apports (annee 1), subventions (annee 1), emprunt (annee 1).
 * Solde annuel = ressources - emplois ; solde cumule = tresorerie nette de fin
 * de periode (un cumul negatif signale un besoin de financement non couvert).
 *
 * v1 : pas de renouvellement d'investissement ni de distribution de dividendes.
 * Toutes les entrees sont deja arrondies ; les sommes restent entieres.
 */

import type { FCFA, Serie5FCFA } from "../types/money.js";
import type { T8 } from "../types/dossier-output.js";

const HORIZON = 5;

export interface EntreePlanFinancement {
  investissementsAnnee1: FCFA;
  variationBFR: Serie5FCFA;
  remboursementsCapital: Serie5FCFA;
  caf: Serie5FCFA;
  apportsAnnee1: FCFA;
  subventionAnnee1: FCFA;
  empruntAnnee1: FCFA;
}

export function calculerPlanFinancement(e: EntreePlanFinancement): T8 {
  const investissements = annee1Seulement(e.investissementsAnnee1);
  const apports = annee1Seulement(e.apportsAnnee1);
  const subventions = annee1Seulement(e.subventionAnnee1);
  const emprunts = annee1Seulement(e.empruntAnnee1);

  const totalEmplois: Serie5FCFA = [0, 0, 0, 0, 0];
  const totalRessources: Serie5FCFA = [0, 0, 0, 0, 0];
  const soldeAnnuel: Serie5FCFA = [0, 0, 0, 0, 0];
  const soldeCumule: Serie5FCFA = [0, 0, 0, 0, 0];

  let cumul = 0;
  for (let i = 0; i < HORIZON; i++) {
    totalEmplois[i] =
      (investissements[i] ?? 0) + (e.variationBFR[i] ?? 0) + (e.remboursementsCapital[i] ?? 0);
    totalRessources[i] =
      (e.caf[i] ?? 0) + (apports[i] ?? 0) + (subventions[i] ?? 0) + (emprunts[i] ?? 0);
    soldeAnnuel[i] = totalRessources[i]! - totalEmplois[i]!;
    cumul += soldeAnnuel[i]!;
    soldeCumule[i] = cumul;
  }

  return {
    investissements,
    variationBFR: [...e.variationBFR] as Serie5FCFA,
    remboursementsCapital: [...e.remboursementsCapital] as Serie5FCFA,
    totalEmplois,
    capaciteAutofinancement: [...e.caf] as Serie5FCFA,
    apports,
    subventions,
    emprunts,
    totalRessources,
    soldeAnnuel,
    soldeCumule,
  };
}

function annee1Seulement(valeur: FCFA): Serie5FCFA {
  return [valeur, 0, 0, 0, 0];
}
