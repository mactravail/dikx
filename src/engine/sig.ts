/**
 * T6 — Soldes Intermediaires de Gestion (SIG), en valeur et en % du CA.
 *
 * Les soldes sont repris du compte de resultat (T5) ; on n'y ajoute que le
 * ratio "part du CA" pour chaque solde et chaque annee. Aucun arrondi monetaire
 * (les valeurs viennent deja arrondies de T5) ; les pourcentages sont des
 * fractions non arrondies.
 *
 * En v1 (pas d'elements exceptionnels), resultat courant = resultat avant impot.
 */

import type { Serie5, Serie5FCFA } from "../types/money.js";
import type { SoldeSIG, T5, T6 } from "../types/dossier-output.js";

const HORIZON = 5;

export function calculerSIG(t5: T5): T6 {
  const ca = t5.chiffreAffaires;
  return {
    margeCommerciale: solde(t5.margeBrute, ca),
    valeurAjoutee: solde(t5.valeurAjoutee, ca),
    excedentBrutExploitation: solde(t5.excedentBrutExploitation, ca),
    resultatExploitation: solde(t5.resultatExploitation, ca),
    resultatCourant: solde(t5.resultatAvantImpot, ca),
    resultatNet: solde(t5.resultatNet, ca),
  };
}

function solde(valeur: Serie5FCFA, ca: Serie5FCFA): SoldeSIG {
  const pourcentageCA: Serie5 = [0, 0, 0, 0, 0];
  for (let i = 0; i < HORIZON; i++) {
    const c = ca[i] ?? 0;
    pourcentageCA[i] = c !== 0 ? (valeur[i] ?? 0) / c : 0;
  }
  return { valeur: [...valeur] as Serie5FCFA, pourcentageCA };
}
