/**
 * T5 — Compte de resultat previsionnel 5 ans.
 *
 * Cascade SYSCOHADA simplifiee, par annee :
 *   CA
 *   - achats consommes (variable)            => marge brute
 *   - charges externes                       => valeur ajoutee
 *   - charges de personnel
 *   - impots & taxes                         => EBE
 *   - dotations aux amortissements           => resultat d'exploitation
 *   - charges financieres (interets)         => resultat avant impot
 *   - IS (taux x resultat avant impot si > 0) => resultat net
 *
 * Toutes les entrees sont deja des entiers FCFA. Seul l'IS introduit une
 * multiplication => arrondi via arrondiFCFA. Aucun taux en dur : `tauxIS` vient
 * des parametres.
 */

import type { Serie5FCFA, Taux } from "../types/money.js";
import type { T5 } from "../types/dossier-output.js";
import { arrondiFCFA } from "./arrondi.js";

const HORIZON = 5;

export interface EntreeResultat {
  caParAn: Serie5FCFA;
  achatsConsommes: Serie5FCFA;
  chargesExternes: Serie5FCFA;
  impotsTaxes: Serie5FCFA;
  chargesPersonnel: Serie5FCFA;
  dotations: Serie5FCFA;
  chargesFinancieres: Serie5FCFA;
}

export interface OptionsResultat {
  tauxIS: Taux;
}

export function calculerResultat(e: EntreeResultat, options: OptionsResultat): T5 {
  const margeBrute = vide();
  const valeurAjoutee = vide();
  const excedentBrutExploitation = vide();
  const resultatExploitation = vide();
  const resultatAvantImpot = vide();
  const impotSocietes = vide();
  const resultatNet = vide();

  for (let i = 0; i < HORIZON; i++) {
    const ca = e.caParAn[i] ?? 0;
    const achats = e.achatsConsommes[i] ?? 0;
    const externes = e.chargesExternes[i] ?? 0;
    const personnel = e.chargesPersonnel[i] ?? 0;
    const impots = e.impotsTaxes[i] ?? 0;
    const dot = e.dotations[i] ?? 0;
    const fin = e.chargesFinancieres[i] ?? 0;

    margeBrute[i] = ca - achats;
    valeurAjoutee[i] = margeBrute[i]! - externes;
    excedentBrutExploitation[i] = valeurAjoutee[i]! - personnel - impots;
    resultatExploitation[i] = excedentBrutExploitation[i]! - dot;
    resultatAvantImpot[i] = resultatExploitation[i]! - fin;
    impotSocietes[i] = resultatAvantImpot[i]! > 0 ? arrondiFCFA(resultatAvantImpot[i]! * options.tauxIS) : 0;
    resultatNet[i] = resultatAvantImpot[i]! - impotSocietes[i]!;
  }

  return {
    chiffreAffaires: [...e.caParAn] as Serie5FCFA,
    achatsConsommes: [...e.achatsConsommes] as Serie5FCFA,
    margeBrute,
    chargesExternes: [...e.chargesExternes] as Serie5FCFA,
    valeurAjoutee,
    chargesPersonnel: [...e.chargesPersonnel] as Serie5FCFA,
    impotsTaxes: [...e.impotsTaxes] as Serie5FCFA,
    excedentBrutExploitation,
    dotationsAmortissements: [...e.dotations] as Serie5FCFA,
    resultatExploitation,
    chargesFinancieres: [...e.chargesFinancieres] as Serie5FCFA,
    resultatAvantImpot,
    impotSocietes,
    resultatNet,
  };
}

function vide(): Serie5FCFA {
  return [0, 0, 0, 0, 0];
}
