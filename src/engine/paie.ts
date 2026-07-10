/**
 * Moteur PAIE (module RH) — pur et deterministe (aucune I/O, aucun aleatoire).
 *
 * A partir des elements de paie du mois, il produit pour chaque bulletin : le
 * brut (base + primes), les cotisations sociales salariales et patronales, le
 * net a payer et le cout employeur ; puis les totaux (masse salariale chargee).
 * C'est le SEUL endroit ou ces montants sont produits ; ni l'UI ni l'IA ne
 * calculent un chiffre.
 *
 * Aucun taux en dur : les taux salarial et patronal sont injectes via les
 * options (l'appelant les lit dans `PARAMETRES.chargesSociales*`, marques
 * « a valider par un expert »).
 *
 * Arrondi : brut, cotisations et net sont arrondis a l'entier FCFA au moment de
 * produire chaque bulletin ; les totaux sont la somme des bulletins arrondis
 * (Σ bulletins = total).
 */

import type { FCFA, Taux } from "../types/money.js";
import type { BulletinInput, BulletinCalc, ResultatPaie } from "../types/rh.js";
import { arrondiFCFA } from "./arrondi.js";

export interface OptionsPaie {
  /** Taux des cotisations salariales (part employe), fraction. */
  tauxCotisationsSalariales: Taux;
  /** Taux des cotisations patronales (part employeur), fraction. */
  tauxCotisationsPatronales: Taux;
}

export function calculerPaie(
  bulletins: BulletinInput[],
  opts: OptionsPaie,
): ResultatPaie {
  const tauxSal = fraction(opts.tauxCotisationsSalariales);
  const tauxPat = fraction(opts.tauxCotisationsPatronales);

  const lignes: BulletinCalc[] = bulletins.map((b) => {
    const base = montant(b.salaireBrutMensuel);
    const primes = montant(b.primes ?? 0);
    const autresRetenues = montant(b.autresRetenues ?? 0);

    const brut = arrondiFCFA(base + primes);
    const cotisationsSalariales = arrondiFCFA(brut * tauxSal);
    const cotisationsPatronales = arrondiFCFA(brut * tauxPat);
    // Le net ne peut pas etre negatif (retenues plafonnees au disponible).
    const netAPayer = arrondiFCFA(
      Math.max(0, brut - cotisationsSalariales - autresRetenues),
    );
    const coutEmployeur = brut + cotisationsPatronales;

    return {
      brut,
      cotisationsSalariales,
      autresRetenues,
      netAPayer,
      cotisationsPatronales,
      coutEmployeur,
    };
  });

  return {
    bulletins: lignes,
    tauxCotisationsSalariales: tauxSal,
    tauxCotisationsPatronales: tauxPat,
    totalBrut: somme(lignes.map((l) => l.brut)),
    totalCotisationsSalariales: somme(lignes.map((l) => l.cotisationsSalariales)),
    totalCotisationsPatronales: somme(lignes.map((l) => l.cotisationsPatronales)),
    totalNetAPayer: somme(lignes.map((l) => l.netAPayer)),
    totalCoutEmployeur: somme(lignes.map((l) => l.coutEmployeur)),
  };
}

function somme(xs: FCFA[]): FCFA {
  return xs.reduce((s, x) => s + x, 0);
}

/** Normalise un montant fini (les valeurs invalides -> 0). */
function montant(x: number): number {
  return Number.isFinite(x) && x > 0 ? x : 0;
}

/** Normalise une fraction dans [0, 1] (les valeurs invalides -> 0). */
function fraction(x: number): number {
  if (!Number.isFinite(x) || x <= 0) return 0;
  return x >= 1 ? 1 : x;
}
