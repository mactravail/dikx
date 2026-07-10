"use server";

/**
 * Persistance du module CHARGES & DEPENSES dans Supabase (table `depenses`,
 * 0003 + entreprise_id 0011), sous RLS scopee par entreprise. Le snapshot
 * (TVA deductible, TTC) est calcule PAR LE MOTEUR cote serveur (calculerDepenses)
 * au moment de l'ecriture, jamais dans le navigateur.
 */
import { creerClientServeur } from "@/lib/supabase/server";
import { roleCourantServeur } from "@/lib/roles-serveur";
import { calculerDepenses, PARAMETRES } from "@/lib/engine";
import type { DepenseLocal } from "@/lib/finance-data";
import type { CategorieDepense, Recurrence } from "@/lib/engine";
import type { EtatTransmission } from "@/lib/transmission";

/** Etat de transmission a poser a l'insert selon le role (cf. 0013). */
function transmissionInitiale(role: string): { transmission: "brouillon" | "envoye"; transmis_le: string | null } {
  return role === "comptable"
    ? { transmission: "envoye", transmis_le: new Date().toISOString() }
    : { transmission: "brouillon", transmis_le: null };
}

const MSG_VERROU_DEPENSE = "Cette depense a deja ete envoyee au comptable. Rappelez-la pour la modifier.";

interface DepenseRow {
  id: string;
  date_depense: string;
  libelle: string;
  categorie: CategorieDepense;
  fournisseur: string | null;
  recurrence: Recurrence;
  montant_ht: number;
  taux_tva: number | string;
  montant_tva: number;
  montant_ttc: number;
  transmission: EtatTransmission;
}

const COLS = "id,date_depense,libelle,categorie,fournisseur,recurrence,montant_ht,taux_tva,montant_tva,montant_ttc,transmission";

function versDepense(r: DepenseRow): DepenseLocal {
  return {
    id: r.id,
    date: r.date_depense,
    libelle: r.libelle,
    categorie: r.categorie,
    fournisseur: r.fournisseur ?? undefined,
    recurrence: r.recurrence,
    montantHT: Number(r.montant_ht),
    tauxTVA: Number(r.taux_tva),
    montantTTC: Number(r.montant_ttc),
    transmission: r.transmission,
  };
}

/** Snapshot moteur d'une depense (TVA deductible + TTC). */
function snapshot(d: DepenseLocal): { montantTVA: number; montantTTC: number } {
  const r = calculerDepenses(
    [{ categorie: d.categorie, montantHT: d.montantHT, tauxTVA: d.tauxTVA, recurrence: d.recurrence }],
    { tauxTVADefaut: PARAMETRES.tva.taux },
  );
  const l = r.lignes[0];
  return { montantTVA: l?.montantTVA ?? 0, montantTTC: l?.montantTTC ?? Math.round(d.montantHT) };
}

export async function listerDepensesAction(entrepriseId: string): Promise<DepenseLocal[]> {
  if (!entrepriseId) return [];
  const s = await creerClientServeur();
  const { data, error } = await s
    .from("depenses")
    .select(COLS)
    .eq("entreprise_id", entrepriseId)
    .order("date_depense", { ascending: false });
  if (error || !data) return [];
  return (data as unknown as DepenseRow[]).map(versDepense);
}

export async function upsertDepenseAction(entrepriseId: string, d: DepenseLocal): Promise<DepenseLocal> {
  const s = await creerClientServeur();
  const role = await roleCourantServeur();
  const snap = snapshot(d);
  const champs = {
    date_depense: d.date,
    libelle: d.libelle.trim(),
    categorie: d.categorie,
    fournisseur: d.fournisseur?.trim() || null,
    recurrence: d.recurrence,
    montant_ht: Math.round(d.montantHT),
    taux_tva: d.tauxTVA,
    montant_tva: snap.montantTVA,
    montant_ttc: snap.montantTTC,
  };
  if (d.id) {
    // Verrou : l'entreprise ne peut modifier qu'un brouillon (une ligne envoyee
    // doit d'abord etre rappelee). Le comptable n'est pas contraint.
    let q = s.from("depenses").update(champs).eq("id", d.id);
    if (role !== "comptable") q = q.eq("transmission", "brouillon");
    const { data, error } = await q.select(COLS).single();
    if (error || !data) {
      throw new Error(role !== "comptable" ? MSG_VERROU_DEPENSE : (error?.message ?? "Enregistrement de la depense impossible."));
    }
    return versDepense(data as unknown as DepenseRow);
  }
  const { data, error } = await s
    .from("depenses")
    .insert({ entreprise_id: entrepriseId, ...champs, ...transmissionInitiale(role) })
    .select(COLS)
    .single();
  if (error || !data) throw new Error(error?.message ?? "Creation de la depense impossible.");
  return versDepense(data as unknown as DepenseRow);
}

export async function supprimerDepenseAction(id: string): Promise<void> {
  const s = await creerClientServeur();
  const role = await roleCourantServeur();
  let q = s.from("depenses").delete().eq("id", id);
  if (role !== "comptable") q = q.eq("transmission", "brouillon");
  const { data, error } = await q.select("id");
  if (error) throw new Error(error.message);
  if (role !== "comptable" && (!data || data.length === 0)) throw new Error(MSG_VERROU_DEPENSE);
}
