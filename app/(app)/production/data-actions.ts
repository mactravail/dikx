"use server";

/**
 * Persistance du module PRODUCTION / MRP dans Supabase (tables `nomenclatures` +
 * `composants_nomenclature` et `ordres_fabrication`, 0005 + entreprise_id 0014),
 * sous RLS scopee par entreprise.
 *
 * Aucun calcul ici : nomenclatures, composants et ordres sont des SAISIES. Les
 * besoins matiere (bruts / nets) et le cout matiere restent produits par le
 * moteur (calculerProduction), cote serveur, a l'affichage.
 */
import { creerClientServeur } from "@/lib/supabase/server";
import type {
  NomenclatureLocal,
  ComposantLocal,
  OrdreLocal,
  StatutOrdre,
} from "@/lib/achats-stock-data";

/* ----------------------------- nomenclatures ----------------------------- */

interface ComposantRow {
  composant_ref: string;
  designation: string | null;
  quantite: number | string;
  cout_unitaire: number;
  position?: number;
  created_at?: string;
}
interface NomenclatureRow {
  id: string;
  produit_ref: string;
  designation: string | null;
  composants_nomenclature?: ComposantRow[];
}

const COLS_NOM =
  "id,produit_ref,designation,composants_nomenclature(composant_ref,designation,quantite,cout_unitaire,created_at)";

function versComposant(r: ComposantRow): ComposantLocal {
  return {
    ref: r.composant_ref,
    designation: r.designation ?? undefined,
    quantite: Number(r.quantite),
    coutUnitaire: Number(r.cout_unitaire),
  };
}

function versNomenclature(r: NomenclatureRow): NomenclatureLocal {
  const composants = (r.composants_nomenclature ?? [])
    .slice()
    .sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""))
    .map(versComposant);
  return {
    id: r.id,
    produit: r.produit_ref,
    designation: r.designation ?? "",
    composants,
  };
}

export async function listerNomenclaturesAction(entrepriseId: string): Promise<NomenclatureLocal[]> {
  if (!entrepriseId) return [];
  const s = await creerClientServeur();
  const { data, error } = await s
    .from("nomenclatures")
    .select(COLS_NOM)
    .eq("entreprise_id", entrepriseId)
    .order("produit_ref");
  if (error || !data) return [];
  return (data as unknown as NomenclatureRow[]).map(versNomenclature);
}

export async function upsertNomenclatureAction(
  entrepriseId: string,
  n: NomenclatureLocal,
): Promise<NomenclatureLocal> {
  const s = await creerClientServeur();
  const champs = { produit_ref: n.produit.trim(), designation: n.designation?.trim() || null };

  let nomId = n.id;
  if (nomId) {
    const { error } = await s.from("nomenclatures").update(champs).eq("id", nomId);
    if (error) throw new Error(error.message);
    await s.from("composants_nomenclature").delete().eq("nomenclature_id", nomId);
  } else {
    const { data, error } = await s
      .from("nomenclatures")
      .insert({ entreprise_id: entrepriseId, ...champs })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "Creation de la nomenclature impossible.");
    nomId = (data as { id: string }).id;
  }

  const rows = n.composants
    .filter((c) => c.ref.trim())
    .map((c) => ({
      entreprise_id: entrepriseId,
      nomenclature_id: nomId,
      composant_ref: c.ref.trim(),
      designation: c.designation?.trim() || null,
      quantite: c.quantite,
      cout_unitaire: Math.max(0, Math.round(c.coutUnitaire)),
    }));
  if (rows.length > 0) {
    const { error } = await s.from("composants_nomenclature").insert(rows);
    if (error) throw new Error(error.message);
  }

  const { data } = await s.from("nomenclatures").select(COLS_NOM).eq("id", nomId).single();
  return versNomenclature(data as unknown as NomenclatureRow);
}

export async function supprimerNomenclatureAction(id: string): Promise<void> {
  const s = await creerClientServeur();
  const { error } = await s.from("nomenclatures").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/* --------------------------- ordres de fabrication --------------------------- */

interface OrdreRow {
  id: string;
  produit_ref: string;
  quantite: number | string;
  statut: StatutOrdre;
  echeance: string | null;
}
const COLS_ORDRE = "id,produit_ref,quantite,statut,echeance";

function versOrdre(r: OrdreRow): OrdreLocal {
  return {
    id: r.id,
    produit: r.produit_ref,
    quantite: Number(r.quantite),
    statut: r.statut,
    echeance: r.echeance ?? undefined,
  };
}

export async function listerOrdresAction(entrepriseId: string): Promise<OrdreLocal[]> {
  if (!entrepriseId) return [];
  const s = await creerClientServeur();
  const { data, error } = await s
    .from("ordres_fabrication")
    .select(COLS_ORDRE)
    .eq("entreprise_id", entrepriseId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return (data as unknown as OrdreRow[]).map(versOrdre);
}

export async function upsertOrdreAction(entrepriseId: string, o: OrdreLocal): Promise<OrdreLocal> {
  const s = await creerClientServeur();
  const champs = {
    produit_ref: o.produit.trim(),
    quantite: o.quantite,
    statut: o.statut,
    echeance: o.echeance || null,
  };
  if (o.id) {
    const { data, error } = await s
      .from("ordres_fabrication")
      .update(champs)
      .eq("id", o.id)
      .select(COLS_ORDRE)
      .single();
    if (error || !data) throw new Error(error?.message ?? "Enregistrement de l'ordre impossible.");
    return versOrdre(data as unknown as OrdreRow);
  }
  const { data, error } = await s
    .from("ordres_fabrication")
    .insert({ entreprise_id: entrepriseId, ...champs })
    .select(COLS_ORDRE)
    .single();
  if (error || !data) throw new Error(error?.message ?? "Creation de l'ordre impossible.");
  return versOrdre(data as unknown as OrdreRow);
}

export async function supprimerOrdreAction(id: string): Promise<void> {
  const s = await creerClientServeur();
  const { error } = await s.from("ordres_fabrication").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
