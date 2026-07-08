/**
 * Types du module Projets & Taches.
 *
 * Ces types decrivent l'ENTREE collectee par l'UI (des taches rattachees a des
 * projets) et la SORTIE produite par le moteur (`src/engine/projets.ts`).
 *
 * Meme regle que partout : agreger (compter les taches, sommer des heures,
 * calculer un taux d'avancement) EST un calcul ; il n'est donc pas fait dans le
 * navigateur mais dans le moteur deterministe et teste, cote serveur.
 *
 * Ici les grandeurs ne sont PAS monetaires : ce sont des comptages (entiers) et
 * des heures (peuvent etre decimales). L'avancement est une fraction (0.5 = 50 %).
 */

import type { Taux } from "./money.js";

/** Etat d'une tache (colonnes du kanban, dans cet ordre). */
export type StatutTache = "a_faire" | "en_cours" | "termine";

/** Une tache saisie (SAISIE). */
export interface TacheInput {
  /** Cle du projet auquel la tache est rattachee. */
  projet: string;
  statut: StatutTache;
  /** Charge estimee en heures (defaut 0). */
  heuresEstimees?: number;
  /** Charge realisee en heures — feuille de temps (defaut 0). */
  heuresRealisees?: number;
}

/** Avancement agrege d'un projet (snapshot moteur). */
export interface AvancementProjet {
  projet: string;
  /** Nombre total de taches du projet. */
  total: number;
  aFaire: number;
  enCours: number;
  terminees: number;
  /** Taux d'avancement = taches terminees / total (fraction ; 0 si aucune tache). */
  avancement: Taux;
  heuresEstimees: number;
  heuresRealisees: number;
  /** Ecart de charge = heures realisees − heures estimees (>0 = depassement). */
  ecartHeures: number;
}

/** Resultat de l'agregation des projets (SNAPSHOT). */
export interface ResultatProjets {
  parProjet: AvancementProjet[];
  totalTaches: number;
  aFaire: number;
  enCours: number;
  terminees: number;
  /** Avancement global = Σ terminees / Σ total (fraction). */
  avancementGlobal: Taux;
  totalHeuresEstimees: number;
  totalHeuresRealisees: number;
}
