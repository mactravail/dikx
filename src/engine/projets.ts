/**
 * Moteur PROJETS & TACHES — agregation des taches par projet. Pur et
 * deterministe (aucune I/O, aucun aleatoire).
 *
 * Il produit, par projet : le nombre de taches par etat (a faire / en cours /
 * termine), le taux d'avancement (terminees / total) et la charge en heures
 * (estimee, realisee, ecart) ; puis les totaux et l'avancement global. C'est le
 * SEUL endroit ou ces agregats sont calcules ; l'UI ne compte ni ne somme rien.
 *
 * Les grandeurs ne sont pas monetaires : comptages entiers et heures (qui
 * peuvent etre decimales) ; on n'applique donc pas `arrondiFCFA`. Les heures
 * negatives ou non finies sont normalisees a 0.
 */

import type { Taux } from "../types/money.js";
import type {
  StatutTache,
  TacheInput,
  AvancementProjet,
  ResultatProjets,
} from "../types/projets.js";

/**
 * @param taches        taches a agreger
 * @param projetsOrdre  ordre des projets ; les projets sans tache sont conserves
 *                      a 0 pour un affichage stable (comme les colonnes kanban)
 */
export function calculerProjets(
  taches: TacheInput[],
  projetsOrdre: string[],
): ResultatProjets {
  const acc = new Map<string, AvancementProjet>();
  for (const projet of projetsOrdre) acc.set(projet, vide(projet));

  for (const t of taches) {
    const p = acc.get(t.projet) ?? vide(t.projet);
    p.total += 1;
    if (t.statut === "termine") p.terminees += 1;
    else if (t.statut === "en_cours") p.enCours += 1;
    else p.aFaire += 1;
    p.heuresEstimees += heures(t.heuresEstimees);
    p.heuresRealisees += heures(t.heuresRealisees);
    acc.set(t.projet, p);
  }

  const parProjet = [...acc.values()];
  for (const p of parProjet) {
    p.avancement = ratio(p.terminees, p.total);
    p.ecartHeures = p.heuresRealisees - p.heuresEstimees;
  }

  const totalTaches = parProjet.reduce((s, p) => s + p.total, 0);
  const terminees = parProjet.reduce((s, p) => s + p.terminees, 0);

  return {
    parProjet,
    totalTaches,
    aFaire: parProjet.reduce((s, p) => s + p.aFaire, 0),
    enCours: parProjet.reduce((s, p) => s + p.enCours, 0),
    terminees,
    avancementGlobal: ratio(terminees, totalTaches),
    totalHeuresEstimees: parProjet.reduce((s, p) => s + p.heuresEstimees, 0),
    totalHeuresRealisees: parProjet.reduce((s, p) => s + p.heuresRealisees, 0),
  };
}

function vide(projet: string): AvancementProjet {
  return {
    projet,
    total: 0,
    aFaire: 0,
    enCours: 0,
    terminees: 0,
    avancement: 0,
    heuresEstimees: 0,
    heuresRealisees: 0,
    ecartHeures: 0,
  };
}

/** Fraction terminees/total dans [0, 1] ; 0 si le denominateur est nul. */
function ratio(part: number, total: number): Taux {
  return total > 0 ? part / total : 0;
}

/** Normalise un nombre d'heures (les valeurs invalides / negatives -> 0). */
function heures(x: number | undefined): number {
  return Number.isFinite(x) && (x as number) > 0 ? (x as number) : 0;
}

export type { StatutTache };
