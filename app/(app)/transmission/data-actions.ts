"use server";

/**
 * Circuit « brouillon -> envoi au comptable » (migration 0013).
 *
 * L'entreprise saisit ses chiffres (tresorerie, depenses, employes, factures) ;
 * ils restent en `brouillon` (invisibles au comptable) jusqu'a un ENVOI PAR LOT
 * declenche depuis le tableau de bord entreprise. Une ligne envoyee est
 * verrouillee cote entreprise (garde dans les data-actions modules) ; elle peut
 * etre RAPPELEE (repasse en brouillon) pour correction.
 *
 * Aucun calcul monetaire ici : on ne fait que changer l'etat de transmission.
 * La RLS (0013) garantit qu'un membre n'agit que sur les lignes de SON entreprise.
 */
import { creerClientServeur } from "@/lib/supabase/server";

/** Tables de chiffres soumises au circuit brouillon -> envoye (cf. 0013). */
const TABLES_TRANSMISSIBLES = [
  "mouvements_tresorerie",
  "depenses",
  "employes",
  "documents",
] as const;
export type TableTransmissible = (typeof TABLES_TRANSMISSIBLES)[number];

export interface CompteursBrouillon {
  /** Nombre d'elements en brouillon par module. */
  tresorerie: number;
  charges: number;
  employes: number;
  factures: number;
  /** Total a transmettre. */
  total: number;
  /** Horodatage du dernier envoi (max transmis_le), sinon null. */
  dernierEnvoi: string | null;
}

async function compterBrouillon(table: TableTransmissible, entrepriseId: string): Promise<number> {
  const s = await creerClientServeur();
  const { count } = await s
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("entreprise_id", entrepriseId)
    .eq("transmission", "brouillon");
  return count ?? 0;
}

async function dernierEnvoiDe(table: TableTransmissible, entrepriseId: string): Promise<string | null> {
  const s = await creerClientServeur();
  const { data } = await s
    .from(table)
    .select("transmis_le")
    .eq("entreprise_id", entrepriseId)
    .eq("transmission", "envoye")
    .not("transmis_le", "is", null)
    .order("transmis_le", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as { transmis_le: string } | null)?.transmis_le ?? null;
}

/** Compteurs de brouillons + date du dernier envoi, pour le panneau du tableau de bord. */
export async function compterBrouillonsAction(entrepriseId: string): Promise<CompteursBrouillon> {
  if (!entrepriseId) {
    return { tresorerie: 0, charges: 0, employes: 0, factures: 0, total: 0, dernierEnvoi: null };
  }
  const [tresorerie, charges, employes, factures] = await Promise.all([
    compterBrouillon("mouvements_tresorerie", entrepriseId),
    compterBrouillon("depenses", entrepriseId),
    compterBrouillon("employes", entrepriseId),
    compterBrouillon("documents", entrepriseId),
  ]);
  const dates = await Promise.all(
    TABLES_TRANSMISSIBLES.map((t) => dernierEnvoiDe(t, entrepriseId)),
  );
  const dernierEnvoi = dates.filter((d): d is string => !!d).sort().at(-1) ?? null;
  return {
    tresorerie,
    charges,
    employes,
    factures,
    total: tresorerie + charges + employes + factures,
    dernierEnvoi,
  };
}

async function envoyerTable(table: TableTransmissible, entrepriseId: string, quand: string): Promise<number> {
  const s = await creerClientServeur();
  const { data, error } = await s
    .from(table)
    .update({ transmission: "envoye", transmis_le: quand })
    .eq("entreprise_id", entrepriseId)
    .eq("transmission", "brouillon")
    .select("id");
  if (error) throw new Error(error.message);
  return (data ?? []).length;
}

/**
 * ENVOI PAR LOT : passe tout ce qui est en brouillon (pour l'entreprise active)
 * a `envoye`. Retourne le nombre d'elements transmis. Le comptable les voit alors.
 */
export async function envoyerAuComptableAction(entrepriseId: string): Promise<number> {
  if (!entrepriseId) return 0;
  const quand = new Date().toISOString();
  const comptes = await Promise.all(
    TABLES_TRANSMISSIBLES.map((t) => envoyerTable(t, entrepriseId, quand)),
  );
  return comptes.reduce((a, b) => a + b, 0);
}

/**
 * RAPPEL : repasse une ligne DEJA ENVOYEE en brouillon pour correction. Bornee a
 * une table transmissible ; la RLS garantit que la ligne appartient a l'entreprise.
 */
export async function rappelerAction(table: TableTransmissible, id: string): Promise<void> {
  if (!TABLES_TRANSMISSIBLES.includes(table)) {
    throw new Error("Table non transmissible.");
  }
  const s = await creerClientServeur();
  const { error } = await s
    .from(table)
    .update({ transmission: "brouillon", transmis_le: null })
    .eq("id", id)
    .eq("transmission", "envoye");
  if (error) throw new Error(error.message);
}
