/**
 * Moteur TRESORERIE (comptes de disponibilites) — pur et deterministe.
 *
 * A partir des comptes (banques, caisses, mobile money) et de leurs mouvements
 * (entrees / sorties), il produit :
 *  - le solde courant de chaque compte (soldeInitial + entrees − sorties) ;
 *  - les totaux (soldes initiaux, entrees, sorties, flux net, disponible) ;
 *  - la repartition du disponible par nature de compte ;
 *  - la repartition des SORTIES par categorie (« qu'a-t-on depense »).
 *
 * C'est le SEUL endroit ou ces cumuls sont produits ; ni l'UI ni l'IA ne somment
 * un montant (regle CLAUDE.md). Sommer des mouvements EST un calcul.
 *
 * Robustesse : un montant negatif ou non fini est ramene a 0 ; un mouvement
 * portant un compteId inconnu est ignore (il ne peut alimenter aucun solde).
 *
 * Invariant : totalDisponible === totalSoldeInitial + fluxNet.
 *
 * Arrondi : les montants arrivent en FCFA entiers ; chaque cumul de sortie passe
 * par `arrondiFCFA()` (garde-fou).
 */

import type { FCFA, Taux } from "../types/money.js";
import type {
  CompteTresorerieInput,
  MouvementTresorerieInput,
  SoldeCompte,
  RepartitionType,
  RepartitionFlux,
  TypeCompteTresorerie,
  ResultatTresorerie,
} from "../types/tresorerie.js";
import { arrondiFCFA } from "./arrondi.js";

/** Ordre d'affichage stable des natures de compte. */
const ORDRE_TYPES: TypeCompteTresorerie[] = ["banque", "mobile_money", "caisse"];

export function calculerTresorerie(
  comptes: CompteTresorerieInput[],
  mouvements: MouvementTresorerieInput[],
): ResultatTresorerie {
  // Un accumulateur par compte, dans l'ordre d'entree.
  const soldes = new Map<string, SoldeCompte>();
  for (const c of comptes) {
    soldes.set(c.id, {
      compteId: c.id,
      nom: c.nom,
      type: c.type,
      operateur: c.operateur,
      soldeInitial: arrondiFCFA(positif(c.soldeInitial)),
      totalEntrees: 0,
      totalSorties: 0,
      soldeCourant: 0,
      nbMouvements: 0,
    });
  }

  const sortiesParCat = new Map<string, FCFA>();

  for (const m of mouvements) {
    const compte = soldes.get(m.compteId);
    if (!compte) continue; // mouvement orphelin : ignore
    const montant = arrondiFCFA(positif(m.montant));
    if (m.sens === "entree") {
      compte.totalEntrees += montant;
    } else {
      compte.totalSorties += montant;
      sortiesParCat.set(m.categorie, (sortiesParCat.get(m.categorie) ?? 0) + montant);
    }
    compte.nbMouvements += 1;
  }

  const comptesOut = [...soldes.values()];
  for (const c of comptesOut) {
    c.soldeCourant = c.soldeInitial + c.totalEntrees - c.totalSorties;
  }

  const totalSoldeInitial = somme(comptesOut.map((c) => c.soldeInitial));
  const totalEntrees = somme(comptesOut.map((c) => c.totalEntrees));
  const totalSorties = somme(comptesOut.map((c) => c.totalSorties));
  const totalDisponible = somme(comptesOut.map((c) => c.soldeCourant));

  return {
    comptes: comptesOut,
    totalSoldeInitial,
    totalEntrees,
    totalSorties,
    fluxNet: totalEntrees - totalSorties,
    totalDisponible,
    parType: repartirParType(comptesOut, totalDisponible),
    sortiesParCategorie: repartirSorties(sortiesParCat, totalSorties),
  };
}

/** Disponible cumule par nature de compte, part decroissante (ordre stable a egalite). */
function repartirParType(
  comptes: SoldeCompte[],
  totalDisponible: FCFA,
): RepartitionType[] {
  const parType = new Map<TypeCompteTresorerie, FCFA>();
  for (const c of comptes) {
    parType.set(c.type, (parType.get(c.type) ?? 0) + c.soldeCourant);
  }
  const out: RepartitionType[] = [...parType.entries()].map(([type, soldeCourant]) => ({
    type,
    soldeCourant,
    part: part(soldeCourant, totalDisponible),
  }));
  out.sort(
    (a, b) => b.soldeCourant - a.soldeCourant || indexType(a.type) - indexType(b.type),
  );
  return out;
}

/** Sorties cumulees par categorie, part decroissante. */
function repartirSorties(
  sortiesParCat: Map<string, FCFA>,
  totalSorties: FCFA,
): RepartitionFlux[] {
  const out: RepartitionFlux[] = [...sortiesParCat.entries()].map(([categorie, total]) => ({
    categorie,
    total,
    part: part(total, totalSorties),
  }));
  out.sort((a, b) => b.total - a.total);
  return out;
}

function indexType(t: TypeCompteTresorerie): number {
  const i = ORDRE_TYPES.indexOf(t);
  return i === -1 ? ORDRE_TYPES.length : i;
}

function part(x: FCFA, total: FCFA): Taux {
  return total > 0 ? x / total : 0;
}

function somme(xs: FCFA[]): FCFA {
  return xs.reduce((s, x) => s + x, 0);
}

/** Un montant de mouvement ne peut etre negatif (valeurs invalides -> 0). */
function positif(x: number): number {
  return Number.isFinite(x) && x > 0 ? x : 0;
}
