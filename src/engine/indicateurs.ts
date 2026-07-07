/**
 * IND — Indicateurs cles du dossier.
 *
 *  - Taux de marge sur couts variables = (CA - charges variables) / CA.
 *  - Seuil de rentabilite (point mort en CA) = charges fixes / taux de marge.
 *  - Point mort en mois = seuil / CA x 12.
 *  - CAF (capacite d'autofinancement) = resultat net + dotations amortissements.
 *  - Service de la dette = annuite (capital + interets) — fourni par l'appelant.
 *  - DSCR = CAF / service de la dette (null si pas de dette). >= 1,2 rassure la banque.
 *
 * `chargesFixes` et `serviceDette` sont assembles par l'orchestrateur a partir
 * des autres tableaux, pour garder ce module pur et testable isolement.
 */

import type { Serie5, Serie5FCFA } from "../types/money.js";
import type { Indicateurs } from "../types/dossier-output.js";
import { arrondiFCFA } from "./arrondi.js";

const HORIZON = 5;

export interface EntreeIndicateurs {
  caParAn: Serie5FCFA;
  chargesVariables: Serie5FCFA;
  chargesFixes: Serie5FCFA;
  resultatNet: Serie5FCFA;
  dotations: Serie5FCFA;
  serviceDette: Serie5FCFA;
}

export function calculerIndicateurs(e: EntreeIndicateurs): Indicateurs {
  const tauxMargeSurCoutsVariables: Serie5 = [0, 0, 0, 0, 0];
  const seuilRentabilite: Serie5FCFA = [0, 0, 0, 0, 0];
  const pointMortMois: Serie5 = [0, 0, 0, 0, 0];
  const caf: Serie5FCFA = [0, 0, 0, 0, 0];
  const dscr: Array<number | null> = [];

  for (let i = 0; i < HORIZON; i++) {
    const ca = e.caParAn[i] ?? 0;
    const variables = e.chargesVariables[i] ?? 0;
    const fixes = e.chargesFixes[i] ?? 0;

    const tauxMarge = ca > 0 ? (ca - variables) / ca : 0;
    tauxMargeSurCoutsVariables[i] = tauxMarge;

    const seuil = tauxMarge > 0 ? fixes / tauxMarge : 0;
    seuilRentabilite[i] = arrondiFCFA(seuil);
    pointMortMois[i] = ca > 0 ? (seuil / ca) * 12 : 0;

    caf[i] = (e.resultatNet[i] ?? 0) + (e.dotations[i] ?? 0);

    const service = e.serviceDette[i] ?? 0;
    dscr[i] = service > 0 ? (caf[i] ?? 0) / service : null;
  }

  return {
    chargesFixes: [...e.chargesFixes] as Serie5FCFA,
    tauxMargeSurCoutsVariables,
    seuilRentabilite,
    pointMortMois,
    caf,
    serviceDette: [...e.serviceDette] as Serie5FCFA,
    dscr,
  };
}
