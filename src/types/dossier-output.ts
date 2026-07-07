/**
 * Modele de SORTIE du moteur : les 9 tableaux + indicateurs.
 *
 * Tous les montants sont des ENTIERS de FCFA (deja passes par arrondiFCFA()).
 * Les pourcentages sont des fractions (0.18 = 18 %).
 *
 * Conventions de series :
 *  - `Serie5` / `Serie5FCFA` : 5 valeurs, index 0 = annee 1.
 *  - `Serie12` : 12 valeurs, index 0 = mois 1.
 */

import type { FCFA, Serie5, Serie5FCFA, Serie12, Taux } from "./money.js";
import type { FormeJuridique, NatureInvestissement } from "./dossier-input.js";

/* ================================================================== */
/* T1 — Investissements & financements                                 */
/* ================================================================== */

export interface T1LigneInvestissement {
  nature: NatureInvestissement;
  libelle: string;
  montantHT: FCFA;
}

export interface T1 {
  investissements: T1LigneInvestissement[];
  totalInvestissements: FCFA;
  /** BFR de depart (annee 1), repris de T7. */
  bfrInitial: FCFA;
  /** Emplois = investissements + BFR initial. */
  totalEmplois: FCFA;

  apportCapital: FCFA;
  apportCompteCourant: FCFA;
  subventionInvestissement: FCFA;
  emprunt: FCFA;
  /** Ressources = apports + subvention + emprunt. */
  totalRessources: FCFA;

  /** totalRessources - totalEmplois. >= 0 => le financement boucle. */
  ecart: FCFA;
  equilibre: boolean;
}

/* ================================================================== */
/* T2 — Amortissements                                                 */
/* ================================================================== */

export interface T2LignePoste {
  nature: NatureInvestissement;
  libelle: string;
  montantHT: FCFA;
  /** 0 si non amortissable (terrain). */
  dureeAmortissement: number;
  amortissable: boolean;
  /** Dotation annuelle sur l'horizon 5 ans (0 apres la fin de duree). */
  dotations: Serie5FCFA;
  /** Cumul des dotations a la fin de chaque annee. */
  cumul: Serie5FCFA;
  /** Valeur nette comptable a la fin de chaque annee. */
  vnc: Serie5FCFA;
}

export interface T2 {
  postes: T2LignePoste[];
  /** Somme des dotations de tous les postes, par annee. Alimente T5 et la CAF. */
  totalDotations: Serie5FCFA;
}

/* ================================================================== */
/* T3 — Emprunt : echeancier                                          */
/* ================================================================== */

export type MethodeAmortissementEmprunt = "annuites_constantes" | "capital_constant";

export interface T3LigneAnnuelle {
  /** Numero d'annee 1..N (N = duree de l'emprunt). */
  annee: number;
  capitalDebutPeriode: FCFA;
  interets: FCFA;
  capitalRembourse: FCFA;
  annuite: FCFA;
  capitalRestantDu: FCFA;
}

export interface T3 {
  methode: MethodeAmortissementEmprunt;
  montant: FCFA;
  tauxAnnuel: Taux;
  dureeAnnees: number;
  differeMois: number;
  /** Echeancier annuel sur la duree complete de l'emprunt. */
  lignes: T3LigneAnnuelle[];
  /** Vue agregee sur l'horizon 5 ans (0 au-dela de la duree de l'emprunt). */
  interetsParAn: Serie5FCFA;
  capitalParAn: Serie5FCFA;
  annuiteParAn: Serie5FCFA;
  totalInterets: FCFA;
  /** Service de la dette mensuel de l'annee 1 (pour la tresorerie T9). */
  serviceMensuelAnnee1: Serie12<FCFA>;
}

/* ================================================================== */
/* T4 — Salaires & charges sociales                                   */
/* ================================================================== */

export interface T4LignePoste {
  intitule: string;
  nombre: number;
  salaireBrutMensuel: FCFA;
  /** Brut annuel = salaireBrutMensuel * nombre * 12. */
  salaireBrutAnnuel: FCFA;
  /** Charges patronales annuelles (taux parametrable). */
  chargesPatronales: FCFA;
  /** Cout total employeur annuel = brut + charges. */
  coutTotalAnnuel: FCFA;
}

export interface T4 {
  postes: T4LignePoste[];
  /** Ligne dediee dirigeant (null si pas de salaire dirigeant). */
  dirigeant: T4LignePoste | null;
  tauxChargesPatronales: Taux;
  /** Totaux annee 1. */
  totalBrutAnnuel: FCFA;
  totalChargesPatronales: FCFA;
  totalCoutEmployeur: FCFA;
  /** Cout total employeur projete sur 5 ans (constant hors inflation). */
  coutEmployeurParAn: Serie5FCFA;
}

/* ================================================================== */
/* T5 — Compte de resultat previsionnel 5 ans                         */
/* ================================================================== */

export interface T5 {
  chiffreAffaires: Serie5FCFA;
  achatsConsommes: Serie5FCFA;
  margeBrute: Serie5FCFA;
  chargesExternes: Serie5FCFA;
  valeurAjoutee: Serie5FCFA;
  chargesPersonnel: Serie5FCFA;
  impotsTaxes: Serie5FCFA;
  excedentBrutExploitation: Serie5FCFA;
  dotationsAmortissements: Serie5FCFA;
  resultatExploitation: Serie5FCFA;
  chargesFinancieres: Serie5FCFA;
  resultatAvantImpot: Serie5FCFA;
  impotSocietes: Serie5FCFA;
  resultatNet: Serie5FCFA;
}

/* ================================================================== */
/* T6 — SIG (en valeur et en % du CA)                                 */
/* ================================================================== */

export interface SoldeSIG {
  valeur: Serie5FCFA;
  /** Part de chaque solde dans le CA de la meme annee (fraction). */
  pourcentageCA: Serie5;
}

export interface T6 {
  margeCommerciale: SoldeSIG;
  valeurAjoutee: SoldeSIG;
  excedentBrutExploitation: SoldeSIG;
  resultatExploitation: SoldeSIG;
  resultatCourant: SoldeSIG;
  resultatNet: SoldeSIG;
}

/* ================================================================== */
/* T7 — BFR                                                           */
/* ================================================================== */

export interface T7 {
  stocks: Serie5FCFA;
  creancesClients: Serie5FCFA;
  dettesFournisseurs: Serie5FCFA;
  /** BFR = stocks + creances - dettes. */
  bfr: Serie5FCFA;
  /** Variation du BFR d'une annee sur l'autre (annee 1 = BFR initial). */
  variationBFR: Serie5FCFA;
}

/* ================================================================== */
/* T8 — Plan de financement 5 ans                                     */
/* ================================================================== */

export interface T8 {
  /* Emplois */
  investissements: Serie5FCFA;
  variationBFR: Serie5FCFA;
  remboursementsCapital: Serie5FCFA;
  totalEmplois: Serie5FCFA;

  /* Ressources */
  capaciteAutofinancement: Serie5FCFA;
  apports: Serie5FCFA;
  subventions: Serie5FCFA;
  emprunts: Serie5FCFA;
  totalRessources: Serie5FCFA;

  /* Soldes */
  soldeAnnuel: Serie5FCFA;
  soldeCumule: Serie5FCFA;
}

/* ================================================================== */
/* T9 — Budget de tresorerie 12 mois (annee 1)                        */
/* ================================================================== */

export interface T9 {
  /** Solde de tresorerie au debut du mois 1 (avant tout flux). */
  soldeInitial: FCFA;

  /* Encaissements */
  encaissementsCA: Serie12<FCFA>;
  encaissementsApports: Serie12<FCFA>;
  encaissementsEmprunt: Serie12<FCFA>;
  encaissementsSubvention: Serie12<FCFA>;
  totalEncaissements: Serie12<FCFA>;

  /* Decaissements */
  decaissementsInvestissements: Serie12<FCFA>;
  decaissementsAchats: Serie12<FCFA>;
  decaissementsChargesExternes: Serie12<FCFA>;
  decaissementsSalaires: Serie12<FCFA>;
  decaissementsEmprunt: Serie12<FCFA>;
  decaissementsTVA: Serie12<FCFA>;
  decaissementsIS: Serie12<FCFA>;
  totalDecaissements: Serie12<FCFA>;

  /* Soldes */
  soldeMensuel: Serie12<FCFA>;
  soldeCumule: Serie12<FCFA>;
}

/* ================================================================== */
/* IND — Indicateurs                                                  */
/* ================================================================== */

export interface Indicateurs {
  /** Charges fixes annuelles (annee 1). */
  chargesFixes: Serie5FCFA;
  /** Taux de marge sur couts variables (annee 1). */
  tauxMargeSurCoutsVariables: Serie5;
  /** Seuil de rentabilite en CA (point mort), par annee. */
  seuilRentabilite: Serie5FCFA;
  /** Seuil en mois (point mort atteint apres X mois), par annee. */
  pointMortMois: Serie5;
  /** CAF = resultat net + dotations amortissements. */
  caf: Serie5FCFA;
  /** Service de la dette annuel (capital + interets). */
  serviceDette: Serie5FCFA;
  /** DSCR = CAF / service de la dette (null quand pas de dette). */
  dscr: Array<number | null>;
}

/* ================================================================== */
/* Meta + parametres utilises + avertissements                        */
/* ================================================================== */

export interface MetaDossier {
  nomProjet: string;
  secteur: string;
  formeJuridique: FormeJuridique;
  moisDemarrage: string; // ex. "01/2026"
  assujettiTVA: boolean;
  horizonAnnees: number;
  devise: "XOF";
  dateGeneration: string; // ISO
}

export interface ParametresUtilises {
  tauxTVA: Taux;
  tauxIS: Taux;
  tauxChargesSocialesPatronales: Taux;
  methodeAmortissementEmprunt: MethodeAmortissementEmprunt;
  joursAnnee: number;
  inflationChargesFixes: Taux;
}

/* ================================================================== */
/* DossierOutput                                                      */
/* ================================================================== */

export interface DossierOutput {
  meta: MetaDossier;
  t1: T1;
  t2: T2;
  t3: T3 | null;
  t4: T4;
  t5: T5;
  t6: T6;
  t7: T7;
  t8: T8;
  t9: T9;
  indicateurs: Indicateurs;
  parametresUtilises: ParametresUtilises;
  /** Alertes de coherence (financement non boucle, valeurs estimees, garde-fous). */
  avertissements: string[];
}
