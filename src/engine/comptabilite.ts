/**
 * Moteur COMPTABILITE (SYSCOHADA revise) — pur et deterministe.
 *
 * A partir d'une liste d'ecritures de journal (en partie double), il produit :
 *  - le controle de chaque ecriture (Σ debit = Σ credit ?),
 *  - la BALANCE des comptes (grand livre agrege) : cumul debit/credit et solde
 *    debiteur/crediteur par compte,
 *  - les totaux generaux et le controle d'equilibre global.
 *
 * C'est le SEUL endroit ou ces cumuls sont produits ; ni l'UI ni l'IA ne
 * somment un montant (regle CLAUDE.md). Sommer des mouvements EST un calcul.
 *
 * Arrondi : les montants arrivent en FCFA entiers ; on les passe par
 * `arrondiFCFA()` (garde-fou) au moment de produire chaque cumul de sortie.
 */

import type { FCFA } from "../types/money.js";
import type {
  EcritureInput,
  EcritureCalc,
  LigneBalance,
  ResultatComptabilite,
} from "../types/comptabilite.js";
import { arrondiFCFA } from "./arrondi.js";

export function calculerComptabilite(
  ecritures: EcritureInput[],
): ResultatComptabilite {
  const comptes = new Map<string, LigneBalance>();
  const ecrituresCalc: EcritureCalc[] = [];

  for (const e of ecritures) {
    let totalDebit = 0;
    let totalCredit = 0;

    for (const l of e.lignes) {
      const debit = arrondiFCFA(positif(l.debit));
      const credit = arrondiFCFA(positif(l.credit));
      totalDebit += debit;
      totalCredit += credit;

      const compte = comptes.get(l.compte) ?? {
        compte: l.compte,
        libelle: l.compte,
        totalDebit: 0,
        totalCredit: 0,
        soldeDebiteur: 0,
        soldeCrediteur: 0,
      };
      // On garde le premier libelle non vide rencontre pour ce compte.
      const lib = l.libelle?.trim();
      if (lib && compte.libelle === compte.compte) compte.libelle = lib;
      compte.totalDebit += debit;
      compte.totalCredit += credit;
      comptes.set(l.compte, compte);
    }

    ecrituresCalc.push({
      totalDebit,
      totalCredit,
      equilibree: totalDebit === totalCredit,
    });
  }

  // Balance triee par numero de compte (ordre lexicographique = ordre du plan).
  const balance = [...comptes.values()].sort((a, b) =>
    a.compte < b.compte ? -1 : a.compte > b.compte ? 1 : 0,
  );
  for (const b of balance) {
    const solde = b.totalDebit - b.totalCredit;
    b.soldeDebiteur = solde > 0 ? solde : 0;
    b.soldeCrediteur = solde < 0 ? -solde : 0;
  }

  const totalDebit = somme(balance.map((b) => b.totalDebit));
  const totalCredit = somme(balance.map((b) => b.totalCredit));

  return {
    ecritures: ecrituresCalc,
    balance,
    totalDebit,
    totalCredit,
    totalSoldeDebiteur: somme(balance.map((b) => b.soldeDebiteur)),
    totalSoldeCrediteur: somme(balance.map((b) => b.soldeCrediteur)),
    equilibre: totalDebit === totalCredit,
  };
}

function somme(xs: FCFA[]): FCFA {
  return xs.reduce((s, x) => s + x, 0);
}

/** Un montant de mouvement ne peut etre negatif (les valeurs invalides -> 0). */
function positif(x: number): number {
  return Number.isFinite(x) && x > 0 ? x : 0;
}
