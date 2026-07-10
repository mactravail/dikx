"use server";

/**
 * Persistance du repertoire CLIENTS dans Supabase (table `clients`, 0002 +
 * entreprise_id 0012), sous RLS scopee par entreprise. Aucun montant : que de
 * l'identite client.
 */
import { creerClientServeur } from "@/lib/supabase/server";
import type { ClientLocal } from "@/lib/ventes-data";

interface ClientRow {
  id: string;
  raison_sociale: string;
  ninea: string | null;
  contact_nom: string | null;
  telephone: string | null;
  email: string | null;
  ville: string | null;
  delai_paiement_jours: number;
  actif: boolean;
}

const COLS = "id,raison_sociale,ninea,contact_nom,telephone,email,ville,delai_paiement_jours,actif";

function versClient(r: ClientRow): ClientLocal {
  return {
    id: r.id,
    raisonSociale: r.raison_sociale,
    ninea: r.ninea ?? undefined,
    contactNom: r.contact_nom ?? undefined,
    telephone: r.telephone ?? undefined,
    email: r.email ?? undefined,
    ville: r.ville ?? undefined,
    delaiPaiementJours: Number(r.delai_paiement_jours),
    actif: r.actif,
  };
}

export async function listerClientsAction(entrepriseId: string): Promise<ClientLocal[]> {
  if (!entrepriseId) return [];
  const s = await creerClientServeur();
  const { data, error } = await s
    .from("clients")
    .select(COLS)
    .eq("entreprise_id", entrepriseId)
    .order("raison_sociale");
  if (error || !data) return [];
  return (data as unknown as ClientRow[]).map(versClient);
}

export async function upsertClientAction(entrepriseId: string, c: ClientLocal): Promise<ClientLocal> {
  const s = await creerClientServeur();
  const champs = {
    raison_sociale: c.raisonSociale.trim(),
    ninea: c.ninea?.trim() || null,
    contact_nom: c.contactNom?.trim() || null,
    telephone: c.telephone?.trim() || null,
    email: c.email?.trim() || null,
    ville: c.ville?.trim() || null,
    delai_paiement_jours: Math.round(c.delaiPaiementJours),
    actif: c.actif,
  };
  if (c.id) {
    const { data, error } = await s.from("clients").update(champs).eq("id", c.id).select(COLS).single();
    if (error || !data) throw new Error(error?.message ?? "Enregistrement du client impossible.");
    return versClient(data as unknown as ClientRow);
  }
  const { data, error } = await s
    .from("clients")
    .insert({ entreprise_id: entrepriseId, ...champs })
    .select(COLS)
    .single();
  if (error || !data) throw new Error(error?.message ?? "Creation du client impossible.");
  return versClient(data as unknown as ClientRow);
}

export async function supprimerClientAction(id: string): Promise<void> {
  const s = await creerClientServeur();
  const { error } = await s.from("clients").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
