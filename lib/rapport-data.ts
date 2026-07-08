/**
 * Etat de travail LOCAL du module RAPPORT FINANCIER, SCOPE par entreprise active.
 *
 * Persiste dans le `localStorage` du navigateur en attendant Supabase
 * (db/migrations/0008_rapport.sql). Contrairement aux autres stores, ce module
 * ne porte AUCUN chiffre issu de l'activite : les montants de l'exercice sont
 * TOUJOURS recalcules par les moteurs (server action). On ne stocke ici que :
 *   - le NARRATIF redige par le comptable (texte libre, pas un chiffre) ;
 *   - les parametres du rapport (exercice, periode) ;
 *   - les REFERENCES saisies a la main (N-1, budget) — des saisies, pas des
 *     totaux calcules par l'UI.
 */

import { scopedKey } from "./entreprise-active";

/** Grandeurs de reference d'un exercice (N-1) ou d'un budget — saisies. */
export interface ComparatifSaisie {
  chiffreAffaires: number;
  totalProduits: number;
  totalCharges: number;
  resultatNet: number;
}

/** Brouillon complet d'un rapport financier (narratif + parametres + references). */
export interface RapportBrouillon {
  /** Exercice de reference (annee civile de cloture). */
  exercice: number;
  /** Libelle de periode affiche dans l'en-tete (ex. "Janvier – Decembre 2025"). */
  periode: string;
  /** Lieu de presentation (ex. "Dakar"). */
  lieu: string;
  /** Date de presentation, format libre (ex. "Juillet 2026"). */
  datePresentation: string;

  /* --- narratif redige par le comptable --- */
  faitsMarquants: string;
  analyseExploitation: string;
  analyseEcarts: string;
  perspectives: string;
  conclusion: string;

  /* --- references de comparaison --- */
  comparerN1: boolean;
  comparerBudget: boolean;
  exercicePrecedent: ComparatifSaisie;
  budget: ComparatifSaisie;
}

const COMPARATIF_VIDE: ComparatifSaisie = {
  chiffreAffaires: 0,
  totalProduits: 0,
  totalCharges: 0,
  resultatNet: 0,
};

/** Brouillon par defaut pour une nouvelle entreprise (exercice = annee en cours). */
export function brouillonParDefaut(): RapportBrouillon {
  const annee = new Date().getFullYear();
  return {
    exercice: annee,
    periode: `Janvier – Decembre ${annee}`,
    lieu: "Dakar",
    datePresentation: "",
    faitsMarquants: "",
    analyseExploitation: "",
    analyseEcarts: "",
    perspectives: "",
    conclusion: "",
    comparerN1: false,
    comparerBudget: false,
    exercicePrecedent: { ...COMPARATIF_VIDE },
    budget: { ...COMPARATIF_VIDE },
  };
}

/* -------------------------------- stockage -------------------------------- */

const SUFFIXE = "rapport.brouillon";

export const store = {
  charger(): RapportBrouillon {
    if (typeof window === "undefined") return brouillonParDefaut();
    try {
      const brut = window.localStorage.getItem(scopedKey(SUFFIXE));
      if (!brut) return brouillonParDefaut();
      const val = JSON.parse(brut) as Partial<RapportBrouillon>;
      // Fusion avec les defauts : tolerant aux brouillons anterieurs incomplets.
      return {
        ...brouillonParDefaut(),
        ...val,
        exercicePrecedent: { ...COMPARATIF_VIDE, ...val.exercicePrecedent },
        budget: { ...COMPARATIF_VIDE, ...val.budget },
      };
    } catch {
      return brouillonParDefaut();
    }
  },
  sauver(b: RapportBrouillon): void {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(scopedKey(SUFFIXE), JSON.stringify(b));
    } catch {
      /* quota / mode prive : on ignore, l'etat reste en memoire */
    }
  },
};
