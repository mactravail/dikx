/**
 * Module TRESORERIE — contrat de donnees + reference de saisie.
 *
 * Persistance dans SUPABASE (tables 0007), sous RLS scopee par entreprise, via
 * les server actions de app/(app)/tresorerie/data-actions.ts. Le `store` ci-dessous
 * ne fait que deleguer a ces actions (methodes ASYNC, prenant l'id de l'entreprise
 * active).
 *
 * Regle raktak : aucun calcul monetaire ici. Les seuls montants manipules sont
 * des SAISIES (solde initial, montant d'un mouvement). Soldes courants et totaux
 * viennent du moteur (calculerTresorerie, cote serveur). Les listes ci-dessous
 * (types, operateurs, categories) sont des donnees de REFERENCE, pas des taux.
 */

import type {
  TypeCompteTresorerie,
  SensMouvement,
} from "./engine";
import type { EtatTransmission } from "./transmission";
import {
  listerComptesAction,
  listerMouvementsAction,
  upsertCompteAction,
  supprimerCompteAction,
  enregistrerMouvementAction,
  supprimerMouvementAction,
} from "@/app/(app)/tresorerie/data-actions";

/* --------------------------------- modeles --------------------------------- */

export interface CompteTresorerieLocal {
  id: string;
  nom: string;
  type: TypeCompteTresorerie;
  operateur?: string;
  soldeInitial: number;
}

export interface MouvementLocal {
  id: string;
  compteId: string;
  date: string; // AAAA-MM-JJ
  sens: SensMouvement;
  montant: number;
  categorie: string;
  /** « Pourquoi / a qui / pour quoi » — porte tel quel, non utilise au calcul. */
  motif: string;
  /** Etat de transmission au comptable (0013). Absent = brouillon. */
  transmission?: EtatTransmission;
}

/* ------------------------------- reference -------------------------------- */

export const TYPES_COMPTE: ReadonlyArray<[TypeCompteTresorerie, string]> = [
  ["banque", "Banque"],
  ["mobile_money", "Mobile money"],
  ["caisse", "Caisse (especes)"],
];

export function libelleTypeCompte(t: TypeCompteTresorerie): string {
  return TYPES_COMPTE.find(([v]) => v === t)?.[1] ?? t;
}

/**
 * Suggestions d'operateurs / etablissements (datalist de saisie). Mobile money
 * et transfert d'argent courants au Senegal + principales banques. Liste
 * indicative : le comptable peut saisir tout autre etablissement.
 */
export const OPERATEURS: readonly string[] = [
  // Mobile money & transfert d'argent
  "Wave",
  "Orange Money",
  "Free Money",
  "Wizall",
  "Wari",
  "Ria",
  "MoneyGram",
  "Western Union",
  // Banques
  "CBAO",
  "SGBS",
  "Ecobank",
  "Bank of Africa (BOA)",
  "UBA",
  "BICIS",
  "Orabank",
  "Banque Atlantique",
];

/** Categories de flux (« pourquoi » un mouvement). Code -> libelle. */
export const CATEGORIES_FLUX: ReadonlyArray<[string, string]> = [
  ["encaissement_client", "Encaissement client"],
  ["vente_comptant", "Vente au comptant"],
  ["apport", "Apport / financement"],
  ["emprunt", "Deblocage d'emprunt"],
  ["remboursement_recu", "Remboursement recu"],
  ["approvisionnement", "Achat / approvisionnement"],
  ["fournisseurs", "Reglement fournisseur"],
  ["salaires", "Salaires & paie"],
  ["loyer", "Loyer & charges"],
  ["impots", "Impots & taxes"],
  ["frais_bancaires", "Frais bancaires / mobile money"],
  ["transport", "Transport & logistique"],
  ["transfert", "Transfert entre comptes"],
  ["retrait", "Retrait especes"],
  ["depot", "Depot / versement"],
  ["remboursement_emprunt", "Remboursement d'emprunt"],
  ["autre", "Autre"],
];

export function libelleCategorieFlux(code: string): string {
  return CATEGORIES_FLUX.find(([v]) => v === code)?.[1] ?? code;
}

/* ----------------------------- identifiants ------------------------------ */

export function genId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/* -------------------------------- stockage -------------------------------- */
// Delegue a Supabase (server actions, RLS). Toutes les methodes sont ASYNC et
// prennent l'id de l'entreprise active (fourni par le contexte cote client).

export const store = {
  chargerComptes: (entrepriseId: string) => listerComptesAction(entrepriseId),
  chargerMouvements: (entrepriseId: string) => listerMouvementsAction(entrepriseId),
  /** Cree (id vide) ou met a jour un compte ; renvoie le compte persiste. */
  enregistrerCompte: (entrepriseId: string, c: CompteTresorerieLocal) =>
    upsertCompteAction(entrepriseId, c),
  supprimerCompte: (id: string) => supprimerCompteAction(id),
  /** Cree (id vide) ou met a jour un mouvement ; renvoie le mouvement persiste. */
  enregistrerMouvement: (entrepriseId: string, m: MouvementLocal) =>
    enregistrerMouvementAction(entrepriseId, m),
  supprimerMouvement: (id: string) => supprimerMouvementAction(id),
};
