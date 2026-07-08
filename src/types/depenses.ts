/**
 * Types du module Charges & Depenses.
 *
 * Ces types decrivent l'ENTREE collectee par l'UI (des depenses saisies) et la
 * SORTIE produite par le moteur (`src/engine/depenses.ts`). Regle non negociable
 * (CLAUDE.md) : aucun total (HT, TVA deductible, TTC, repartition, projection
 * annuelle) n'est calcule dans le navigateur ; tout vient du moteur deterministe
 * et teste, cote serveur.
 *
 * Argent : FCFA (XOF) entiers. Les taux sont des fractions (0.18 = 18 %).
 */

import type { FCFA, Taux } from "./money.js";

/** Categorie de charge (poste de depense). */
export type CategorieDepense =
  | "loyer"
  | "energie"
  | "eau"
  | "telecom"
  | "transport"
  | "fournitures"
  | "entretien"
  | "honoraires"
  | "assurance"
  | "impots_taxes"
  | "salaires"
  | "frais_bancaires"
  | "marketing"
  | "autre";

/** Frequence de la charge (pour la projection du cout annuel recurrent). */
export type Recurrence = "ponctuelle" | "mensuelle" | "trimestrielle" | "annuelle";

/** Une depense saisie. */
export interface DepenseInput {
  categorie: CategorieDepense;
  /** Montant HT, en FCFA entiers. */
  montantHT: FCFA;
  /** Taux de TVA deductible (fraction). Defaut : le taux fourni en option. */
  tauxTVA?: Taux;
  recurrence: Recurrence;
}

/** Une depense apres calcul (snapshot moteur). */
export interface DepenseCalc {
  categorie: CategorieDepense;
  tauxTVA: Taux;
  recurrence: Recurrence;
  montantHT: FCFA;
  /** TVA deductible (recuperable), arrondie. */
  montantTVA: FCFA;
  montantTTC: FCFA;
  /**
   * Cout TTC ramene a l'annee selon la recurrence
   * (mensuelle × 12, trimestrielle × 4, annuelle × 1, ponctuelle × 0).
   */
  montantAnnualiseTTC: FCFA;
}

/** Repartition des depenses par categorie. */
export interface RepartitionCategorie {
  categorie: CategorieDepense;
  totalHT: FCFA;
  totalTTC: FCFA;
  /** Part de la categorie dans le total TTC (fraction). */
  part: Taux;
}

/** Resultat du calcul des depenses (SNAPSHOT). */
export interface ResultatDepenses {
  lignes: DepenseCalc[];
  totalHT: FCFA;
  /** Total de la TVA deductible. */
  totalTVA: FCFA;
  totalTTC: FCFA;
  /** Cout annuel des charges recurrentes (Σ des montants annualises). */
  totalAnnualiseTTC: FCFA;
  repartition: RepartitionCategorie[];
}
