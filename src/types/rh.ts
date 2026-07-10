/**
 * Types du module Ressources humaines (paie).
 *
 * Ces types decrivent l'ENTREE collectee par l'UI (les elements de paie d'un
 * employe pour un mois) et la SORTIE produite par le moteur (`src/engine/paie.ts`).
 * Regle non negociable (CLAUDE.md) : aucun montant (cotisations, net a payer,
 * cout employeur, masse salariale) n'est calcule dans le navigateur ; tout vient
 * du moteur deterministe et teste, cote serveur.
 *
 * Argent : FCFA (XOF) entiers. Les taux sont des fractions (0.056 = 5,6 %).
 * Aucun taux en dur : les taux salarial / patronal sont injectes via les options
 * (l'appelant les lit dans `PARAMETRES.chargesSociales*`).
 */

import type { FCFA, Taux } from "./money.js";

/** Elements de paie d'un employe pour un mois (SAISIE). */
export interface BulletinInput {
  /** Salaire brut mensuel de base, en FCFA entiers. */
  salaireBrutMensuel: FCFA;
  /** Primes et indemnites imposables ajoutees au brut (defaut 0). */
  primes?: FCFA;
  /**
   * Autres retenues sur le net : avances, prets, IR/TRIMF estimes saisis par
   * l'employeur tant que le bareme n'est pas modelise (defaut 0).
   */
  autresRetenues?: FCFA;
}

/** Un bulletin apres calcul (snapshot moteur), montants mensuels. */
export interface BulletinCalc {
  /** Brut imposable = salaire de base + primes. */
  brut: FCFA;
  /** Cotisations sociales salariales (part employe) = brut × taux salarial. */
  cotisationsSalariales: FCFA;
  /** Autres retenues reportees telles quelles (avances, IR estime...). */
  autresRetenues: FCFA;
  /** Net a payer = brut − cotisations salariales − autres retenues (>= 0). */
  netAPayer: FCFA;
  /** Cotisations sociales patronales (part employeur) = brut × taux patronal. */
  cotisationsPatronales: FCFA;
  /** Cout employeur = brut + cotisations patronales. */
  coutEmployeur: FCFA;
}

/** Resultat de la paie du mois (SNAPSHOT). */
export interface ResultatPaie {
  bulletins: BulletinCalc[];
  /** Taux salarial applique (issu des parametres) — pour tracabilite. */
  tauxCotisationsSalariales: Taux;
  /** Taux patronal applique (issu des parametres) — pour tracabilite. */
  tauxCotisationsPatronales: Taux;
  totalBrut: FCFA;
  totalCotisationsSalariales: FCFA;
  totalCotisationsPatronales: FCFA;
  /** Total des nets a payer aux employes. */
  totalNetAPayer: FCFA;
  /** Masse salariale chargee du mois (Σ cout employeur). */
  totalCoutEmployeur: FCFA;
}
