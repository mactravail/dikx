/**
 * Contrat de donnees du module RAPPORT FINANCIER, SCOPE par entreprise active.
 *
 * Persiste dans SUPABASE (table `rapport_financier`, 0008 + RLS 0014) via les
 * server actions de app/(app)/rapports/data-actions.ts. Le `store` ci-dessous ne
 * fait que deleguer a ces actions (methodes ASYNC, prenant l'id de l'entreprise).
 *
 * Contrairement aux autres stores, ce module ne porte AUCUN chiffre issu de
 * l'activite : les montants de l'exercice sont TOUJOURS recalcules par les
 * moteurs (server action). On ne stocke ici que :
 *   - le NARRATIF redige par le comptable (texte libre, pas un chiffre) ;
 *   - les parametres du rapport (exercice, periode) ;
 *   - les REFERENCES saisies a la main (N-1, budget) — des saisies, pas des
 *     totaux calcules par l'UI.
 */

import {
  chargerRapportAction,
  sauverRapportAction,
} from "@/app/(app)/rapports/data-actions";

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
// Delegue a Supabase (server actions, RLS). Methodes ASYNC scopees par l'id de
// l'entreprise active (fourni par le contexte cote client).

export const store = {
  /** Charge le rapport le plus recent de l'entreprise (null si aucun). */
  charger: (entrepriseId: string): Promise<RapportBrouillon | null> => chargerRapportAction(entrepriseId),
  /** Enregistre (upsert par exercice) le brouillon de rapport de l'entreprise. */
  sauver: (entrepriseId: string, b: RapportBrouillon): Promise<void> => sauverRapportAction(entrepriseId, b),
};
