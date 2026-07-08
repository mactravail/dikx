/**
 * Moteur CRM — agregation du pipeline commercial. Pur et deterministe.
 *
 * Meme regle que partout : sommer des montants EST un calcul, il n'est donc pas
 * fait dans le navigateur mais ici, cote moteur teste. On produit, par etape du
 * pipeline : le nombre d'opportunites, le total des montants et la prevision
 * ponderee (Σ montant × probabilite).
 *
 * Argent : FCFA entiers ; les probabilites sont des fractions (0.30 = 30 %).
 */

import type { FCFA, Taux } from "../types/money.js";
import { arrondiFCFA } from "./arrondi.js";

export interface OpportuniteInput {
  /** Libelle de l'etape (doit correspondre a une entree de `etapesOrdre`). */
  etape: string;
  /** Valeur estimee de l'affaire, en FCFA. */
  montant: FCFA;
  /** Probabilite de gain (fraction). Defaut : 0. */
  probabilite?: Taux;
}

export interface EtapePipeline {
  etape: string;
  nombre: number;
  total: FCFA;
  totalPondere: FCFA;
}

export interface ResultatPipeline {
  parEtape: EtapePipeline[];
  nombre: number;
  total: FCFA;
  /** Prevision ponderee de l'ensemble du pipeline. */
  totalPondere: FCFA;
}

/**
 * @param opportunites  affaires en cours
 * @param etapesOrdre   ordre des colonnes du pipeline (les etapes vides sont
 *                      conservees a 0 pour un affichage kanban stable)
 */
export function calculerPipeline(
  opportunites: OpportuniteInput[],
  etapesOrdre: string[],
): ResultatPipeline {
  const acc = new Map<string, EtapePipeline>();
  for (const etape of etapesOrdre) {
    acc.set(etape, { etape, nombre: 0, total: 0, totalPondere: 0 });
  }

  for (const o of opportunites) {
    const proba = fraction01(o.probabilite ?? 0);
    const montant = arrondiFCFA(o.montant);
    const pondere = arrondiFCFA(montant * proba);
    const e = acc.get(o.etape) ?? {
      etape: o.etape,
      nombre: 0,
      total: 0,
      totalPondere: 0,
    };
    e.nombre += 1;
    e.total += montant;
    e.totalPondere += pondere;
    acc.set(o.etape, e);
  }

  const parEtape = [...acc.values()];
  return {
    parEtape,
    nombre: parEtape.reduce((s, e) => s + e.nombre, 0),
    total: parEtape.reduce((s, e) => s + e.total, 0),
    totalPondere: parEtape.reduce((s, e) => s + e.totalPondere, 0),
  };
}

/** Normalise une probabilite dans [0, 1]. */
function fraction01(x: number): number {
  if (!Number.isFinite(x) || x <= 0) return 0;
  return x >= 1 ? 1 : x;
}
