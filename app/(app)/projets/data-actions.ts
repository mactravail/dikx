"use server";

/**
 * Persistance du module PROJETS & TACHES dans Supabase (tables `projets` +
 * `taches`, 0004 + entreprise_id 0014), sous RLS scopee par entreprise.
 *
 * Aucun calcul ici : ce sont des saisies (projets, taches, heures). Les comptages,
 * l'avancement et la charge agregee restent produits par le moteur
 * (calculerProjets), cote serveur. Les heures sont une charge (pas de la monnaie).
 */
import { creerClientServeur } from "@/lib/supabase/server";
import type { ProjetLocal, TacheLocal, StatutProjet } from "@/lib/organisation-data";
import type { StatutTache } from "@/lib/engine";

/* --------------------------------- projets --------------------------------- */

interface ProjetRow {
  id: string;
  nom: string;
  client: string | null;
  statut: StatutProjet;
  echeance: string | null;
}
const COLS_PROJET = "id,nom,client,statut,echeance";

function versProjet(r: ProjetRow): ProjetLocal {
  return {
    id: r.id,
    nom: r.nom,
    client: r.client ?? undefined,
    statut: r.statut,
    echeance: r.echeance ?? undefined,
  };
}

export async function listerProjetsAction(entrepriseId: string): Promise<ProjetLocal[]> {
  if (!entrepriseId) return [];
  const s = await creerClientServeur();
  const { data, error } = await s
    .from("projets")
    .select(COLS_PROJET)
    .eq("entreprise_id", entrepriseId)
    .order("created_at");
  if (error || !data) return [];
  return (data as unknown as ProjetRow[]).map(versProjet);
}

export async function upsertProjetAction(entrepriseId: string, p: ProjetLocal): Promise<ProjetLocal> {
  const s = await creerClientServeur();
  const champs = {
    nom: p.nom.trim(),
    client: p.client?.trim() || null,
    statut: p.statut,
    echeance: p.echeance || null,
  };
  if (p.id) {
    const { data, error } = await s.from("projets").update(champs).eq("id", p.id).select(COLS_PROJET).single();
    if (error || !data) throw new Error(error?.message ?? "Enregistrement du projet impossible.");
    return versProjet(data as unknown as ProjetRow);
  }
  const { data, error } = await s
    .from("projets")
    .insert({ entreprise_id: entrepriseId, ...champs })
    .select(COLS_PROJET)
    .single();
  if (error || !data) throw new Error(error?.message ?? "Creation du projet impossible.");
  return versProjet(data as unknown as ProjetRow);
}

/** Supprime un projet ; ses taches partent en cascade (FK on delete cascade). */
export async function supprimerProjetAction(id: string): Promise<void> {
  const s = await creerClientServeur();
  const { error } = await s.from("projets").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/* --------------------------------- taches ---------------------------------- */

interface TacheRow {
  id: string;
  projet_id: string;
  titre: string;
  statut: StatutTache;
  assignee: string | null;
  echeance: string | null;
  heures_estimees: number | string;
  heures_realisees: number | string;
}
const COLS_TACHE = "id,projet_id,titre,statut,assignee,echeance,heures_estimees,heures_realisees";

function versTache(r: TacheRow): TacheLocal {
  return {
    id: r.id,
    projetId: r.projet_id,
    titre: r.titre,
    statut: r.statut,
    assignee: r.assignee ?? undefined,
    echeance: r.echeance ?? undefined,
    heuresEstimees: Number(r.heures_estimees),
    heuresRealisees: Number(r.heures_realisees),
  };
}

export async function listerTachesAction(entrepriseId: string): Promise<TacheLocal[]> {
  if (!entrepriseId) return [];
  const s = await creerClientServeur();
  const { data, error } = await s
    .from("taches")
    .select(COLS_TACHE)
    .eq("entreprise_id", entrepriseId)
    .order("created_at");
  if (error || !data) return [];
  return (data as unknown as TacheRow[]).map(versTache);
}

export async function upsertTacheAction(entrepriseId: string, t: TacheLocal): Promise<TacheLocal> {
  const s = await creerClientServeur();
  const champs = {
    projet_id: t.projetId,
    titre: t.titre.trim(),
    statut: t.statut,
    assignee: t.assignee?.trim() || null,
    echeance: t.echeance || null,
    heures_estimees: t.heuresEstimees,
    heures_realisees: t.heuresRealisees,
  };
  if (t.id) {
    const { data, error } = await s.from("taches").update(champs).eq("id", t.id).select(COLS_TACHE).single();
    if (error || !data) throw new Error(error?.message ?? "Enregistrement de la tache impossible.");
    return versTache(data as unknown as TacheRow);
  }
  const { data, error } = await s
    .from("taches")
    .insert({ entreprise_id: entrepriseId, ...champs })
    .select(COLS_TACHE)
    .single();
  if (error || !data) throw new Error(error?.message ?? "Creation de la tache impossible.");
  return versTache(data as unknown as TacheRow);
}

export async function supprimerTacheAction(id: string): Promise<void> {
  const s = await creerClientServeur();
  const { error } = await s.from("taches").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
