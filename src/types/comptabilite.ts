/**
 * Types du module Comptabilite (SYSCOHADA revise) — journal, grand livre, balance.
 *
 * Ces types decrivent l'ENTREE collectee par l'UI (des ecritures en partie
 * double) et la SORTIE produite par le moteur (`src/engine/comptabilite.ts`).
 * Regle non negociable (CLAUDE.md) : aucun total (cumul debit/credit, solde d'un
 * compte) n'est calcule dans le navigateur ; tout vient du moteur deterministe
 * et teste, cote serveur. Sommer des mouvements EST un calcul.
 *
 * Argent : FCFA (XOF) entiers. Un compte = un numero SYSCOHADA (ex. "601").
 */

import type { FCFA, Taux } from "./money.js";

/** Un compte du plan comptable SYSCOHADA (donnee de reference). */
export interface CompteComptable {
  /** Numero SYSCOHADA, ex. "411" (clients), "601" (achats). */
  numero: string;
  libelle: string;
  /** Classe SYSCOHADA (1 a 8). */
  classe: number;
}

/**
 * Une ligne d'ecriture : un compte mouvemente au debit OU au credit.
 * Par convention l'un des deux montants est 0 (jamais debit et credit sur la
 * meme ligne dans la saisie usuelle).
 */
export interface LigneEcritureInput {
  compte: string;
  /** Libelle du compte (repris depuis le plan comptable par l'UI). */
  libelle?: string;
  debit: FCFA;
  credit: FCFA;
}

/** Une ecriture de journal (en partie double). */
export interface EcritureInput {
  /** Date comptable (AAAA-MM-JJ). Portee telle quelle, non utilisee au calcul. */
  date: string;
  /** Code journal (VT, AC, BQ, CA, OD…). */
  journal: string;
  libelle: string;
  lignes: LigneEcritureInput[];
}

/** Controle d'une ecriture (snapshot moteur). */
export interface EcritureCalc {
  totalDebit: FCFA;
  totalCredit: FCFA;
  /** true si Σ debits = Σ credits (ecriture equilibree). */
  equilibree: boolean;
}

/** Une ligne de la balance / du grand livre (cumul par compte). */
export interface LigneBalance {
  compte: string;
  libelle: string;
  totalDebit: FCFA;
  totalCredit: FCFA;
  /** Solde debiteur (= debit − credit s'il est positif, sinon 0). */
  soldeDebiteur: FCFA;
  /** Solde crediteur (= credit − debit s'il est positif, sinon 0). */
  soldeCrediteur: FCFA;
}

/** Resultat de l'agregation comptable (SNAPSHOT). */
export interface ResultatComptabilite {
  /** Controle par ecriture, dans l'ordre d'entree. */
  ecritures: EcritureCalc[];
  /** Balance des comptes, triee par numero croissant. */
  balance: LigneBalance[];
  /** Total des mouvements debit (Σ tous les debits). */
  totalDebit: FCFA;
  /** Total des mouvements credit (Σ tous les credits). */
  totalCredit: FCFA;
  /** Σ des soldes debiteurs de la balance. */
  totalSoldeDebiteur: FCFA;
  /** Σ des soldes crediteurs de la balance. */
  totalSoldeCrediteur: FCFA;
  /** true si totalDebit = totalCredit (partie double respectee globalement). */
  equilibre: boolean;
}

/* --------------------- Etats financiers (synthese) --------------------- */

/**
 * Un poste d'etat financier : un compte agrege, avec son montant NET dans le
 * sens naturel du poste (positif = sens attendu, ex. une charge positive, un
 * produit positif, un actif positif). Produit par le moteur, jamais par l'UI.
 */
export interface PosteEtat {
  compte: string;
  libelle: string;
  /** Classe SYSCOHADA deduite du numero (1 a 8). */
  classe: number;
  /** Montant net du poste, en FCFA entiers (peut etre negatif : ex. amortissement). */
  montant: FCFA;
}

/**
 * COMPTE DE RESULTAT (« compte economique ») : produits (classe 7) − charges
 * (classe 6/8) = resultat net de l'exercice. Derive de la balance par le moteur.
 */
export interface CompteResultat {
  /** Postes de produits (classe 7 et assimiles), tries montant decroissant. */
  produits: PosteEtat[];
  /** Postes de charges (classe 6 et assimiles), tries montant decroissant. */
  charges: PosteEtat[];
  totalProduits: FCFA;
  totalCharges: FCFA;
  /** Resultat net = produits − charges (positif = benefice). */
  resultatNet: FCFA;
  /** Marge nette = resultatNet / totalProduits (fraction ; 0 si aucun produit). */
  margeNette: Taux;
  /** true si resultatNet >= 0. */
  beneficiaire: boolean;
}

/**
 * BILAN : emplois (ACTIF) = ressources (PASSIF). Le resultat net de l'exercice
 * figure au passif (benefice) ou en diminution (perte). Derive de la balance.
 */
export interface Bilan {
  /** Postes d'actif (immobilisations, stocks, creances, tresorerie). */
  actif: PosteEtat[];
  /** Postes de passif HORS resultat (capitaux durables, dettes, decouverts). */
  passif: PosteEtat[];
  totalActif: FCFA;
  /** Σ passif hors resultat de l'exercice. */
  totalPassifHorsResultat: FCFA;
  /** Resultat net de l'exercice (repris du compte de resultat). */
  resultatNet: FCFA;
  /** totalPassifHorsResultat + resultatNet. */
  totalPassif: FCFA;
  /** true si totalActif = totalPassif (garanti si la balance est equilibree). */
  equilibre: boolean;
  /** totalActif − totalPassif (0 si equilibre). */
  ecart: FCFA;
}

/** Synthese des etats financiers derives de la balance (SNAPSHOT moteur). */
export interface EtatsFinanciers {
  compteResultat: CompteResultat;
  bilan: Bilan;
}
