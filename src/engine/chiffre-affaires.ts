/**
 * Chiffre d'affaires previsionnel (helper, alimente T5, T6, T7, T9, IND).
 *
 * - CA annee 1 : mode simple (montant donne) ou detaille (somme prix x quantite).
 * - Annees 2..5 : croissance composee `CA(k) = CA(1) * (1 + g)^(k-1)`.
 * - Repartition mensuelle de l'annee 1 : egale par defaut, ou saisonniere si
 *   un profil de 12 poids est fourni (le moteur normalise la somme a 1).
 *
 * Arrondi : la repartition mensuelle utilise le cumul arrondi (comme T2) pour
 * que la somme des 12 mois egale exactement le CA annuel.
 */

import type { ChiffreAffaires } from "../types/dossier-input.js";
import type { FCFA, Serie5FCFA, Serie12 } from "../types/money.js";
import { arrondiFCFA, arrondiSerie5 } from "./arrondi.js";

const HORIZON = 5;

export interface ResultatChiffreAffaires {
  /** CA HT par an (annees 1..5), arrondi. */
  caParAn: Serie5FCFA;
  /** Poids mensuels normalises (somme = 1) appliques a l'annee 1. */
  repartitionMensuelle: Serie12<number>;
  /** CA HT mensuel de l'annee 1, arrondi (somme = caParAn[0]). */
  caMensuelAnnee1: Serie12<FCFA>;
}

export function calculerChiffreAffaires(ca: ChiffreAffaires): ResultatChiffreAffaires {
  const caAnnee1 = caAnnee1Exact(ca);

  const caExactParAn: number[] = [];
  for (let k = 1; k <= HORIZON; k++) {
    caExactParAn.push(caAnnee1 * Math.pow(1 + ca.tauxCroissance, k - 1));
  }
  const caParAn = arrondiSerie5(caExactParAn);

  const repartitionMensuelle = normaliserRepartition(ca);
  const caMensuelAnnee1 = repartirMensuel(caAnnee1, repartitionMensuelle);

  return { caParAn, repartitionMensuelle, caMensuelAnnee1 };
}

function caAnnee1Exact(ca: ChiffreAffaires): number {
  if (ca.mode === "detaille") {
    return (ca.produits ?? []).reduce((s, p) => s + p.prixUnitaire * p.quantiteAnnee1, 0);
  }
  return ca.montantAnnee1 ?? 0;
}

function normaliserRepartition(ca: ChiffreAffaires): Serie12<number> {
  const defautEgal = 1 / 12;
  if (!ca.saisonnier || !ca.repartitionMensuelle || ca.repartitionMensuelle.length !== 12) {
    return Array.from({ length: 12 }, () => defautEgal) as Serie12<number>;
  }
  const somme = ca.repartitionMensuelle.reduce((a, b) => a + b, 0);
  if (somme <= 0) {
    return Array.from({ length: 12 }, () => defautEgal) as Serie12<number>;
  }
  return ca.repartitionMensuelle.map((w) => w / somme) as Serie12<number>;
}

function repartirMensuel(caAnnuel: number, poids: Serie12<number>): Serie12<FCFA> {
  const out = [] as unknown as Serie12<FCFA>;
  let cumulPoids = 0;
  let cumulArrondiPrecedent = 0;
  for (let i = 0; i < 12; i++) {
    cumulPoids += poids[i] ?? 0;
    const cumulArrondi = arrondiFCFA(caAnnuel * cumulPoids);
    out[i] = cumulArrondi - cumulArrondiPrecedent;
    cumulArrondiPrecedent = cumulArrondi;
  }
  return out;
}
