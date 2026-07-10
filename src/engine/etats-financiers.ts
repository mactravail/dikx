/**
 * Moteur ETATS FINANCIERS (SYSCOHADA revise) — pur et deterministe.
 *
 * A partir de la BALANCE (produite par `calculerComptabilite`), il derive :
 *  - le COMPTE DE RESULTAT (« compte economique ») : produits (classe 7) −
 *    charges (classe 6/8) = resultat net de l'exercice ;
 *  - le BILAN : ACTIF (emplois) = PASSIF (ressources), le resultat net figurant
 *    au passif.
 *
 * C'est le SEUL endroit ou ces syntheses sont produites ; ni l'UI ni l'IA ne
 * somment un montant (regle CLAUDE.md). Classer et sommer des soldes EST un calcul.
 *
 * Classement par CLASSE SYSCOHADA (1er chiffre du numero de compte) :
 *  - classe 1        -> passif (ressources durables : capital, reserves, emprunts) ;
 *  - classes 2, 3    -> actif  (immobilisations nettes, stocks) ;
 *  - classes 4, 5    -> actif si solde debiteur (creances / tresorerie positive),
 *                       passif si solde crediteur (dettes / decouvert) ;
 *  - classes 6, 8dr  -> charges ; classes 7, 8cr -> produits (compte de resultat).
 *
 * Invariant garanti : si la balance est equilibree (Σ debit = Σ credit), alors
 * ACTIF = PASSIF hors resultat + resultat net, donc `bilan.equilibre === true`.
 * (Demonstration : ACTIF − PASSIF − resultat = Σ soldes debiteurs − Σ soldes
 * crediteurs = 0.)
 *
 * Arrondi : les soldes arrivent en FCFA entiers ; chaque montant de poste passe
 * par `arrondiFCFA()` (garde-fou), y compris les nets negatifs (amortissements).
 */

import type { FCFA } from "../types/money.js";
import type {
  LigneBalance,
  PosteEtat,
  CompteResultat,
  Bilan,
  EtatsFinanciers,
} from "../types/comptabilite.js";
import { arrondiFCFA } from "./arrondi.js";

export function calculerEtatsFinanciers(
  balance: LigneBalance[],
): EtatsFinanciers {
  const produits: PosteEtat[] = [];
  const charges: PosteEtat[] = [];
  const actif: PosteEtat[] = [];
  const passif: PosteEtat[] = [];

  for (const b of balance) {
    const classe = classeDe(b.compte);
    const netDebiteur = arrondiFCFA(b.soldeDebiteur - b.soldeCrediteur); // + = emploi
    const netCrediteur = arrondiFCFA(b.soldeCrediteur - b.soldeDebiteur); // + = ressource

    if (classe >= 6) {
      // Comptes de gestion -> compte de resultat.
      // Produit si sa nature est crediteur (classe 7, ou 8 a solde crediteur),
      // charge sinon (classe 6, ou 8 a solde debiteur).
      if (classe === 7 || (classe === 8 && netCrediteur >= 0 && b.soldeCrediteur > 0)) {
        produits.push(poste(b, classe, netCrediteur));
      } else if (classe === 6 || classe === 8) {
        charges.push(poste(b, classe, netDebiteur));
      }
      continue;
    }

    // Comptes de bilan (classes 1 a 5).
    if (classe === 1) {
      passif.push(poste(b, classe, netCrediteur));
    } else if (classe === 2 || classe === 3) {
      actif.push(poste(b, classe, netDebiteur));
    } else {
      // Classes 4 et 5 : cote determine par le sens du solde.
      if (b.soldeDebiteur > 0) actif.push(poste(b, classe, b.soldeDebiteur));
      else if (b.soldeCrediteur > 0) passif.push(poste(b, classe, b.soldeCrediteur));
    }
  }

  produits.sort(parMontantDecroissant);
  charges.sort(parMontantDecroissant);
  actif.sort(parCompte);
  passif.sort(parCompte);

  const totalProduits = somme(produits.map((p) => p.montant));
  const totalCharges = somme(charges.map((p) => p.montant));
  const resultatNet = totalProduits - totalCharges;

  const compteResultat: CompteResultat = {
    produits,
    charges,
    totalProduits,
    totalCharges,
    resultatNet,
    margeNette: totalProduits > 0 ? resultatNet / totalProduits : 0,
    beneficiaire: resultatNet >= 0,
  };

  const totalActif = somme(actif.map((p) => p.montant));
  const totalPassifHorsResultat = somme(passif.map((p) => p.montant));
  const totalPassif = totalPassifHorsResultat + resultatNet;

  const bilan: Bilan = {
    actif,
    passif,
    totalActif,
    totalPassifHorsResultat,
    resultatNet,
    totalPassif,
    equilibre: totalActif === totalPassif,
    ecart: totalActif - totalPassif,
  };

  return { compteResultat, bilan };
}

function poste(b: LigneBalance, classe: number, montant: FCFA): PosteEtat {
  return { compte: b.compte, libelle: b.libelle, classe, montant };
}

/** Classe SYSCOHADA = 1er chiffre du numero de compte (0 si indeterminee). */
function classeDe(compte: string): number {
  const c = compte.trim().charCodeAt(0) - 48; // '0' = 48
  return c >= 1 && c <= 8 ? c : 0;
}

function parMontantDecroissant(a: PosteEtat, b: PosteEtat): number {
  return b.montant - a.montant;
}

function parCompte(a: PosteEtat, b: PosteEtat): number {
  return a.compte < b.compte ? -1 : a.compte > b.compte ? 1 : 0;
}

function somme(xs: FCFA[]): FCFA {
  return xs.reduce((s, x) => s + x, 0);
}
