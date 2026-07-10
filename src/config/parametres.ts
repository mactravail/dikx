/**
 * PARAMETRES — la SEULE source des taux, durees et conventions.
 *
 * Regle non negociable (CLAUDE.md) : aucun taux fiscal ou social, aucune duree
 * d'amortissement n'est code en dur dans les moteurs. Tout vit ici et reste
 * parametrable. Chaque valeur "a valider" doit etre confirmee par un expert
 * avant mise en production.
 *
 * Devise : FCFA (XOF), 0 decimale.
 */

import type { Taux } from "../types/money.js";
import type {
  MethodeAmortissementEmprunt,
} from "../types/dossier-output.js";
import type { NatureInvestissement } from "../types/dossier-input.js";

export interface Parametres {
  /** Horizon du previsionnel, en annees. */
  horizonAnnees: number;

  tva: {
    /** Taux de TVA. 18 % au Senegal. */
    taux: Taux; // ✅ confirme (Senegal)
  };

  is: {
    /** Impot sur les societes. */
    taux: Taux; // ⚠️ a valider par un expert (taux IS Senegal en vigueur)
  };

  chargesSocialesPatronales: {
    /**
     * Taux global des charges patronales (CSS, IPRES, etc.) applique au brut.
     * PLACEHOLDER : a confirmer avec un expert paie senegalais. Ne PAS figer
     * cette valeur sans validation. (CSS, IPRES regime general / cadres...)
     */
    taux: Taux; // ⚠️ a valider par un expert (paie SN)
  };

  chargesSocialesSalariales: {
    /**
     * Taux global des cotisations sociales SALARIALES (part employe retenue sur
     * le brut : IPRES retraite regime general, etc.). Sert au bulletin de paie
     * (module RH). PLACEHOLDER a valider par un expert paie SN.
     *
     * NB : ne couvre PAS l'IR sur salaires ni le TRIMF (baremes progressifs) ;
     * ceux-ci sont saisis en "autres retenues" tant que le bareme n'est pas
     * modelise et valide.
     */
    taux: Taux; // ⚠️ a valider par un expert (paie SN)
  };

  /**
   * Durees d'amortissement par defaut (en annees), par nature d'investissement.
   * Utilisees si l'utilisateur ne precise pas de duree (question 1.3).
   * terrain = 0 => NON amortissable.
   * ⚠️ a confirmer au bareme OHADA / DGID.
   */
  dureesAmortissementDefaut: Record<NatureInvestissement, number>;

  emprunt: {
    /** Methode par defaut de l'echeancier. Choix valide : annuites constantes. */
    methode: MethodeAmortissementEmprunt;
  };

  bfr: {
    /** Convention du nombre de jours dans l'annee pour le BFR (usuel OHADA : 360). */
    joursAnnee: number;
  };

  /**
   * Inflation appliquee aux charges fixes d'une annee sur l'autre (fraction).
   * Defaut 0 : charges fixes constantes sur 5 ans. Parametrable.
   */
  inflationChargesFixes: Taux;

  /**
   * Regimes (formel vs informel) — Senegal / OHADA.
   * Pilote quel regime comptable/fiscal s'applique a une entreprise cliente.
   * TOUS les seuils/taux sont des PLACEHOLDERS a valider par un expert (DGID /
   * SYSCOHADA) avant mise en production.
   */
  regimes: {
    /**
     * Seuils de chiffre d'affaires annuel (FCFA) sous lesquels le Systeme
     * Minimal de Tresorerie (SMT) est autorise (SYSCOHADA revise / AUDCIF).
     * ⚠️ a confirmer par un expert-comptable.
     */
    seuilsSMT: {
      commerce: number; // negoce / marchandises
      artisanat: number; // activites artisanales et assimilees
      services: number; // prestations de services
    };

    /**
     * CGU — Contribution Globale Unique (petits contribuables, personnes
     * physiques). Impot synthetique qui remplace TVA + IR/IS + CEL (patente).
     * Le bareme reel de la CGU est progressif par tranche de CA et differe
     * biens / services : il DOIT etre modelise et valide avec un expert avant
     * tout calcul. On n'expose ici que le seuil d'eligibilite (placeholder).
     */
    cgu: {
      /** CA annuel maximum pour relever de la CGU (FCFA). ⚠️ a valider (DGID). */
      seuilChiffreAffaires: number; // ⚠️ PLACEHOLDER
      /**
       * Bareme CGU (taux par tranche de CA) — NON defini tant qu'un expert ne
       * l'a pas valide. Laisse vide volontairement : aucun montant CGU ne doit
       * etre calcule avec un bareme invente.
       */
      bareme: never[];
    };
  };
}

export const PARAMETRES: Parametres = {
  horizonAnnees: 5,

  tva: {
    taux: 0.18, // ✅ confirme (Senegal)
  },

  is: {
    taux: 0.30, // ⚠️ a valider par un expert
  },

  chargesSocialesPatronales: {
    taux: 0.21, // ⚠️ PLACEHOLDER a valider par un expert paie SN
  },

  chargesSocialesSalariales: {
    taux: 0.056, // ⚠️ PLACEHOLDER (ordre IPRES salarial regime general) a valider
  },

  dureesAmortissementDefaut: {
    terrain: 0, // non amortissable
    construction: 20, // ⚠️ a confirmer (OHADA/DGID)
    materiel: 5, // ⚠️ a confirmer
    mobilier: 10, // ⚠️ a confirmer
    informatique: 3, // ⚠️ a confirmer
    vehicule: 5, // ⚠️ a confirmer
    fraisEtablissement: 3, // ⚠️ a confirmer (2-3 ans)
    autre: 5, // ⚠️ a confirmer (defaut prudent)
  },

  emprunt: {
    methode: "annuites_constantes",
  },

  bfr: {
    joursAnnee: 360,
  },

  inflationChargesFixes: 0,

  regimes: {
    seuilsSMT: {
      commerce: 60_000_000, // ⚠️ a confirmer (SYSCOHADA revise)
      artisanat: 40_000_000, // ⚠️ a confirmer
      services: 30_000_000, // ⚠️ a confirmer
    },
    cgu: {
      seuilChiffreAffaires: 50_000_000, // ⚠️ PLACEHOLDER a valider (DGID)
      bareme: [], // a definir avec un expert avant tout calcul CGU
    },
  },
};
