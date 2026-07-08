/**
 * Types du module Facturation (devis / factures / avoirs).
 *
 * Ces types decrivent l'ENTREE collectee par l'UI et la SORTIE produite par le
 * moteur (`src/engine/facturation.ts`). Regle non negociable (CLAUDE.md) : aucun
 * total (HT, TVA, TTC, reste a payer) n'est calcule dans le navigateur ; ils
 * viennent tous du moteur deterministe et teste, cote serveur.
 *
 * Argent : FCFA (XOF) entiers. Les taux sont des fractions (0.18 = 18 %).
 */

import type { FCFA, Taux } from "./money.js";

export type TypeDocument = "devis" | "facture" | "avoir";

/** Une ligne saisie dans un document. */
export interface LigneDocumentInput {
  designation: string;
  /** Quantite (peut etre decimale : heures, kg, m²…). */
  quantite: number;
  /** Prix unitaire HT, en FCFA entiers. */
  prixUnitaireHT: FCFA;
  /** Taux de TVA de la ligne (fraction). Par defaut : le taux fourni en option. */
  tauxTVA?: Taux;
  /** Remise de ligne, en fraction (0.10 = 10 %). */
  remisePct?: Taux;
}

/** Document complet a calculer. */
export interface DocumentInput {
  type: TypeDocument;
  /** Si false, la TVA est nulle sur tout le document (regime non assujetti). */
  assujettiTVA: boolean;
  lignes: LigneDocumentInput[];
  /** Remise globale (pied de document), en fraction. */
  remiseGlobalePct?: Taux;
  /** Montant deja encaisse (acomptes, reglements partiels), en FCFA. */
  montantPaye?: FCFA;
}

/** Une ligne apres calcul (snapshot moteur). */
export interface LigneDocumentCalc {
  designation: string;
  quantite: number;
  prixUnitaireHT: FCFA;
  tauxTVA: Taux;
  remisePct: Taux;
  /** quantite × prix unitaire, avant remise (arrondi). */
  montantBrutHT: FCFA;
  /** Montant HT apres remise de ligne ET remise globale (arrondi). */
  montantHT: FCFA;
  /** TVA de la ligne, calculee sur le HT remise (arrondi). */
  montantTVA: FCFA;
  /** montantHT + montantTVA. */
  montantTTC: FCFA;
}

/** Ventilation de la TVA par taux (pour le pied de facture SYSCOHADA). */
export interface VentilationTVA {
  taux: Taux;
  baseHT: FCFA;
  montantTVA: FCFA;
}

/** Resultat du calcul d'un document (SNAPSHOT stocke en base). */
export interface DocumentCalc {
  type: TypeDocument;
  lignes: LigneDocumentCalc[];
  /** Total HT avant remises. */
  totalBrutHT: FCFA;
  /** Montant total des remises (ligne + globale). */
  remise: FCFA;
  /** Total HT apres remises. */
  totalHT: FCFA;
  totalTVA: FCFA;
  totalTTC: FCFA;
  ventilationTVA: VentilationTVA[];
  montantPaye: FCFA;
  /** totalTTC − montantPaye (negatif = trop-percu). */
  resteAPayer: FCFA;
}
