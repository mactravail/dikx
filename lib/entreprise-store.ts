/**
 * PORTEFEUILLE — la liste des entreprises clientes gerees par le cabinet.
 *
 * Persiste dans le localStorage du navigateur en attendant le branchement
 * Supabase (table `entreprise`, migration 0006, scope par cabinet_id + RLS).
 * Contrairement aux stores de modules, cette liste est au NIVEAU CABINET : elle
 * n'est pas scopee par entreprise (c'est justement l'annuaire des entreprises).
 *
 * Aucun montant ici — que de l'identite / du parametrage d'entreprise.
 */

import type { Entreprise, FormeJuridique, ProfilEntreprise } from "./engine";
import { regimeParDefaut, normaliserRegime } from "./engine";
import {
  getActiveEntrepriseId,
  setActiveEntrepriseId,
} from "./entreprise-active";

const CLE_LISTE = "raktak.cabinet.entreprises";

/* ----------------------------- identifiants ----------------------------- */

export function genId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `ent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/* ------------------------------- stockage ------------------------------- */

function load(): Entreprise[] {
  if (typeof window === "undefined") return SEED_ENTREPRISES;
  try {
    const brut = window.localStorage.getItem(CLE_LISTE);
    if (!brut) {
      // Premier acces : on amorce avec les entreprises de demonstration.
      window.localStorage.setItem(CLE_LISTE, JSON.stringify(SEED_ENTREPRISES));
      return SEED_ENTREPRISES;
    }
    const val = JSON.parse(brut);
    return Array.isArray(val) ? (val as Entreprise[]) : SEED_ENTREPRISES;
  } catch {
    return SEED_ENTREPRISES;
  }
}

function save(liste: Entreprise[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CLE_LISTE, JSON.stringify(liste));
  } catch {
    /* quota / mode prive : on ignore */
  }
}

/* ------------------------- creation / mise a jour ------------------------ */

export interface EntrepriseBrouillon {
  raisonSociale: string;
  profil: ProfilEntreprise;
  formeJuridique: FormeJuridique;
  ninea?: string;
  rccm?: string;
  secteur?: string;
  sigle?: string;
  // Coordonnees (en-tete des documents : factures, rapport financier).
  adresse?: string;
  ville?: string;
  telephone?: string;
  email?: string;
  representant?: string;
  capitalSocial?: number;
}

/** Construit une entreprise coherente a partir d'un brouillon de formulaire. */
export function depuisBrouillon(b: EntrepriseBrouillon): Entreprise {
  const regime = regimeParDefaut(b.profil);
  return normaliserRegime({
    id: genId(),
    raisonSociale: b.raisonSociale.trim(),
    sigle: b.sigle?.trim() || undefined,
    ninea: b.ninea?.trim() || undefined,
    rccm: b.rccm?.trim() || undefined,
    secteur: b.secteur?.trim() || undefined,
    formeJuridique: b.formeJuridique,
    adresse: b.adresse?.trim() || undefined,
    ville: b.ville?.trim() || undefined,
    telephone: b.telephone?.trim() || undefined,
    email: b.email?.trim() || undefined,
    representant: b.representant?.trim() || undefined,
    capitalSocial: b.capitalSocial && b.capitalSocial > 0 ? b.capitalSocial : undefined,
    regimeComptable: regime.regimeComptable,
    regimeFiscal: regime.regimeFiscal,
    assujettiTVA: regime.assujettiTVA,
    exerciceDebutMois: 1,
    actif: true,
    creeLe: new Date().toISOString().slice(0, 10),
  });
}

export const portefeuille = {
  liste: (): Entreprise[] => load(),

  parId: (id: string): Entreprise | undefined =>
    load().find((e) => e.id === id),

  creer: (b: EntrepriseBrouillon): Entreprise => {
    const e = depuisBrouillon(b);
    save([...load(), e]);
    return e;
  },

  modifier: (id: string, patch: Partial<Entreprise>): Entreprise[] => {
    const liste = load().map((e) =>
      e.id === id ? normaliserRegime({ ...e, ...patch, id: e.id }) : e,
    );
    save(liste);
    return liste;
  },

  supprimer: (id: string): Entreprise[] => {
    const liste = load().filter((e) => e.id !== id);
    save(liste);
    if (getActiveEntrepriseId() === id) setActiveEntrepriseId(null);
    return liste;
  },

  // Entreprise active (re-exporte le primitif scoping)
  getActiveId: getActiveEntrepriseId,
  setActiveId: setActiveEntrepriseId,
  active: (): Entreprise | null => {
    const id = getActiveEntrepriseId();
    if (!id) return null;
    return load().find((e) => e.id === id) ?? null;
  },
};

/* --------------------------- donnees de demo ---------------------------- */
// Portefeuille type d'un cabinet : une PME formelle + un commerce informel.

const SEED_ENTREPRISES: Entreprise[] = [
  {
    id: "ent-demo-formelle",
    raisonSociale: "Sourou Distribution SARL",
    ninea: "0041882 1B1",
    rccm: "SN-DKR-2019-B-12345",
    secteur: "Distribution",
    formeJuridique: "SARL",
    adresse: "Sacre-Coeur 3, Villa 8421",
    ville: "Dakar",
    telephone: "+221 33 825 40 12",
    email: "contact@sourou-distribution.sn",
    representant: "Aminata Sourou",
    capitalSocial: 5_000_000,
    regimeComptable: "normal",
    regimeFiscal: "reel",
    assujettiTVA: true,
    exerciceDebutMois: 1,
    actif: true,
    creeLe: "2024-01-15",
  },
  {
    id: "ent-demo-informelle",
    raisonSociale: "Boutique Keur Fallou",
    secteur: "Commerce de detail",
    formeJuridique: "EI",
    adresse: "Marche Castors, Stand 112",
    ville: "Dakar",
    telephone: "+221 77 640 18 90",
    email: "keurfallou@gmail.com",
    representant: "Fallou Ndiaye",
    regimeComptable: "smt",
    regimeFiscal: "cgu",
    assujettiTVA: false,
    exerciceDebutMois: 1,
    actif: true,
    creeLe: "2024-03-02",
  },
];
