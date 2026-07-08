/**
 * Moteur CHARGES & DEPENSES — pur et deterministe (aucune I/O, aucun aleatoire).
 *
 * A partir des depenses saisies, il produit : par ligne le HT, la TVA deductible
 * et le TTC ; puis les totaux, la repartition par categorie (avec la part de
 * chacune) et le cout annuel des charges recurrentes. C'est le SEUL endroit ou
 * ces montants sont produits ; ni l'UI ni l'IA ne calculent un chiffre.
 *
 * Aucun taux en dur : le taux de TVA par defaut est injecte via les options
 * (l'appelant le lit dans `PARAMETRES.tva.taux`).
 *
 * Arrondi : le HT et la TVA sont arrondis a l'entier FCFA au moment de produire
 * chaque ligne ; les totaux sont la somme des lignes arrondies (Σ lignes = total).
 */

import type { FCFA, Taux } from "../types/money.js";
import type {
  CategorieDepense,
  DepenseInput,
  DepenseCalc,
  Recurrence,
  RepartitionCategorie,
  ResultatDepenses,
} from "../types/depenses.js";
import { arrondiFCFA } from "./arrondi.js";

export interface OptionsDepenses {
  /** Taux de TVA applique aux depenses sans taux explicite (vient de PARAMETRES). */
  tauxTVADefaut: Taux;
}

/** Nombre d'occurrences par an selon la recurrence (convention calendaire). */
const FACTEUR_ANNUEL: Record<Recurrence, number> = {
  ponctuelle: 0, // exclue du cout annuel recurrent
  mensuelle: 12,
  trimestrielle: 4,
  annuelle: 1,
};

export function calculerDepenses(
  depenses: DepenseInput[],
  opts: OptionsDepenses,
): ResultatDepenses {
  const lignes: DepenseCalc[] = depenses.map((d) => {
    const tauxTVA = fraction(d.tauxTVA ?? opts.tauxTVADefaut);
    const htExact = Number.isFinite(d.montantHT) ? d.montantHT : 0;

    const montantHT = arrondiFCFA(htExact);
    const montantTVA = arrondiFCFA(htExact * tauxTVA);
    const montantTTC = montantHT + montantTVA;
    const facteur = FACTEUR_ANNUEL[d.recurrence] ?? 0;

    return {
      categorie: d.categorie,
      tauxTVA,
      recurrence: d.recurrence,
      montantHT,
      montantTVA,
      montantTTC,
      montantAnnualiseTTC: arrondiFCFA(montantTTC * facteur),
    };
  });

  const totalHT = somme(lignes.map((l) => l.montantHT));
  const totalTVA = somme(lignes.map((l) => l.montantTVA));
  const totalTTC = totalHT + totalTVA;
  const totalAnnualiseTTC = somme(lignes.map((l) => l.montantAnnualiseTTC));

  return {
    lignes,
    totalHT,
    totalTVA,
    totalTTC,
    totalAnnualiseTTC,
    repartition: repartir(lignes, totalTTC),
  };
}

/** Regroupe les depenses par categorie (total HT/TTC et part), part decroissante. */
function repartir(lignes: DepenseCalc[], totalTTC: FCFA): RepartitionCategorie[] {
  const map = new Map<CategorieDepense, RepartitionCategorie>();
  for (const l of lignes) {
    const r =
      map.get(l.categorie) ??
      { categorie: l.categorie, totalHT: 0, totalTTC: 0, part: 0 };
    r.totalHT += l.montantHT;
    r.totalTTC += l.montantTTC;
    map.set(l.categorie, r);
  }
  const repartition = [...map.values()].sort((a, b) => b.totalTTC - a.totalTTC);
  for (const r of repartition) {
    r.part = totalTTC > 0 ? r.totalTTC / totalTTC : 0;
  }
  return repartition;
}

function somme(xs: FCFA[]): FCFA {
  return xs.reduce((s, x) => s + x, 0);
}

/** Normalise une fraction dans [0, 1] (les valeurs invalides -> 0). */
function fraction(x: number): number {
  if (!Number.isFinite(x) || x <= 0) return 0;
  return x >= 1 ? 1 : x;
}
