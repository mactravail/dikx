"use server";

/**
 * Persistance du module TRESORERIE dans Supabase (tables 0007), sous RLS :
 * lecture/ecriture des SAISIES (comptes + mouvements) scopees par entreprise.
 * `entrepriseId` est passe par le client mais REVALIDE par la RLS
 * (peut_acceder) : un membre ne peut pas forger l'id d'une autre entreprise.
 *
 * Aucun calcul monetaire ici : ce sont des saisies brutes. Les soldes/totaux
 * affiches restent produits par le moteur (calculerTresorerie), cote serveur.
 */
import { creerClientServeur } from "@/lib/supabase/server";
import { roleCourantServeur } from "@/lib/roles-serveur";
import type { CompteTresorerieLocal, MouvementLocal } from "@/lib/tresorerie-data";
import type { TypeCompteTresorerie, SensMouvement } from "@/lib/engine";
import type { EtatTransmission } from "@/lib/transmission";

/** Etat de transmission a poser a l'insert d'un mouvement selon le role (cf. 0013). */
function transmissionInitiale(role: string): { transmission: "brouillon" | "envoye"; transmis_le: string | null } {
  return role === "comptable"
    ? { transmission: "envoye", transmis_le: new Date().toISOString() }
    : { transmission: "brouillon", transmis_le: null };
}

const MSG_VERROU_MVT = "Ce mouvement a deja ete envoye au comptable. Rappelez-le pour le modifier.";

interface CompteRow {
  id: string;
  nom: string;
  type: TypeCompteTresorerie;
  operateur: string | null;
  solde_initial: number;
}
interface MouvementRow {
  id: string;
  compte_id: string;
  date_mouvement: string;
  sens: SensMouvement;
  montant: number;
  categorie: string;
  motif: string | null;
  transmission: EtatTransmission;
}

const COLS_COMPTE = "id,nom,type,operateur,solde_initial";
const COLS_MVT = "id,compte_id,date_mouvement,sens,montant,categorie,motif,transmission";

function versCompte(r: CompteRow): CompteTresorerieLocal {
  return { id: r.id, nom: r.nom, type: r.type, operateur: r.operateur ?? undefined, soldeInitial: r.solde_initial };
}
function versMouvement(r: MouvementRow): MouvementLocal {
  return {
    id: r.id,
    compteId: r.compte_id,
    date: r.date_mouvement,
    sens: r.sens,
    montant: r.montant,
    categorie: r.categorie,
    motif: r.motif ?? "",
    transmission: r.transmission,
  };
}

export async function listerComptesAction(entrepriseId: string): Promise<CompteTresorerieLocal[]> {
  if (!entrepriseId) return [];
  const s = await creerClientServeur();
  const { data, error } = await s
    .from("comptes_tresorerie")
    .select(COLS_COMPTE)
    .eq("entreprise_id", entrepriseId)
    .eq("actif", true)
    .order("created_at");
  if (error || !data) return [];
  return (data as unknown as CompteRow[]).map(versCompte);
}

export async function listerMouvementsAction(entrepriseId: string): Promise<MouvementLocal[]> {
  if (!entrepriseId) return [];
  const s = await creerClientServeur();
  const { data, error } = await s
    .from("mouvements_tresorerie")
    .select(COLS_MVT)
    .eq("entreprise_id", entrepriseId)
    .order("date_mouvement", { ascending: false });
  if (error || !data) return [];
  return (data as unknown as MouvementRow[]).map(versMouvement);
}

export async function upsertCompteAction(
  entrepriseId: string,
  c: CompteTresorerieLocal,
): Promise<CompteTresorerieLocal> {
  const s = await creerClientServeur();
  const champs = {
    nom: c.nom.trim(),
    type: c.type,
    operateur: c.operateur?.trim() || null,
    solde_initial: Math.round(c.soldeInitial),
  };
  if (c.id) {
    const { data, error } = await s
      .from("comptes_tresorerie")
      .update(champs)
      .eq("id", c.id)
      .select(COLS_COMPTE)
      .single();
    if (error || !data) throw new Error(error?.message ?? "Enregistrement du compte impossible.");
    return versCompte(data as unknown as CompteRow);
  }
  const { data, error } = await s
    .from("comptes_tresorerie")
    .insert({ entreprise_id: entrepriseId, ...champs })
    .select(COLS_COMPTE)
    .single();
  if (error || !data) throw new Error(error?.message ?? "Creation du compte impossible.");
  return versCompte(data as unknown as CompteRow);
}

export async function supprimerCompteAction(id: string): Promise<void> {
  const s = await creerClientServeur();
  const { error } = await s.from("comptes_tresorerie").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function enregistrerMouvementAction(
  entrepriseId: string,
  m: MouvementLocal,
): Promise<MouvementLocal> {
  const s = await creerClientServeur();
  const role = await roleCourantServeur();
  const champs = {
    compte_id: m.compteId,
    date_mouvement: m.date,
    sens: m.sens,
    montant: Math.round(m.montant),
    categorie: m.categorie,
    motif: m.motif?.trim() || null,
  };
  if (m.id) {
    // Verrou : l'entreprise ne modifie qu'un mouvement en brouillon (rappel sinon).
    let q = s.from("mouvements_tresorerie").update(champs).eq("id", m.id);
    if (role !== "comptable") q = q.eq("transmission", "brouillon");
    const { data, error } = await q.select(COLS_MVT).single();
    if (error || !data) {
      throw new Error(role !== "comptable" ? MSG_VERROU_MVT : (error?.message ?? "Enregistrement du mouvement impossible."));
    }
    return versMouvement(data as unknown as MouvementRow);
  }
  const { data, error } = await s
    .from("mouvements_tresorerie")
    .insert({ entreprise_id: entrepriseId, ...champs, ...transmissionInitiale(role) })
    .select(COLS_MVT)
    .single();
  if (error || !data) throw new Error(error?.message ?? "Creation du mouvement impossible.");
  return versMouvement(data as unknown as MouvementRow);
}

export async function supprimerMouvementAction(id: string): Promise<void> {
  const s = await creerClientServeur();
  const role = await roleCourantServeur();
  let q = s.from("mouvements_tresorerie").delete().eq("id", id);
  if (role !== "comptable") q = q.eq("transmission", "brouillon");
  const { data, error } = await q.select("id");
  if (error) throw new Error(error.message);
  if (role !== "comptable" && (!data || data.length === 0)) throw new Error(MSG_VERROU_MVT);
}
