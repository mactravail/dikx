/**
 * Moteur de FACTURATION — pur et deterministe (aucune I/O, aucun aleatoire).
 *
 * Calcule les totaux d'un devis / facture / avoir : HT par ligne, remises, TVA
 * ventilee par taux, TTC et reste a payer. C'est le SEUL endroit ou ces montants
 * sont produits ; ni l'UI ni l'IA ne calculent un chiffre (regle CLAUDE.md).
 *
 * Arrondi : les calculs intermediaires sont decimaux ; on arrondit a l'entier
 * FCFA au moment de produire chaque ligne, via `arrondiFCFA()`. Les totaux sont
 * la somme des lignes arrondies, de sorte que l'affichage soit exactement
 * coherent (Σ lignes = total).
 *
 * Aucun taux en dur : le taux de TVA par defaut est injecte via les options
 * (l'appelant le lit dans `PARAMETRES.tva.taux`).
 */

import type { FCFA, Taux } from "../types/money.js";
import type {
  DocumentInput,
  DocumentCalc,
  LigneDocumentCalc,
  VentilationTVA,
} from "../types/facturation.js";
import { arrondiFCFA } from "./arrondi.js";

export interface OptionsFacturation {
  /** Taux de TVA applique aux lignes sans taux explicite (vient de PARAMETRES). */
  tauxTVADefaut: Taux;
}

export function calculerDocument(
  doc: DocumentInput,
  opts: OptionsFacturation,
): DocumentCalc {
  const remiseGlobale = fraction(doc.remiseGlobalePct ?? 0);
  const facteurGlobal = 1 - remiseGlobale;

  const lignes: LigneDocumentCalc[] = doc.lignes.map((l) => {
    const remisePct = fraction(l.remisePct ?? 0);
    const tauxTVA = doc.assujettiTVA ? l.tauxTVA ?? opts.tauxTVADefaut : 0;
    const quantite = Number.isFinite(l.quantite) ? l.quantite : 0;
    const prixUnitaireHT = l.prixUnitaireHT;

    const brutExact = quantite * prixUnitaireHT;
    // HT apres remise de ligne puis remise globale (proportionnelle).
    const htExact = brutExact * (1 - remisePct) * facteurGlobal;

    const montantHT = arrondiFCFA(htExact);
    const montantTVA = arrondiFCFA(htExact * tauxTVA);

    return {
      designation: l.designation,
      quantite,
      prixUnitaireHT,
      tauxTVA,
      remisePct,
      montantBrutHT: arrondiFCFA(brutExact),
      montantHT,
      montantTVA,
      montantTTC: montantHT + montantTVA,
    };
  });

  const totalBrutHT = somme(lignes.map((l) => l.montantBrutHT));
  const totalHT = somme(lignes.map((l) => l.montantHT));
  const totalTVA = somme(lignes.map((l) => l.montantTVA));
  const totalTTC = totalHT + totalTVA;
  const remise = totalBrutHT - totalHT;

  const montantPaye = Math.max(0, arrondiFCFA(doc.montantPaye ?? 0));

  return {
    type: doc.type,
    lignes,
    totalBrutHT,
    remise,
    totalHT,
    totalTVA,
    totalTTC,
    ventilationTVA: ventiler(lignes),
    montantPaye,
    resteAPayer: totalTTC - montantPaye,
  };
}

/** Regroupe les lignes par taux de TVA (base HT et TVA), taux decroissant. */
function ventiler(lignes: LigneDocumentCalc[]): VentilationTVA[] {
  const map = new Map<Taux, VentilationTVA>();
  for (const l of lignes) {
    const v = map.get(l.tauxTVA) ?? { taux: l.tauxTVA, baseHT: 0, montantTVA: 0 };
    v.baseHT += l.montantHT;
    v.montantTVA += l.montantTVA;
    map.set(l.tauxTVA, v);
  }
  return [...map.values()].sort((a, b) => b.taux - a.taux);
}

function somme(xs: FCFA[]): FCFA {
  return xs.reduce((s, x) => s + x, 0);
}

/** Normalise une fraction dans [0, 1] (les valeurs invalides -> 0). */
function fraction(x: number): number {
  if (!Number.isFinite(x) || x <= 0) return 0;
  return x >= 1 ? 1 : x;
}
