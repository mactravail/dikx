"use server";

/**
 * Persistance du module FOURNISSEURS dans Supabase (table `fournisseurs`, 0005 +
 * entreprise_id 0014), sous RLS scopee par entreprise.
 *
 * Aucun calcul ici : l'encours est une SAISIE. L'agregation des encours et la
 * ventilation echu / a echoir restent produites par le moteur (calculerFournisseurs).
 */
import { creerClientServeur } from "@/lib/supabase/server";
import type { FournisseurLocal } from "@/lib/achats-stock-data";

interface FournisseurRow {
  id: string;
  nom: string;
  contact: string | null;
  telephone: string | null;
  email: string | null;
  ville: string | null;
  delai_paiement_jours: number;
  encours: number;
  echeance: string | null;
  actif: boolean;
}

const COLS = "id,nom,contact,telephone,email,ville,delai_paiement_jours,encours,echeance,actif";

function versFournisseur(r: FournisseurRow): FournisseurLocal {
  return {
    id: r.id,
    nom: r.nom,
    contact: r.contact ?? undefined,
    telephone: r.telephone ?? undefined,
    email: r.email ?? undefined,
    ville: r.ville ?? undefined,
    delaiPaiementJours: Number(r.delai_paiement_jours),
    encours: Number(r.encours),
    echeance: r.echeance ?? undefined,
    actif: r.actif,
  };
}

export async function listerFournisseursAction(entrepriseId: string): Promise<FournisseurLocal[]> {
  if (!entrepriseId) return [];
  const s = await creerClientServeur();
  const { data, error } = await s
    .from("fournisseurs")
    .select(COLS)
    .eq("entreprise_id", entrepriseId)
    .order("nom");
  if (error || !data) return [];
  return (data as unknown as FournisseurRow[]).map(versFournisseur);
}

export async function upsertFournisseurAction(
  entrepriseId: string,
  f: FournisseurLocal,
): Promise<FournisseurLocal> {
  const s = await creerClientServeur();
  const champs = {
    nom: f.nom.trim(),
    contact: f.contact?.trim() || null,
    telephone: f.telephone?.trim() || null,
    email: f.email?.trim() || null,
    ville: f.ville?.trim() || null,
    delai_paiement_jours: Math.max(0, Math.round(f.delaiPaiementJours)),
    encours: Math.max(0, Math.round(f.encours)),
    echeance: f.echeance || null,
    actif: f.actif,
  };
  if (f.id) {
    const { data, error } = await s.from("fournisseurs").update(champs).eq("id", f.id).select(COLS).single();
    if (error || !data) throw new Error(error?.message ?? "Enregistrement du fournisseur impossible.");
    return versFournisseur(data as unknown as FournisseurRow);
  }
  const { data, error } = await s
    .from("fournisseurs")
    .insert({ entreprise_id: entrepriseId, ...champs })
    .select(COLS)
    .single();
  if (error || !data) throw new Error(error?.message ?? "Creation du fournisseur impossible.");
  return versFournisseur(data as unknown as FournisseurRow);
}

export async function supprimerFournisseurAction(id: string): Promise<void> {
  const s = await creerClientServeur();
  const { error } = await s.from("fournisseurs").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
