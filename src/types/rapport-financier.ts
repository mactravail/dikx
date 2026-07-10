/**
 * Types du module RAPPORT FINANCIER — synthese de l'exercice pour le comptable.
 *
 * Le rapport financier ne COLLECTE aucune donnee nouvelle : il agrege ce que les
 * autres modules ont deja produit (compte de resultat + bilan issus de la
 * comptabilite, disponible issu de la tresorerie) et en DERIVE les indicateurs
 * de pilotage (marge, fonds de roulement, BFR, tresorerie nette, ratios).
 *
 * Regle non negociable (CLAUDE.md) : classer et sommer des soldes EST un calcul.
 * Tous les montants et ratios ci-dessous sont produits par le moteur
 * `src/engine/rapport-financier.ts`, pur et teste — jamais par l'UI. Le frontend
 * n'ajoute que le NARRATIF redige par le comptable (faits marquants, analyse,
 * perspectives), qui n'est pas un chiffre.
 *
 * Argent : FCFA (XOF) entiers. Les ratios sont des fractions (0.2 = 20 %) ; les
 * delais sont en jours entiers.
 */

import type { FCFA, Taux } from "./money.js";
import type { CompteResultat, Bilan, LigneBalance } from "./comptabilite.js";

/**
 * Valeurs de reference d'un exercice (N-1) ou d'un budget, SAISIES a la main par
 * le comptable tant que l'historique multi-exercice n'est pas en base. Toutes
 * optionnelles : une comparaison n'est produite que pour les champs renseignes.
 */
export interface ComparatifRapport {
  /** Chiffre d'affaires (comptes 70). */
  chiffreAffaires?: FCFA;
  /** Total des produits d'exploitation et assimiles (classe 7). */
  totalProduits?: FCFA;
  /** Total des charges (classe 6). */
  totalCharges?: FCFA;
  /** Resultat net de l'exercice. */
  resultatNet?: FCFA;
}

/** Entree du moteur : les etats de l'exercice + les references de comparaison. */
export interface RapportFinancierInput {
  /** Compte de resultat de l'exercice (moteur etats-financiers). */
  compteResultat: CompteResultat;
  /** Bilan de l'exercice (moteur etats-financiers). */
  bilan: Bilan;
  /** Balance des comptes (moteur comptabilite) — sert au CA et aux delais. */
  balance: LigneBalance[];
  /** Disponible reel issu du moteur tresorerie (optionnel, informatif). */
  tresorerieDisponible?: FCFA;
  /** Exercice precedent (N-1) saisi a la main. */
  exercicePrecedent?: ComparatifRapport;
  /** Budget de l'exercice saisi a la main. */
  budget?: ComparatifRapport;
}

/**
 * Variation d'un montant par rapport a une base (N-1 ou budget).
 * `ecartPct` est null quand la base est nulle (division impossible).
 */
export interface Variation {
  base: FCFA;
  /** valeur − base (FCFA entiers ; positif = hausse). */
  ecart: FCFA;
  /** (valeur − base) / |base| ; null si base = 0. */
  ecartPct: Taux | null;
}

/**
 * Synthese chiffree de l'exercice (« faits marquants » de l'exemple).
 * Tous les montants sont en FCFA entiers, derives des etats financiers.
 */
export interface SyntheseRapport {
  /** Chiffre d'affaires = Σ produits des comptes 70. */
  chiffreAffaires: FCFA;
  /** Total des produits (classe 7 et assimiles). */
  totalProduits: FCFA;
  /** Total des charges (classe 6 et assimiles). */
  totalCharges: FCFA;
  /** Resultat net = produits − charges. */
  resultatNet: FCFA;
  /** true si resultatNet >= 0. */
  beneficiaire: boolean;
  /** Taux de marge nette = resultatNet / chiffre d'affaires (0 si CA = 0). */
  margeNette: Taux;
  /** Marge nette de l'exercice precedent, si N-1 (CA + resultat) est saisi. */
  margeNettePrecedent: Taux | null;

  /* --- structure de bilan --- */
  /** Capitaux propres = capital, reserves, report (comptes 10-15) + resultat. */
  capitauxPropres: FCFA;
  /** Dettes financieres (comptes 16-19). */
  dettesFinancieres: FCFA;
  /** Ressources stables = capitaux propres + dettes financieres. */
  ressourcesStables: FCFA;
  /** Actif immobilise net (classe 2). */
  actifImmobilise: FCFA;
  /** Actif circulant = stocks (classe 3) + creances (classe 4 debitrices). */
  actifCirculant: FCFA;
  /** Dettes circulantes = passif classe 4 (fournisseurs, fiscal, social...). */
  dettesCirculantes: FCFA;
  /** Tresorerie d'actif (classe 5 debitrice : banques, caisses positives). */
  tresorerieActif: FCFA;
  /** Tresorerie de passif (classe 5 creditrice : decouverts). */
  tresoreriePassif: FCFA;

  /** Fonds de roulement = ressources stables − actif immobilise. */
  fondsDeRoulement: FCFA;
  /** Besoin en fonds de roulement = actif circulant − dettes circulantes. */
  bfr: FCFA;
  /** Tresorerie nette = FDR − BFR = tresorerie d'actif − tresorerie de passif. */
  tresorerieNette: FCFA;
  /** Disponible reel constate en tresorerie (moteur tresorerie), si fourni. */
  tresorerieDisponible: FCFA | null;

  totalActif: FCFA;
  totalPassif: FCFA;
}

/**
 * Ratios de pilotage (fractions ; delais en jours entiers). null quand le
 * denominateur est nul (ratio non defini).
 */
export interface RatiosRapport {
  /** Marge nette = resultat / CA. */
  margeNette: Taux;
  /** Autonomie financiere = capitaux propres / total passif. */
  autonomieFinanciere: Taux | null;
  /** Taux d'endettement = dettes financieres / capitaux propres. */
  tauxEndettement: Taux | null;
  /** Liquidite generale = actif circulant + tresorerie / passif circulant. */
  liquiditeGenerale: Taux | null;
  /** Delai moyen de reglement clients (DSO), en jours = creances / CA × 360. */
  delaiClients: number | null;
  /** Delai moyen de reglement fournisseurs (DPO), en jours = dettes / achats × 360. */
  delaiFournisseurs: number | null;
}

/** Une ligne du tableau « resultats d'exploitation » comparee a N-1 et au budget. */
export interface LigneComparee {
  cle: string;
  libelle: string;
  valeur: FCFA;
  /** Variation vs exercice precedent (si base fournie). */
  n1?: Variation;
  /** Ecart vs budget (si base fournie). */
  budget?: Variation;
}

/** Rapport financier complet (SNAPSHOT moteur). */
export interface RapportFinancier {
  synthese: SyntheseRapport;
  ratios: RatiosRapport;
  /** Tableau des grandeurs d'exploitation comparees (CA, produits, charges, resultat). */
  exploitation: LigneComparee[];
  /** true si le bilan sous-jacent est equilibre (garde-fou de coherence). */
  bilanEquilibre: boolean;
}
