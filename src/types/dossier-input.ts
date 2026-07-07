/**
 * Modele d'ENTREE du moteur : le JSON des reponses collectees sur WhatsApp.
 *
 * Ce type est calque EXACTEMENT sur `flux-questions-previsionnel-5ans.md`.
 * Chaque champ reference le numero de question (ex. 0.1, 1.2) du document.
 * Si le flux de questions change, ce type doit changer aussi.
 */

import type { FCFA, Taux } from "./money.js";

/* ------------------------------------------------------------------ */
/* BLOC 0 — Identite du projet                                         */
/* ------------------------------------------------------------------ */

export type FormeJuridique = "SARL" | "SUARL" | "SA" | "GIE" | "EI";

export interface MoisDemarrage {
  /** Mois 1..12 (1 = janvier). Question 0.4. */
  mois: number;
  /** Annee, ex. 2026. Question 0.4. */
  annee: number;
}

/* ------------------------------------------------------------------ */
/* BLOC 1 — Investissements de depart (boucle)                         */
/* ------------------------------------------------------------------ */

export type NatureInvestissement =
  | "terrain"
  | "construction"
  | "materiel"
  | "mobilier"
  | "informatique"
  | "vehicule"
  | "fraisEtablissement"
  | "autre";

export interface Investissement {
  /** Question 1.1. */
  nature: NatureInvestissement;
  /** Libelle libre optionnel (ex. "Camion 3,5 t"). */
  libelle?: string;
  /** Question 1.2 — montant HT en FCFA. */
  montantHT: FCFA;
  /**
   * Question 1.3 — duree d'amortissement en annees.
   * Optionnel : si absent, le moteur applique le defaut selon `nature`
   * (voir parametres.dureesAmortissementDefaut). `terrain` => non amortissable.
   */
  dureeAmortissement?: number;
}

/* ------------------------------------------------------------------ */
/* BLOC 2 — Financement                                                */
/* ------------------------------------------------------------------ */

export interface Emprunt {
  /** Question 2.5 — montant emprunte en FCFA. */
  montant: FCFA;
  /** Question 2.6 — taux d'interet ANNUEL en fraction (0.08 = 8 %). */
  tauxAnnuel: Taux;
  /** Question 2.7 — duree de remboursement en annees. */
  dureeAnnees: number;
  /** Question 2.8 — differe de remboursement en mois (defaut 0). */
  differeMois?: number;
}

export interface Financement {
  /** Question 2.1 — apport personnel / capital. */
  apportCapital: FCFA;
  /** Question 2.2 — apport en compte courant d'associes (defaut 0). */
  apportCompteCourant?: FCFA;
  /** Question 2.3 — subvention d'investissement (defaut 0). */
  subventionInvestissement?: FCFA;
  /** Questions 2.4 -> 2.8 — null si pas d'emprunt. */
  emprunt?: Emprunt | null;
}

/* ------------------------------------------------------------------ */
/* BLOC 3 — Chiffre d'affaires previsionnel                            */
/* ------------------------------------------------------------------ */

export interface ProduitDetaille {
  libelle: string;
  /** Prix unitaire HT. */
  prixUnitaire: FCFA;
  /** Quantite vendue sur l'annee 1. */
  quantiteAnnee1: number;
}

export interface ChiffreAffaires {
  mode: "simple" | "detaille";
  /** Mode simple : CA HT prevu la 1re annee (question 3.1). */
  montantAnnee1?: FCFA;
  /** Mode detaille : liste produits/services (question 3.1). */
  produits?: ProduitDetaille[];
  /** Question 3.2 — taux de croissance annuel du CA (0.10 = 10 %). */
  tauxCroissance: Taux;
  /** Question 3.3 — activite saisonniere ? (defaut false). */
  saisonnier?: boolean;
  /**
   * Question 3.4 — repartition du CA sur 12 mois si saisonnier.
   * 12 poids dont la somme vaut idealement 1 (ou 100) ; le moteur normalise.
   * Si absent => repartition egale (1/12 par mois).
   */
  repartitionMensuelle?: number[];
}

/* ------------------------------------------------------------------ */
/* BLOC 4 — Charges d'exploitation                                     */
/* ------------------------------------------------------------------ */

export interface AchatsMatieres {
  /** "pourcentageCA" => `valeur` est une fraction (0.4 = 40 % du CA). */
  mode: "pourcentageCA" | "montant";
  /** Fraction du CA, ou montant annuel FCFA selon `mode`. Question 4.1. */
  valeur: number;
}

/**
 * Charges d'exploitation. Chaque champ porte son UNITE dans son nom
 * (Mensuel vs Annuel) ; la classification variable/fixe et l'annualisation
 * sont faites par engine/charges.ts.
 */
export interface ChargesExploitation {
  /** 4.1 — variable. */
  achatsMatieres: AchatsMatieres;
  /** 4.2 — fixe — loyer mensuel (defaut 0). */
  loyerMensuel?: FCFA;
  /** 4.3 — fixe — eau/electricite mensuel. */
  eauElectriciteMensuel?: FCFA;
  /** 4.4 — fixe — telecom/internet mensuel. */
  telecomMensuel?: FCFA;
  /** 4.5 — variable — transport/carburant, montant annuel. */
  transportCarburantAnnuel?: FCFA;
  /** 4.6 — fixe — assurances annuel. */
  assurancesAnnuel?: FCFA;
  /** 4.7 — fixe — honoraires (comptable, conseil) annuel. */
  honorairesAnnuel?: FCFA;
  /** 4.8 — fixe — marketing/publicite annuel. */
  marketingAnnuel?: FCFA;
  /** 4.9 — fixe — entretien/fournitures/divers annuel. */
  entretienDiversAnnuel?: FCFA;
  /** 4.10 — fixe — impots & taxes (patente, etc.) annuel. */
  impotsTaxesAnnuel?: FCFA;
}

/* ------------------------------------------------------------------ */
/* BLOC 5 — Personnel & masse salariale (boucle)                       */
/* ------------------------------------------------------------------ */

export interface PostePersonnel {
  /** 5.1. */
  intitule: string;
  /** 5.2 — nombre de personnes (defaut 1). */
  nombre?: number;
  /** 5.3 — salaire brut mensuel par personne. */
  salaireBrutMensuel: FCFA;
}

export interface SalaireDirigeant {
  /** 5.5 — montant brut mensuel que le dirigeant se verse. */
  montantMensuel: FCFA;
}

/* ------------------------------------------------------------------ */
/* BLOC 6 — Besoin en Fonds de Roulement (delais)                      */
/* ------------------------------------------------------------------ */

export interface DelaisBFR {
  /** 6.1 — delai de paiement clients en jours (defaut 0 = comptant). */
  delaiClientsJours?: number;
  /** 6.2 — delai de paiement fournisseurs en jours (defaut 30). */
  delaiFournisseursJours?: number;
  /** 6.3 — duree de stockage en jours (defaut 0). */
  delaiStockJours?: number;
}

/* ------------------------------------------------------------------ */
/* BLOC 7 — Parametres fiscaux (override optionnel de parametres.ts)   */
/* ------------------------------------------------------------------ */

/**
 * Override partiel des taux par defaut, pour ce dossier seulement.
 * Tout ce qui n'est pas fourni vient de src/config/parametres.ts.
 * Aucun taux n'est jamais code en dur dans les moteurs.
 */
export interface OverrideParametres {
  tauxTVA?: Taux;
  tauxIS?: Taux;
  tauxChargesSocialesPatronales?: Taux;
}

/* ------------------------------------------------------------------ */
/* DossierInput                                                        */
/* ------------------------------------------------------------------ */

export interface DossierInput {
  /** Bloc 0. */
  nomProjet: string;
  secteur: string;
  formeJuridique: FormeJuridique;
  moisDemarrage: MoisDemarrage;
  assujettiTVA: boolean;

  /** Bloc 1. */
  investissements: Investissement[];

  /** Bloc 2. */
  financement: Financement;

  /** Bloc 3. */
  chiffreAffaires: ChiffreAffaires;

  /** Bloc 4. */
  charges: ChargesExploitation;

  /** Bloc 5. */
  personnel: PostePersonnel[];
  salaireDirigeant?: SalaireDirigeant | null;

  /** Bloc 6. */
  delais: DelaisBFR;

  /** Bloc 7 — override optionnel des taux. */
  parametres?: OverrideParametres;
}
