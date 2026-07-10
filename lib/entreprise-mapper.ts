/**
 * Correspondance entre la ligne SQL `entreprise` (snake_case, migration 0006 +
 * coordonnees 0008) et le type applicatif `Entreprise` (camelCase). Pur, sans
 * dependance serveur : importable partout.
 */
import type {
  Entreprise,
  FormeJuridique,
  RegimeComptable,
  RegimeFiscal,
} from "./engine";
import { regimeParDefaut } from "./engine";
import type { EntrepriseBrouillon } from "./entreprise-store";

export interface EntrepriseRow {
  id: string;
  cabinet_id: string;
  raison_sociale: string;
  sigle: string | null;
  ninea: string | null;
  rccm: string | null;
  secteur: string | null;
  forme_juridique: FormeJuridique;
  adresse: string | null;
  ville: string | null;
  telephone: string | null;
  email: string | null;
  site_web: string | null;
  representant: string | null;
  capital_social: number | null;
  regime_comptable: RegimeComptable;
  regime_fiscal: RegimeFiscal;
  assujetti_tva: boolean;
  exercice_debut_mois: number | null;
  actif: boolean;
  created_at: string;
}

/** Colonnes selectionnees (ordre stable, reutilise par les requetes). */
export const COLONNES_ENTREPRISE =
  "id,cabinet_id,raison_sociale,sigle,ninea,rccm,secteur,forme_juridique,adresse,ville,telephone,email,site_web,representant,capital_social,regime_comptable,regime_fiscal,assujetti_tva,exercice_debut_mois,actif,created_at";

export function rowVersEntreprise(r: EntrepriseRow): Entreprise {
  return {
    id: r.id,
    cabinetId: r.cabinet_id,
    raisonSociale: r.raison_sociale,
    sigle: r.sigle ?? undefined,
    ninea: r.ninea ?? undefined,
    rccm: r.rccm ?? undefined,
    secteur: r.secteur ?? undefined,
    formeJuridique: r.forme_juridique,
    adresse: r.adresse ?? undefined,
    ville: r.ville ?? undefined,
    telephone: r.telephone ?? undefined,
    email: r.email ?? undefined,
    siteWeb: r.site_web ?? undefined,
    representant: r.representant ?? undefined,
    capitalSocial: r.capital_social ?? undefined,
    regimeComptable: r.regime_comptable,
    regimeFiscal: r.regime_fiscal,
    assujettiTVA: r.assujetti_tva,
    exerciceDebutMois: r.exercice_debut_mois ?? 1,
    actif: r.actif,
    creeLe: (r.created_at ?? "").slice(0, 10),
  };
}

function nettoyer(v?: string): string | null {
  const t = v?.trim();
  return t ? t : null;
}

/** Payload d'insert a partir d'un brouillon de formulaire (regime deduit du profil). */
export function brouillonVersInsert(b: EntrepriseBrouillon, cabinetId: string) {
  const regime = regimeParDefaut(b.profil);
  return {
    cabinet_id: cabinetId,
    raison_sociale: b.raisonSociale.trim(),
    sigle: nettoyer(b.sigle),
    ninea: nettoyer(b.ninea),
    rccm: nettoyer(b.rccm),
    secteur: nettoyer(b.secteur),
    forme_juridique: b.formeJuridique,
    adresse: nettoyer(b.adresse),
    ville: nettoyer(b.ville),
    telephone: nettoyer(b.telephone),
    email: nettoyer(b.email),
    representant: nettoyer(b.representant),
    capital_social: b.capitalSocial && b.capitalSocial > 0 ? Math.round(b.capitalSocial) : null,
    regime_comptable: regime.regimeComptable,
    regime_fiscal: regime.regimeFiscal,
    assujetti_tva: regime.assujettiTVA,
    exercice_debut_mois: 1,
    actif: true,
  };
}

/** Colonnes a mettre a jour a partir d'un patch camelCase (cle absente = inchangee). */
export function patchVersUpdate(patch: Partial<Entreprise>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (patch.raisonSociale !== undefined) row.raison_sociale = patch.raisonSociale.trim();
  if (patch.sigle !== undefined) row.sigle = nettoyer(patch.sigle);
  if (patch.ninea !== undefined) row.ninea = nettoyer(patch.ninea);
  if (patch.rccm !== undefined) row.rccm = nettoyer(patch.rccm);
  if (patch.secteur !== undefined) row.secteur = nettoyer(patch.secteur);
  if (patch.formeJuridique !== undefined) row.forme_juridique = patch.formeJuridique;
  if (patch.adresse !== undefined) row.adresse = nettoyer(patch.adresse);
  if (patch.ville !== undefined) row.ville = nettoyer(patch.ville);
  if (patch.telephone !== undefined) row.telephone = nettoyer(patch.telephone);
  if (patch.email !== undefined) row.email = nettoyer(patch.email);
  if (patch.siteWeb !== undefined) row.site_web = nettoyer(patch.siteWeb);
  if (patch.representant !== undefined) row.representant = nettoyer(patch.representant);
  if (patch.capitalSocial !== undefined) {
    row.capital_social = patch.capitalSocial && patch.capitalSocial > 0 ? Math.round(patch.capitalSocial) : null;
  }
  if (patch.regimeComptable !== undefined) row.regime_comptable = patch.regimeComptable;
  if (patch.regimeFiscal !== undefined) {
    row.regime_fiscal = patch.regimeFiscal;
    // Coherence : sous la CGU, jamais de TVA facturee.
    if (patch.regimeFiscal === "cgu") row.assujetti_tva = false;
  }
  if (patch.assujettiTVA !== undefined && row.assujetti_tva === undefined) {
    row.assujetti_tva = patch.assujettiTVA;
  }
  if (patch.exerciceDebutMois !== undefined) row.exercice_debut_mois = patch.exerciceDebutMois;
  if (patch.actif !== undefined) row.actif = patch.actif;
  return row;
}
