/**
 * Arrondi monetaire — le SEUL endroit du moteur ou un montant devient entier.
 *
 * Regle (CLAUDE.md) : les calculs intermediaires peuvent etre decimaux ; on
 * arrondit a l'entier FCFA UNIQUEMENT au moment de produire une ligne de sortie.
 * Tout module qui ecrit un montant dans `DossierOutput` passe par ici.
 *
 * Convention : arrondi au plus proche, le demi a l'ecart du zero (symetrique),
 * de sorte que arrondiFCFA(2.5) = 3 et arrondiFCFA(-2.5) = -3.
 */

import type { FCFA, Serie5, Serie5FCFA, Serie12 } from "../types/money.js";

export function arrondiFCFA(montant: number): FCFA {
  if (!Number.isFinite(montant)) {
    throw new Error(`arrondiFCFA: montant non fini (${montant})`);
  }
  // Math.sign(0) = 0 => 0 reste 0. Math.abs evite le biais de Math.round
  // vers +Infini sur les demis negatifs. Le "+ 0" normalise -0 en 0.
  return Math.sign(montant) * Math.round(Math.abs(montant)) + 0;
}

/** Applique arrondiFCFA a une serie de 5 valeurs (annees 1..5). */
export function arrondiSerie5(serie: Serie5 | number[]): Serie5FCFA {
  return [
    arrondiFCFA(serie[0] ?? 0),
    arrondiFCFA(serie[1] ?? 0),
    arrondiFCFA(serie[2] ?? 0),
    arrondiFCFA(serie[3] ?? 0),
    arrondiFCFA(serie[4] ?? 0),
  ];
}

/** Applique arrondiFCFA a une serie de 12 valeurs (mois 1..12). */
export function arrondiSerie12(serie: number[]): Serie12<FCFA> {
  const out = [] as unknown as Serie12<FCFA>;
  for (let i = 0; i < 12; i++) {
    out[i] = arrondiFCFA(serie[i] ?? 0);
  }
  return out;
}
