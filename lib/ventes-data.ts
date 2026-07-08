/**
 * Etat de travail LOCAL du module Ventes (clients, documents, opportunites).
 *
 * Persiste dans le `localStorage` du navigateur en attendant le branchement
 * Supabase (la table `clients`/`documents` existe deja : db/migrations/0002).
 *
 * Regle raktak respectee : les seuls montants stockes ici sont des SNAPSHOTS
 * renvoyes par le moteur (server action), jamais des totaux calcules par l'UI.
 * Ce fichier ne contient donc AUCUN calcul monetaire — que du stockage.
 */

import { scopedKey } from "./entreprise-active";

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

// Cles SCOPEES par entreprise active (voir lib/entreprise-active.ts) : les
// donnees d'un client ne se melangent jamais avec celles d'un autre.
const SUFFIXES = {
  clients: "ventes.clients",
  documents: "ventes.documents",
  opportunites: "ventes.opportunites",
} as const;

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

function load<T>(key: string, seed: T[]): T[] {
  if (typeof window === "undefined") return seed;
  try {
    const brut = window.localStorage.getItem(key);
    if (!brut) return seed;
    const val = JSON.parse(brut);
    return Array.isArray(val) ? (val as T[]) : seed;
  } catch {
    return seed;
  }
}

function save<T>(key: string, value: T[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / mode prive : on ignore, l'etat reste en memoire */
  }
}

export const store = {
  chargerClients: () => load<ClientLocal>(scopedKey(SUFFIXES.clients), SEED_CLIENTS),
  sauverClients: (v: ClientLocal[]) => save(scopedKey(SUFFIXES.clients), v),
  chargerDocuments: () => load<DocumentLocal>(scopedKey(SUFFIXES.documents), SEED_DOCUMENTS),
  sauverDocuments: (v: DocumentLocal[]) => save(scopedKey(SUFFIXES.documents), v),
  chargerOpportunites: () => load<OpportuniteLocal>(scopedKey(SUFFIXES.opportunites), SEED_OPPS),
  sauverOpportunites: (v: OpportuniteLocal[]) => save(scopedKey(SUFFIXES.opportunites), v),
};

/* --------------------------- donnees de demo ---------------------------- */
// Contexte PME senegalaise. Les montants des documents sont indicatifs ;
// ils seront remplaces par le snapshot du moteur des la 1re modification.

const SEED_CLIENTS: ClientLocal[] = [
  {
    id: "cli-demo-1",
    raisonSociale: "Boulangerie La Teranga",
    ninea: "0057219 2A2",
    contactNom: "Aminata Diop",
    telephone: "+221 77 123 45 67",
    email: "contact@lateranga.sn",
    ville: "Dakar",
    delaiPaiementJours: 30,
    actif: true,
  },
  {
    id: "cli-demo-2",
    raisonSociale: "Sourou Distribution SARL",
    ninea: "0041882 1B1",
    contactNom: "Modou Faye",
    telephone: "+221 76 987 65 43",
    email: "achats@sourou.sn",
    ville: "Thies",
    delaiPaiementJours: 45,
    actif: true,
  },
  {
    id: "cli-demo-3",
    raisonSociale: "Clinique du Point E",
    ninea: "0033471 9C3",
    contactNom: "Dr. Ndeye Sarr",
    telephone: "+221 78 456 78 90",
    email: "compta@cliniquepointe.sn",
    ville: "Dakar",
    delaiPaiementJours: 15,
    actif: true,
  },
];

const SEED_DOCUMENTS: DocumentLocal[] = [
  {
    id: "doc-demo-1",
    type: "facture",
    numero: `FAC-${new Date().getFullYear()}-0001`,
    clientId: "cli-demo-1",
    clientNom: "Boulangerie La Teranga",
    dateEmission: new Date().toISOString().slice(0, 10),
    statut: "emis",
    assujettiTVA: true,
    remiseGlobalePct: 0,
    lignes: [
      { designation: "Sacs de farine T55 (50 kg)", quantite: 40, prixUnitaireHT: 22_000, tauxTVA: 0.18, remisePct: 0 },
      { designation: "Livraison", quantite: 1, prixUnitaireHT: 25_000, tauxTVA: 0.18, remisePct: 0 },
    ],
    montantPaye: 0,
    totalHT: 905_000,
    totalTVA: 162_900,
    totalTTC: 1_067_900,
  },
  {
    id: "doc-demo-2",
    type: "devis",
    numero: `DEV-${new Date().getFullYear()}-0001`,
    clientId: "cli-demo-2",
    clientNom: "Sourou Distribution SARL",
    dateEmission: new Date().toISOString().slice(0, 10),
    statut: "brouillon",
    assujettiTVA: true,
    remiseGlobalePct: 0.05,
    lignes: [
      { designation: "Prestation de conseil (jours)", quantite: 8, prixUnitaireHT: 150_000, tauxTVA: 0.18, remisePct: 0 },
    ],
    montantPaye: 0,
    totalHT: 1_140_000,
    totalTVA: 205_200,
    totalTTC: 1_345_200,
  },
];

const SEED_OPPS: OpportuniteLocal[] = [
  { id: "opp-demo-1", titre: "Contrat annuel farine", clientNom: "Boulangerie La Teranga", etape: "Negociation", montant: 12_000_000, probabilite: 0.7 },
  { id: "opp-demo-2", titre: "Equipement froid", clientNom: "Sourou Distribution SARL", etape: "Proposition", montant: 4_500_000, probabilite: 0.5 },
  { id: "opp-demo-3", titre: "Maintenance groupe electrogene", clientNom: "Clinique du Point E", etape: "Qualification", montant: 2_000_000, probabilite: 0.3 },
  { id: "opp-demo-4", titre: "Fourniture consommables", clientNom: "Clinique du Point E", etape: "Prospection", montant: 800_000, probabilite: 0.1 },
];
