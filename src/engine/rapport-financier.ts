/**
 * Moteur RAPPORT FINANCIER (SYSCOHADA revise) — pur et deterministe.
 *
 * Il AGREGE les etats deja produits par les autres moteurs (compte de resultat +
 * bilan de `etats-financiers`, balance de `comptabilite`) et en DERIVE les
 * indicateurs de pilotage d'un rapport d'exercice :
 *  - synthese : CA, produits, charges, resultat net, marge nette ;
 *  - structure financiere : fonds de roulement (FDR), besoin en fonds de
 *    roulement (BFR), tresorerie nette, capitaux propres, dettes ;
 *  - ratios : autonomie financiere, endettement, liquidite generale, delais
 *    clients (DSO) et fournisseurs (DPO) ;
 *  - comparaisons vs exercice precedent (N-1) et vs budget (bases saisies).
 *
 * C'est le SEUL endroit ou ces indicateurs sont produits ; ni l'UI ni l'IA ne
 * somment ou ne divisent un montant (regle CLAUDE.md). Classer, sommer et
 * ratio-iser des soldes EST un calcul.
 *
 * Definitions SYSCOHADA retenues (structure du bilan par classe / prefixe) :
 *  - actif immobilise      : postes d'actif de classe 2 ;
 *  - stocks                : postes d'actif de classe 3 ;
 *  - creances              : postes d'actif de classe 4 ;
 *  - tresorerie d'actif    : postes d'actif de classe 5 ;
 *  - capitaux propres      : passif classe 1 comptes 10-15  + resultat net ;
 *  - dettes financieres    : passif classe 1 comptes 16-19 ;
 *  - dettes circulantes    : passif classe 4 ;
 *  - tresorerie de passif  : passif classe 5 (decouverts).
 *  FDR = ressources stables − actif immobilise ;
 *  BFR = actif circulant − dettes circulantes ;
 *  Tresorerie nette = FDR − BFR = tresorerie d'actif − tresorerie de passif.
 *
 * Arrondi : les montants arrivent en FCFA entiers ; chaque montant de sortie
 * repasse par `arrondiFCFA()` (garde-fou), y compris les grandeurs qui peuvent
 * etre negatives (FDR/BFR/tresorerie nette, ecarts). Les ratios restent des
 * fractions ; les delais sont arrondis au jour entier.
 */

import type { FCFA, Taux } from "../types/money.js";
import type { PosteEtat, LigneBalance } from "../types/comptabilite.js";
import type {
  RapportFinancierInput,
  RapportFinancier,
  SyntheseRapport,
  RatiosRapport,
  LigneComparee,
  Variation,
  ComparatifRapport,
} from "../types/rapport-financier.js";
import { arrondiFCFA } from "./arrondi.js";

/** Nombre de jours d'une periode annuelle pour les ratios de rotation. */
const JOURS_ANNEE = 360;

export function calculerRapportFinancier(
  input: RapportFinancierInput,
): RapportFinancier {
  const { compteResultat: cr, bilan, balance } = input;

  /* ------------------------ compte de resultat ------------------------ */
  const chiffreAffaires = arrondiFCFA(sommePostes(cr.produits, (p) => prefixe(p, "70")));
  const totalProduits = arrondiFCFA(cr.totalProduits);
  const totalCharges = arrondiFCFA(cr.totalCharges);
  const resultatNet = arrondiFCFA(cr.resultatNet);
  const margeNette = ratio(resultatNet, chiffreAffaires) ?? 0;

  /* --------------------------- structure bilan --------------------------- */
  const actifImmobilise = arrondiFCFA(sommePostes(bilan.actif, (p) => p.classe === 2));
  const stocks = arrondiFCFA(sommePostes(bilan.actif, (p) => p.classe === 3));
  const creances = arrondiFCFA(sommePostes(bilan.actif, (p) => p.classe === 4));
  const tresorerieActif = arrondiFCFA(sommePostes(bilan.actif, (p) => p.classe === 5));

  const capitalEtReserves = sommePostes(
    bilan.passif,
    (p) => p.classe === 1 && chiffreApres(p.compte) <= 5,
  );
  const dettesFinancieres = arrondiFCFA(
    sommePostes(bilan.passif, (p) => p.classe === 1 && chiffreApres(p.compte) >= 6),
  );
  const dettesCirculantes = arrondiFCFA(sommePostes(bilan.passif, (p) => p.classe === 4));
  const tresoreriePassif = arrondiFCFA(sommePostes(bilan.passif, (p) => p.classe === 5));

  // Le resultat de l'exercice est une ressource propre (bilan passif « hors resultat »).
  const capitauxPropres = arrondiFCFA(capitalEtReserves + resultatNet);
  const ressourcesStables = arrondiFCFA(capitauxPropres + dettesFinancieres);
  const actifCirculant = arrondiFCFA(stocks + creances);

  const fondsDeRoulement = arrondiFCFA(ressourcesStables - actifImmobilise);
  const bfr = arrondiFCFA(actifCirculant - dettesCirculantes);
  const tresorerieNette = arrondiFCFA(tresorerieActif - tresoreriePassif);

  /* ------------------------------ ratios ------------------------------ */
  const creancesClients = soldeDebiteurPrefixe(balance, "41");
  const dettesFournisseurs = soldeCrediteurPrefixe(balance, "40");
  const achats = sommePostes(cr.charges, (p) => prefixe(p, "60"));

  const ratios: RatiosRapport = {
    margeNette,
    autonomieFinanciere: ratio(capitauxPropres, bilan.totalPassif),
    tauxEndettement: ratio(dettesFinancieres, capitauxPropres),
    liquiditeGenerale: ratio(actifCirculant + tresorerieActif, dettesCirculantes + tresoreriePassif),
    delaiClients: delaiJours(creancesClients, chiffreAffaires),
    delaiFournisseurs: delaiJours(dettesFournisseurs, achats),
  };

  /* ------------------------- comparatifs N-1 / budget ------------------------- */
  const n1 = input.exercicePrecedent;
  const budget = input.budget;

  const margeNettePrecedent =
    n1 && n1.resultatNet != null && n1.chiffreAffaires != null
      ? ratio(n1.resultatNet, n1.chiffreAffaires)
      : null;

  const synthese: SyntheseRapport = {
    chiffreAffaires,
    totalProduits,
    totalCharges,
    resultatNet,
    beneficiaire: resultatNet >= 0,
    margeNette,
    margeNettePrecedent,
    capitauxPropres,
    dettesFinancieres,
    ressourcesStables,
    actifImmobilise,
    actifCirculant,
    dettesCirculantes,
    tresorerieActif,
    tresoreriePassif,
    fondsDeRoulement,
    bfr,
    tresorerieNette,
    tresorerieDisponible:
      input.tresorerieDisponible != null ? arrondiFCFA(input.tresorerieDisponible) : null,
    totalActif: arrondiFCFA(bilan.totalActif),
    totalPassif: arrondiFCFA(bilan.totalPassif),
  };

  const exploitation: LigneComparee[] = [
    ligne("ca", "Chiffre d'affaires", chiffreAffaires, n1?.chiffreAffaires, budget?.chiffreAffaires),
    ligne("produits", "Total des produits", totalProduits, n1?.totalProduits, budget?.totalProduits),
    ligne("charges", "Total des charges", totalCharges, n1?.totalCharges, budget?.totalCharges),
    ligne("resultat", "Resultat net", resultatNet, n1?.resultatNet, budget?.resultatNet),
  ];

  return { synthese, ratios, exploitation, bilanEquilibre: bilan.equilibre };
}

/* --------------------------------- helpers --------------------------------- */

/** Somme des montants des postes qui satisfont le predicat. */
function sommePostes(postes: PosteEtat[], garde: (p: PosteEtat) => boolean): number {
  let s = 0;
  for (const p of postes) if (garde(p)) s += p.montant;
  return s;
}

/** true si le numero de compte du poste commence par `prefixe`. */
function prefixe(p: PosteEtat, prefixe: string): boolean {
  return p.compte.startsWith(prefixe);
}

/** 2e chiffre du numero de compte (ex. "162" -> 6). -1 si absent. */
function chiffreApres(compte: string): number {
  const c = compte.charCodeAt(1) - 48; // '0' = 48
  return c >= 0 && c <= 9 ? c : -1;
}

/** Σ des soldes debiteurs des comptes de la balance commencant par `prefixe`. */
function soldeDebiteurPrefixe(balance: LigneBalance[], prefixe: string): number {
  let s = 0;
  for (const b of balance) if (b.compte.startsWith(prefixe)) s += b.soldeDebiteur;
  return s;
}

/** Σ des soldes crediteurs des comptes de la balance commencant par `prefixe`. */
function soldeCrediteurPrefixe(balance: LigneBalance[], prefixe: string): number {
  let s = 0;
  for (const b of balance) if (b.compte.startsWith(prefixe)) s += b.soldeCrediteur;
  return s;
}

/** Ratio numerateur / denominateur ; null si le denominateur est nul. */
function ratio(numerateur: number, denominateur: number): Taux | null {
  return denominateur !== 0 ? numerateur / denominateur : null;
}

/** Delai de rotation en jours entiers = poste / flux × 360 ; null si flux nul. */
function delaiJours(poste: number, flux: number): number | null {
  if (flux <= 0) return null;
  return Math.round((poste / flux) * JOURS_ANNEE);
}

/** Construit une variation valeur/base ; undefined si aucune base fournie. */
function variation(valeur: FCFA, base?: FCFA): Variation | undefined {
  if (base == null) return undefined;
  const b = arrondiFCFA(base);
  return {
    base: b,
    ecart: arrondiFCFA(valeur - b),
    ecartPct: b !== 0 ? (valeur - b) / Math.abs(b) : null,
  };
}

/** Construit une ligne comparee (valeur exercice + variations N-1 / budget). */
function ligne(
  cle: string,
  libelle: string,
  valeur: FCFA,
  baseN1: ComparatifRapport[keyof ComparatifRapport],
  baseBudget: ComparatifRapport[keyof ComparatifRapport],
): LigneComparee {
  return {
    cle,
    libelle,
    valeur,
    n1: variation(valeur, baseN1),
    budget: variation(valeur, baseBudget),
  };
}
