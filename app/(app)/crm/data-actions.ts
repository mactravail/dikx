"use server";

/**
 * Persistance du module VENTES & CRM dans Supabase (table `opportunites`, 0014),
 * sous RLS scopee par entreprise. `entrepriseId` est passe par le client mais
 * REVALIDE par la RLS (peut_acceder).
 *
 * Aucun calcul monetaire ici : le montant d'une opportunite est une SAISIE. Les
 * totaux par etape et la prevision ponderee restent produits par le moteur
 * (calculerPipeline), cote serveur.
 */
import { creerClientServeur } from "@/lib/supabase/server";
import type { OpportuniteLocal } from "@/lib/ventes-data";

interface OppRow {
  id: string;
  titre: string;
  client_nom: string | null;
  etape: string;
  montant: number;
  probabilite: number | string;
}

const COLS = "id,titre,client_nom,etape,montant,probabilite";

function versOpportunite(r: OppRow): OpportuniteLocal {
  return {
    id: r.id,
    titre: r.titre,
    clientNom: r.client_nom ?? "",
    etape: r.etape,
    montant: Number(r.montant),
    probabilite: Number(r.probabilite),
  };
}

export async function listerOpportunitesAction(entrepriseId: string): Promise<OpportuniteLocal[]> {
  if (!entrepriseId) return [];
  const s = await creerClientServeur();
  const { data, error } = await s
    .from("opportunites")
    .select(COLS)
    .eq("entreprise_id", entrepriseId)
    .order("created_at");
  if (error || !data) return [];
  return (data as unknown as OppRow[]).map(versOpportunite);
}

export async function upsertOpportuniteAction(
  entrepriseId: string,
  o: OpportuniteLocal,
): Promise<OpportuniteLocal> {
  const s = await creerClientServeur();
  const champs = {
    titre: o.titre.trim(),
    client_nom: o.clientNom?.trim() || null,
    etape: o.etape,
    montant: Math.round(o.montant),
    probabilite: Math.max(0, Math.min(1, o.probabilite)),
  };
  if (o.id) {
    const { data, error } = await s
      .from("opportunites")
      .update(champs)
      .eq("id", o.id)
      .select(COLS)
      .single();
    if (error || !data) throw new Error(error?.message ?? "Enregistrement de l'opportunite impossible.");
    return versOpportunite(data as unknown as OppRow);
  }
  const { data, error } = await s
    .from("opportunites")
    .insert({ entreprise_id: entrepriseId, ...champs })
    .select(COLS)
    .single();
  if (error || !data) throw new Error(error?.message ?? "Creation de l'opportunite impossible.");
  return versOpportunite(data as unknown as OppRow);
}

export async function supprimerOpportuniteAction(id: string): Promise<void> {
  const s = await creerClientServeur();
  const { error } = await s.from("opportunites").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
