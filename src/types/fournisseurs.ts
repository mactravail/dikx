/**
 * Types du module Fournisseurs (encours et echeances de paiement).
 *
 * Ces types decrivent l'ENTREE collectee par l'UI (des fournisseurs et leur
 * solde du) et la SORTIE produite par le moteur (`src/engine/fournisseurs.ts`).
 * Regle non negociable (CLAUDE.md) : sommer des encours et ventiler echu / a
 * echoir EST un calcul ; il n'est donc pas fait dans le navigateur mais dans le
 * moteur deterministe et teste, cote serveur.
 *
 * Argent : FCFA (XOF) entiers.
 */

import type { FCFA, Taux } from "./money.js";

/** Un fournisseur et son solde du (SAISIE). */
export interface FournisseurInput {
  /** Nom (ou reference) du fournisseur. */
  nom: string;
  /** Encours du (solde a payer) en FCFA. Defaut 0. */
  encours: FCFA;
  /** Date d'echeance du solde (ISO AAAA-MM-JJ). Optionnelle. */
  echeance?: string;
}

/** Un fournisseur apres agregation (SNAPSHOT moteur). */
export interface FournisseurCalc {
  nom: string;
  encours: FCFA;
  /** Echeance depassee a la date de reference (encours echu). */
  echu: boolean;
  /** Part du fournisseur dans l'encours total (fraction). */
  part: Taux;
}

/** Resultat de l'agregation des fournisseurs (SNAPSHOT). */
export interface ResultatFournisseurs {
  /** Fournisseurs tries par encours decroissant. */
  parFournisseur: FournisseurCalc[];
  nbFournisseurs: number;
  /** Encours total = Σ encours (FCFA). */
  totalEncours: FCFA;
  /** Part echue (echeance <= date de reference). */
  totalEchu: FCFA;
  /** Part a echoir (echeance future ou absente). */
  totalAEchoir: FCFA;
}
