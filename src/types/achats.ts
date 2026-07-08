/**
 * Types du module Achats (commandes d'achat, receptions, encours fournisseurs).
 *
 * Ces types decrivent l'ENTREE collectee par l'UI (des commandes d'achat) et la
 * SORTIE produite par le moteur (`src/engine/achats.ts`). Regle non negociable
 * (CLAUDE.md) : aucun total (HT, TVA deductible, TTC, reste a payer, valeur
 * recue) n'est calcule dans le navigateur ; tout vient du moteur deterministe et
 * teste, cote serveur.
 *
 * Argent : FCFA (XOF) entiers. Les taux sont des fractions (0.18 = 18 %). Les
 * quantites (commandee / recue) ne sont pas monetaires.
 */

import type { FCFA, Taux } from "./money.js";

/** Etat d'avancement d'une commande d'achat. */
export type StatutCommande =
  | "brouillon"
  | "envoyee"
  | "recue_partiel"
  | "recue"
  | "annulee";

/** Une ligne de commande d'achat (SAISIE). */
export interface LigneCommandeInput {
  designation: string;
  /** Quantite commandee. */
  quantite: number;
  /** Quantite deja receptionnee (defaut 0). */
  quantiteRecue?: number;
  /** Prix unitaire HT, en FCFA entiers. */
  prixUnitaireHT: FCFA;
  /** Taux de TVA deductible (fraction). Defaut : le taux fourni en option. */
  tauxTVA?: Taux;
  /** Remise de ligne (fraction). Defaut 0. */
  remisePct?: Taux;
}

/** Une commande d'achat (SAISIE). */
export interface CommandeAchatInput {
  /** Nom (ou reference) du fournisseur. */
  fournisseur: string;
  statut?: StatutCommande;
  /** Assujettie a la TVA (defaut true). Si false, TVA = 0 sur toutes les lignes. */
  assujettiTVA?: boolean;
  /** Montant deja regle au fournisseur (FCFA). Defaut 0. */
  montantPaye?: FCFA;
  lignes: LigneCommandeInput[];
}

/** Une ligne apres calcul (SNAPSHOT moteur). */
export interface LigneCommandeCalc {
  designation: string;
  quantite: number;
  quantiteRecue: number;
  prixUnitaireHT: FCFA;
  tauxTVA: Taux;
  montantHT: FCFA;
  /** TVA deductible (recuperable), arrondie. */
  montantTVA: FCFA;
  montantTTC: FCFA;
  /** Valeur HT deja receptionnee. */
  montantRecuHT: FCFA;
  /** Quantite restant a recevoir (>= 0). */
  resteARecevoir: number;
}

/** Une commande apres calcul (SNAPSHOT moteur). */
export interface CommandeAchatCalc {
  fournisseur: string;
  statut: StatutCommande;
  lignes: LigneCommandeCalc[];
  totalHT: FCFA;
  totalTVA: FCFA;
  totalTTC: FCFA;
  montantPaye: FCFA;
  /** Reste a payer = TTC − montant paye. */
  resteAPayer: FCFA;
  /** Valeur HT deja receptionnee. */
  valeurRecueHT: FCFA;
  /** Valeur HT commandee mais non encore receptionnee. */
  valeurARecevoirHT: FCFA;
  /** Taux de reception = Σ quantite recue / Σ quantite commandee (fraction). */
  tauxReception: Taux;
}

/** Resultat du calcul des achats (SNAPSHOT). */
export interface ResultatAchats {
  commandes: CommandeAchatCalc[];
  totalHT: FCFA;
  /** Total de la TVA deductible. */
  totalTVA: FCFA;
  totalTTC: FCFA;
  totalPaye: FCFA;
  /** Encours fournisseurs (dettes) = Σ reste a payer des commandes non annulees. */
  totalAPayer: FCFA;
  /** Valeur HT des marchandises commandees restant a recevoir. */
  totalARecevoirHT: FCFA;
}
