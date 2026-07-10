/**
 * Contrat de donnees du module Ventes (clients, documents, opportunites).
 *
 * Persiste dans SUPABASE (clients/documents 0002, opportunites 0014), sous RLS
 * scopee par entreprise, via les server actions des modules clients/facturation/crm.
 * Le `store` ci-dessous ne fait que deleguer a ces actions (methodes ASYNC).
 *
 * Regle raktak respectee : les seuls montants stockes ici sont des SNAPSHOTS
 * renvoyes par le moteur (server action), jamais des totaux calcules par l'UI.
 * Ce fichier ne contient donc AUCUN calcul monetaire — que du stockage.
 */

import type { EtatTransmission } from "./transmission";
import {
  listerClientsAction,
  upsertClientAction,
  supprimerClientAction,
} from "@/app/(app)/clients/data-actions";
import {
  listerDocumentsAction,
  upsertDocumentAction,
  supprimerDocumentAction,
} from "@/app/(app)/facturation/data-actions";
import {
  listerOpportunitesAction,
  upsertOpportuniteAction,
  supprimerOpportuniteAction,
} from "@/app/(app)/crm/data-actions";

export interface ClientLocal {
  id: string;
  raisonSociale: string;
  ninea?: string;
  contactNom?: string;
  telephone?: string;
  email?: string;
  ville?: string;
  delaiPaiementJours: number;
  actif: boolean;
}

export type StatutDocument =
  | "brouillon"
  | "emis"
  | "partiellement_paye"
  | "paye"
  | "annule";

export interface LigneLocal {
  designation: string;
  quantite: number;
  prixUnitaireHT: number;
  tauxTVA: number; // fraction
  remisePct: number; // fraction
}

export interface DocumentLocal {
  id: string;
  type: "devis" | "facture" | "avoir";
  numero: string;
  clientId: string | null;
  clientNom: string;
  dateEmission: string; // AAAA-MM-JJ
  statut: StatutDocument;
  assujettiTVA: boolean;
  remiseGlobalePct: number; // fraction
  lignes: LigneLocal[];
  montantPaye: number;
  // Snapshot du moteur (source: server action) — jamais recalcule dans l'UI.
  totalHT: number;
  totalTVA: number;
  totalTTC: number;
  /** Etat de transmission au comptable (0013). Absent = brouillon. */
  transmission?: EtatTransmission;
}

export interface OpportuniteLocal {
  id: string;
  titre: string;
  clientNom: string;
  etape: string;
  montant: number;
  probabilite: number; // fraction
}

/** Etapes du pipeline CRM (colonnes kanban), dans l'ordre. */
export const ETAPES_PIPELINE = [
  "Prospection",
  "Qualification",
  "Proposition",
  "Negociation",
  "Gagne",
  "Perdu",
] as const;

/** Probabilite indicative par etape (fraction) — modifiable par l'utilisateur. */
export const PROBA_PAR_ETAPE: Record<string, number> = {
  Prospection: 0.1,
  Qualification: 0.3,
  Proposition: 0.5,
  Negociation: 0.7,
  Gagne: 1,
  Perdu: 0,
};

/* ----------------------------- identifiants ----------------------------- */

export function genId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Numero de document : PREFIXE-ANNEE-000N (sequence par type et par annee). */
export function prochainNumero(
  type: DocumentLocal["type"],
  existants: DocumentLocal[],
): string {
  const prefixe = type === "devis" ? "DEV" : type === "avoir" ? "AV" : "FAC";
  const annee = new Date().getFullYear();
  const debut = `${prefixe}-${annee}-`;
  const seq =
    existants
      .filter((d) => d.numero.startsWith(debut))
      .map((d) => Number(d.numero.slice(debut.length)))
      .filter((n) => Number.isFinite(n))
      .reduce((max, n) => Math.max(max, n), 0) + 1;
  return `${debut}${String(seq).padStart(4, "0")}`;
}

/* ------------------------------- stockage ------------------------------- */
// Tout est persiste dans Supabase (RLS, scope par entreprise) via les data-actions.
// Toutes les methodes sont ASYNC et prennent l'id de l'entreprise active.

export const store = {
  // Clients & documents : Supabase (RLS), methodes ASYNC scopees par entreprise.
  chargerClients: (entrepriseId: string) => listerClientsAction(entrepriseId),
  enregistrerClient: (entrepriseId: string, c: ClientLocal) => upsertClientAction(entrepriseId, c),
  supprimerClient: (id: string) => supprimerClientAction(id),
  chargerDocuments: (entrepriseId: string) => listerDocumentsAction(entrepriseId),
  /** Cree (id vide) ou met a jour un document ; renvoie le snapshot persiste. */
  enregistrerDocument: (entrepriseId: string, d: DocumentLocal) => upsertDocumentAction(entrepriseId, d),
  supprimerDocument: (id: string) => supprimerDocumentAction(id),
  // Opportunites (CRM) : Supabase (RLS), methodes ASYNC scopees par entreprise.
  chargerOpportunites: (entrepriseId: string) => listerOpportunitesAction(entrepriseId),
  /** Cree (id vide) ou met a jour une opportunite ; renvoie l'opportunite persistee. */
  enregistrerOpportunite: (entrepriseId: string, o: OpportuniteLocal) => upsertOpportuniteAction(entrepriseId, o),
  supprimerOpportunite: (id: string) => supprimerOpportuniteAction(id),
};
