"use server";

/**
 * Persistance du module COMPTABILITE dans Supabase (tables `ecritures` +
 * `lignes_ecriture`, 0003 + entreprise_id 0014), sous RLS scopee par entreprise.
 *
 * Une ecriture porte ses lignes en partie double. Les totaux (debit/credit) sont
 * un SNAPSHOT calcule PAR LE MOTEUR cote serveur (calculerComptabilite) a
 * l'ecriture, jamais dans le navigateur. La balance et l'equilibre affiches
 * restent produits par le moteur (calculerComptabiliteAction).
 */
import { creerClientServeur } from "@/lib/supabase/server";
import { calculerComptabilite } from "@/lib/engine";
import type { EcritureLocal, LigneEcritureLocal } from "@/lib/finance-data";

interface LigneRow {
  compte: string;
  libelle: string | null;
  debit: number;
  credit: number;
  ordre: number;
}
interface EcritureRow {
  id: string;
  date_ecriture: string;
  journal: string;
  libelle: string;
  reference: string | null;
  lignes_ecriture?: LigneRow[];
}

const COLS =
  "id,date_ecriture,journal,libelle,reference,lignes_ecriture(compte,libelle,debit,credit,ordre)";

function versEcriture(r: EcritureRow): EcritureLocal {
  const lignes = (r.lignes_ecriture ?? [])
    .slice()
    .sort((a, b) => a.ordre - b.ordre)
    .map<LigneEcritureLocal>((l) => ({
      compte: l.compte,
      libelle: l.libelle ?? "",
      debit: Number(l.debit),
      credit: Number(l.credit),
    }));
  return {
    id: r.id,
    date: r.date_ecriture,
    journal: r.journal,
    libelle: r.libelle,
    reference: r.reference ?? undefined,
    lignes,
  };
}

/** Snapshot moteur d'une ecriture (total debit/credit). */
function snapshot(e: EcritureLocal): { totalDebit: number; totalCredit: number } {
  const r = calculerComptabilite([
    {
      date: e.date,
      journal: e.journal,
      libelle: e.libelle,
      lignes: e.lignes.map((l) => ({ compte: l.compte, libelle: l.libelle, debit: l.debit, credit: l.credit })),
    },
  ]);
  const c = r.ecritures[0];
  return { totalDebit: c?.totalDebit ?? 0, totalCredit: c?.totalCredit ?? 0 };
}

/** Lignes valides (compte renseigne) -> rows a inserer, scopees par entreprise. */
function lignesRows(entrepriseId: string, ecritureId: string, e: EcritureLocal) {
  return e.lignes
    .filter((l) => l.compte.trim())
    .map((l, i) => ({
      entreprise_id: entrepriseId,
      ecriture_id: ecritureId,
      compte: l.compte,
      libelle: l.libelle?.trim() || null,
      debit: Math.round(l.debit) || 0,
      credit: Math.round(l.credit) || 0,
      ordre: i,
    }));
}

export async function listerEcrituresAction(entrepriseId: string): Promise<EcritureLocal[]> {
  if (!entrepriseId) return [];
  const s = await creerClientServeur();
  const { data, error } = await s
    .from("ecritures")
    .select(COLS)
    .eq("entreprise_id", entrepriseId)
    .order("date_ecriture", { ascending: false });
  if (error || !data) return [];
  return (data as unknown as EcritureRow[]).map(versEcriture);
}

export async function upsertEcritureAction(entrepriseId: string, e: EcritureLocal): Promise<EcritureLocal> {
  const s = await creerClientServeur();
  const snap = snapshot(e);
  const champs = {
    date_ecriture: e.date,
    journal: e.journal,
    libelle: e.libelle.trim(),
    reference: e.reference?.trim() || null,
    total_debit: snap.totalDebit,
    total_credit: snap.totalCredit,
  };

  let ecritureId = e.id;
  if (ecritureId) {
    const { error } = await s.from("ecritures").update(champs).eq("id", ecritureId);
    if (error) throw new Error(error.message);
    // Remplace les lignes (l'ecriture est editee comme un tout).
    await s.from("lignes_ecriture").delete().eq("ecriture_id", ecritureId);
  } else {
    const { data, error } = await s
      .from("ecritures")
      .insert({ entreprise_id: entrepriseId, ...champs })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "Creation de l'ecriture impossible.");
    ecritureId = (data as { id: string }).id;
  }

  const rows = lignesRows(entrepriseId, ecritureId, e);
  if (rows.length > 0) {
    const { error } = await s.from("lignes_ecriture").insert(rows);
    if (error) throw new Error(error.message);
  }

  const { data } = await s.from("ecritures").select(COLS).eq("id", ecritureId).single();
  return versEcriture(data as unknown as EcritureRow);
}

export async function supprimerEcritureAction(id: string): Promise<void> {
  const s = await creerClientServeur();
  // lignes_ecriture : suppression en cascade (FK on delete cascade).
  const { error } = await s.from("ecritures").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
