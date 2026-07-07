/**
 * T1 — Investissements & financements (plan de financement initial).
 *
 * Emplois   = total des investissements + BFR de depart (annee 1, repris de T7).
 * Ressources= apport capital + compte courant + subvention + emprunt.
 * Equilibre = ressources couvrent les emplois (ecart >= 0). C'est le controle
 * exige par le flux de questions (le financement doit couvrir invest + BFR).
 */

import type { Investissement } from "../types/dossier-input.js";
import type { FCFA } from "../types/money.js";
import type { T1, T1LigneInvestissement } from "../types/dossier-output.js";
import { arrondiFCFA } from "./arrondi.js";

export interface EntreeT1 {
  investissements: Investissement[];
  bfrInitial: FCFA;
  apportCapital: FCFA;
  apportCompteCourant: FCFA;
  subventionInvestissement: FCFA;
  /** Montant de l'emprunt (0 si pas d'emprunt). */
  emprunt: FCFA;
}

export function calculerT1(e: EntreeT1): T1 {
  const lignes: T1LigneInvestissement[] = e.investissements.map((inv) => ({
    nature: inv.nature,
    libelle: inv.libelle ?? inv.nature,
    montantHT: arrondiFCFA(inv.montantHT),
  }));

  const totalInvestissements = arrondiFCFA(
    e.investissements.reduce((s, inv) => s + inv.montantHT, 0),
  );
  const bfrInitial = arrondiFCFA(e.bfrInitial);
  const totalEmplois = totalInvestissements + bfrInitial;

  const apportCapital = arrondiFCFA(e.apportCapital);
  const apportCompteCourant = arrondiFCFA(e.apportCompteCourant);
  const subventionInvestissement = arrondiFCFA(e.subventionInvestissement);
  const emprunt = arrondiFCFA(e.emprunt);
  const totalRessources = apportCapital + apportCompteCourant + subventionInvestissement + emprunt;

  const ecart = totalRessources - totalEmplois;

  return {
    investissements: lignes,
    totalInvestissements,
    bfrInitial,
    totalEmplois,
    apportCapital,
    apportCompteCourant,
    subventionInvestissement,
    emprunt,
    totalRessources,
    ecart,
    equilibre: ecart >= 0,
  };
}
