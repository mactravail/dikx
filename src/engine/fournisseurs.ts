/**
 * Moteur FOURNISSEURS — agregation des encours (dettes fournisseurs) et
 * ventilation echu / a echoir. Pur et deterministe (aucune I/O, aucun aleatoire).
 *
 * Meme regle que partout : sommer des encours EST un calcul, il n'est donc pas
 * fait dans le navigateur mais ici, cote moteur teste. On produit : l'encours
 * total, la part echue (echeance depassee a la date de reference) et la part a
 * echoir, plus la part de chaque fournisseur.
 *
 * La date de reference est un PARAMETRE (injecte par l'appelant) : le moteur ne
 * lit jamais l'horloge, il reste deterministe.
 *
 * Argent : FCFA entiers ; les encours saisis sont arrondis a l'entier.
 */

import type { FCFA } from "../types/money.js";
import type {
  FournisseurInput,
  FournisseurCalc,
  ResultatFournisseurs,
} from "../types/fournisseurs.js";
import { arrondiFCFA } from "./arrondi.js";

/**
 * @param fournisseurs   fournisseurs et leur solde du
 * @param dateReference  date ISO (AAAA-MM-JJ) : un solde dont l'echeance lui est
 *                       anterieure ou egale est considere echu
 */
export function calculerFournisseurs(
  fournisseurs: FournisseurInput[],
  dateReference: string,
): ResultatFournisseurs {
  const ref = jour(dateReference);

  const parFournisseur: FournisseurCalc[] = fournisseurs.map((f) => {
    const encours = Math.max(0, arrondiFCFA(f.encours ?? 0));
    const ech = jour(f.echeance);
    // Echu si une echeance est fournie et anterieure ou egale a la reference.
    const echu = ech !== null && ref !== null && ech <= ref;
    return { nom: f.nom, encours, echu, part: 0 };
  });

  const totalEncours = somme(parFournisseur.map((f) => f.encours));
  const totalEchu = somme(parFournisseur.filter((f) => f.echu).map((f) => f.encours));

  for (const f of parFournisseur) {
    f.part = totalEncours > 0 ? f.encours / totalEncours : 0;
  }
  parFournisseur.sort((a, b) => b.encours - a.encours);

  return {
    parFournisseur,
    nbFournisseurs: parFournisseur.length,
    totalEncours,
    totalEchu,
    totalAEchoir: totalEncours - totalEchu,
  };
}

function somme(xs: FCFA[]): FCFA {
  return xs.reduce((s, x) => s + x, 0);
}

/** Convertit une date ISO en nombre de jours (comparable) ; null si invalide. */
function jour(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.floor(t / 86_400_000);
}
