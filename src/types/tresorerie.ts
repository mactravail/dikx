/**
 * Types du module TRESORERIE — comptes de disponibilites (banques, caisses,
 * mobile money) et mouvements d'encaissement / decaissement.
 *
 * Objectif metier : le comptable suit OU l'argent se trouve (Wave, Orange Money,
 * banque, caisse...), COMBIEN chaque compte contient, et POURQUOI l'argent est
 * entre ou sorti (categorie + motif de chaque mouvement).
 *
 * Regle non negociable (CLAUDE.md) : aucun solde ni total n'est calcule dans le
 * navigateur ; tout vient du moteur deterministe et teste (`src/engine/
 * tresorerie-comptes.ts`), cote serveur. Sommer des mouvements EST un calcul.
 *
 * Argent : FCFA (XOF) entiers. Un mouvement porte un montant POSITIF ; son sens
 * (entree / sortie) est explicite.
 */

import type { FCFA, Taux } from "./money.js";

/** Nature d'un compte de tresorerie. */
export type TypeCompteTresorerie = "banque" | "caisse" | "mobile_money";

/** Sens d'un mouvement de tresorerie. */
export type SensMouvement = "entree" | "sortie";

/**
 * Un compte de disponibilites : une banque, une caisse en especes, ou un compte
 * mobile money (Wave, Orange Money...). `operateur` precise l'etablissement.
 */
export interface CompteTresorerieInput {
  /** Identifiant stable du compte (porte par les mouvements). */
  id: string;
  nom: string;
  type: TypeCompteTresorerie;
  /** Etablissement / operateur (Wave, Orange Money, CBAO, Ria...). Optionnel. */
  operateur?: string;
  /** Solde de depart, en FCFA entiers (peut etre 0). */
  soldeInitial: FCFA;
}

/**
 * Un mouvement de tresorerie sur un compte. Le montant est TOUJOURS positif ;
 * `sens` indique s'il augmente (entree) ou diminue (sortie) le compte.
 * `categorie` repond au « pourquoi » (achat, salaire, transfert, retrait...).
 */
export interface MouvementTresorerieInput {
  /** Compte concerne (doit correspondre a un CompteTresorerieInput.id). */
  compteId: string;
  sens: SensMouvement;
  /** Montant du mouvement, FCFA entiers positifs. */
  montant: FCFA;
  /** Categorie de flux (code de reference porte par l'UI). */
  categorie: string;
}

/** Solde et cumuls d'un compte (SNAPSHOT moteur). */
export interface SoldeCompte {
  compteId: string;
  nom: string;
  type: TypeCompteTresorerie;
  operateur?: string;
  soldeInitial: FCFA;
  totalEntrees: FCFA;
  totalSorties: FCFA;
  /** soldeInitial + totalEntrees − totalSorties. */
  soldeCourant: FCFA;
  nbMouvements: number;
}

/** Repartition du disponible par nature de compte. */
export interface RepartitionType {
  type: TypeCompteTresorerie;
  soldeCourant: FCFA;
  /** Part du disponible total (fraction). */
  part: Taux;
}

/** Repartition des SORTIES par categorie (« qu'a-t-on depense »). */
export interface RepartitionFlux {
  categorie: string;
  total: FCFA;
  /** Part des sorties totales (fraction). */
  part: Taux;
}

/** Resultat de l'agregation de tresorerie (SNAPSHOT). */
export interface ResultatTresorerie {
  /** Un solde par compte, dans l'ordre d'entree des comptes. */
  comptes: SoldeCompte[];
  /** Σ des soldes initiaux. */
  totalSoldeInitial: FCFA;
  /** Σ de toutes les entrees. */
  totalEntrees: FCFA;
  /** Σ de toutes les sorties. */
  totalSorties: FCFA;
  /** totalEntrees − totalSorties (variation nette de tresorerie). */
  fluxNet: FCFA;
  /** Σ des soldes courants = tresorerie disponible. */
  totalDisponible: FCFA;
  /** Disponible ventile par nature de compte, part decroissante. */
  parType: RepartitionType[];
  /** Sorties ventilees par categorie, part decroissante. */
  sortiesParCategorie: RepartitionFlux[];
}
