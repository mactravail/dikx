/**
 * ENTREPRISE — l'entite cliente geree dans raktak.
 *
 * raktak est utilise par un comptable / cabinet comptable qui gere le
 * portefeuille de plusieurs entreprises (formelles ET informelles). Toutes les
 * donnees des modules (factures, ecritures, paie, stock, previsionnel) sont
 * SCOPEES par entreprise.
 *
 * Le "regime" d'une entreprise pilote le comportement du produit :
 *   - regimeComptable : profondeur de la comptabilite (SYSCOHADA normal vs
 *     comptabilite de tresorerie allegee).
 *   - regimeFiscal    : reel (TVA + IS) vs CGU (contribution globale unique,
 *     impot synthetique qui remplace TVA + IR/IS + CEL pour les petits
 *     contribuables).
 *
 * Type pur (aucune dependance UI/serveur) : reutilisable par le moteur et l'app.
 * Aucun taux ici — les taux/seuils vivent dans src/config/parametres.ts.
 */

/**
 * Regime comptable de l'entreprise (referentiel SYSCOHADA revise / OHADA).
 *  - "normal"       : Systeme Normal — comptabilite d'engagement complete
 *                     (journal, grand livre, balance, etats financiers).
 *  - "smt"          : Systeme Minimal de Tresorerie — TPE sous seuils :
 *                     comptabilite de tresorerie (recettes / depenses).
 *  - "entreprenant" : statut OHADA de l'Entreprenant — obligations minimales
 *                     (livre de recettes/depenses). Traite comme la tresorerie.
 */
export type RegimeComptable = "normal" | "smt" | "entreprenant";

/**
 * Regime fiscal.
 *  - "reel" : imposition au reel — facture la TVA (18 %) et releve de l'IS.
 *  - "cgu"  : Contribution Globale Unique — impot synthetique des petits
 *             contribuables. Ne facture PAS de TVA et ne releve pas de l'IS
 *             (la CGU s'y substitue). Typique du secteur informel.
 */
export type RegimeFiscal = "reel" | "cgu";

/** Forme juridique (aligne sur l'enum SQL forme_juridique de la migration 0001). */
export type FormeJuridique = "SARL" | "SUARL" | "SA" | "GIE" | "EI";

/**
 * Profil synthetique — raccourci de saisie a la creation.
 *  - "formel"   => Systeme Normal + reel (TVA + IS).
 *  - "informel" => SMT + CGU (tresorerie, pas de TVA).
 * L'utilisateur peut ensuite affiner chaque axe independamment.
 */
export type ProfilEntreprise = "formel" | "informel";

/**
 * Une entreprise cliente du cabinet.
 * Miroir applicatif de la table `entreprise` (migration 0006).
 * Ne contient AUCUN montant calcule (pas de total, pas de solde).
 */
export interface Entreprise {
  id: string;
  /** Proprietaire = le cabinet (compte utilisateur). Cote SQL : cabinet_id. */
  cabinetId?: string;

  raisonSociale: string;
  sigle?: string;
  /** Identifiant fiscal senegalais. */
  ninea?: string;
  /** Registre du Commerce et du Credit Mobilier. */
  rccm?: string;
  secteur?: string;
  formeJuridique: FormeJuridique;

  /* --- Coordonnees (en-tete des documents : factures, rapport financier) --- */
  /** Adresse / siege social (ex. "Sacre-Coeur 3, Dakar"). */
  adresse?: string;
  /** Ville (ex. "Dakar"). */
  ville?: string;
  /** Telephone de contact (ex. "+221 33 800 00 00"). */
  telephone?: string;
  /** Email de contact. */
  email?: string;
  /** Site web (optionnel). */
  siteWeb?: string;
  /** Nom du representant legal / gerant (signataire des documents). */
  representant?: string;
  /**
   * Capital social en FCFA entiers. C'est une SAISIE d'identite (montant statuaire
   * fixe), pas un total calcule — on peut donc le porter ici.
   */
  capitalSocial?: number;

  regimeComptable: RegimeComptable;
  regimeFiscal: RegimeFiscal;
  /** Assujettie a la TVA. Toujours false si regimeFiscal = "cgu". */
  assujettiTVA: boolean;

  /** Mois de debut d'exercice comptable (1..12). Defaut janvier. */
  exerciceDebutMois?: number;

  actif: boolean;
  /** Date de creation de la fiche (ISO AAAA-MM-JJ). */
  creeLe: string;
}

/**
 * Regime par defaut deduit d'un profil (raccourci de creation).
 * Pur et deterministe. Regle de coherence : CGU => jamais assujetti TVA.
 */
export function regimeParDefaut(profil: ProfilEntreprise): {
  regimeComptable: RegimeComptable;
  regimeFiscal: RegimeFiscal;
  assujettiTVA: boolean;
} {
  if (profil === "informel") {
    return { regimeComptable: "smt", regimeFiscal: "cgu", assujettiTVA: false };
  }
  return { regimeComptable: "normal", regimeFiscal: "reel", assujettiTVA: true };
}

/**
 * Coherence regime fiscal / TVA : sous la CGU, aucune TVA n'est facturee.
 * Renvoie une entreprise dont assujettiTVA est force a false si CGU.
 */
export function normaliserRegime<T extends Pick<Entreprise, "regimeFiscal" | "assujettiTVA">>(
  e: T,
): T {
  if (e.regimeFiscal === "cgu" && e.assujettiTVA) {
    return { ...e, assujettiTVA: false };
  }
  return e;
}

/** true si l'entreprise tient une comptabilite de tresorerie (SMT / Entreprenant). */
export function estComptabiliteTresorerie(regime: RegimeComptable): boolean {
  return regime === "smt" || regime === "entreprenant";
}

/* --------------------------- libelles d'affichage --------------------------- */

export const LIBELLE_REGIME_COMPTABLE: Record<RegimeComptable, string> = {
  normal: "Systeme Normal",
  smt: "Tresorerie (SMT)",
  entreprenant: "Entreprenant",
};

export const LIBELLE_REGIME_FISCAL: Record<RegimeFiscal, string> = {
  reel: "Reel (TVA + IS)",
  cgu: "CGU",
};

export const LIBELLE_FORME_JURIDIQUE: Record<FormeJuridique, string> = {
  SARL: "SARL",
  SUARL: "SUARL",
  SA: "SA",
  GIE: "GIE",
  EI: "Entreprise individuelle",
};
