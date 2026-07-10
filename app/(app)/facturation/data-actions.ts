"use server";

/**
 * Persistance du module FACTURATION dans Supabase (tables `documents` +
 * `lignes_document`, 0002 + colonnes/scope 0012), sous RLS scopee par entreprise.
 *
 * Les totaux (HT, TVA, TTC) sont calcules PAR LE MOTEUR cote serveur
 * (calculerDocument) a l'ecriture, jamais dans le navigateur. Les acomptes sont
 * portes par documents.montant_paye (saisie).
 */
import { creerClientServeur } from "@/lib/supabase/server";
import { roleCourantServeur } from "@/lib/roles-serveur";
import { calculerDocument, PARAMETRES } from "@/lib/engine";
import type { DocumentLocal, LigneLocal, StatutDocument } from "@/lib/ventes-data";
import type { EtatTransmission } from "@/lib/transmission";

/** Etat de transmission a poser a l'insert d'un document selon le role (cf. 0013). */
function transmissionInitiale(role: string): { transmission: "brouillon" | "envoye"; transmis_le: string | null } {
  return role === "comptable"
    ? { transmission: "envoye", transmis_le: new Date().toISOString() }
    : { transmission: "brouillon", transmis_le: null };
}

const MSG_VERROU_DOC = "Ce document a deja ete envoye au comptable. Rappelez-le pour le modifier.";

interface LigneRow {
  ordre: number;
  designation: string;
  quantite: number | string;
  prix_unitaire_ht: number;
  taux_tva: number | string;
  remise_pct: number | string;
}
interface DocumentRow {
  id: string;
  type: DocumentLocal["type"];
  numero: string;
  client_id: string | null;
  client_nom: string | null;
  date_emission: string;
  statut: StatutDocument;
  assujetti_tva: boolean;
  remise_globale_pct: number | string;
  montant_paye: number;
  total_ht: number;
  total_tva: number;
  total_ttc: number;
  transmission: EtatTransmission;
  lignes_document?: LigneRow[];
}

const COLS =
  "id,type,numero,client_id,client_nom,date_emission,statut,assujetti_tva,remise_globale_pct,montant_paye,total_ht,total_tva,total_ttc,transmission,lignes_document(ordre,designation,quantite,prix_unitaire_ht,taux_tva,remise_pct)";

function versLigne(r: LigneRow): LigneLocal {
  return {
    designation: r.designation,
    quantite: Number(r.quantite),
    prixUnitaireHT: Number(r.prix_unitaire_ht),
    tauxTVA: Number(r.taux_tva),
    remisePct: Number(r.remise_pct),
  };
}

function versDocument(r: DocumentRow): DocumentLocal {
  const lignes = (r.lignes_document ?? [])
    .slice()
    .sort((a, b) => a.ordre - b.ordre)
    .map(versLigne);
  return {
    id: r.id,
    type: r.type,
    numero: r.numero,
    clientId: r.client_id,
    clientNom: r.client_nom ?? "",
    dateEmission: r.date_emission,
    statut: r.statut,
    assujettiTVA: r.assujetti_tva,
    remiseGlobalePct: Number(r.remise_globale_pct),
    lignes,
    montantPaye: Number(r.montant_paye),
    totalHT: Number(r.total_ht),
    totalTVA: Number(r.total_tva),
    totalTTC: Number(r.total_ttc),
    transmission: r.transmission,
  };
}

function snapshot(d: DocumentLocal): { totalHT: number; totalTVA: number; totalTTC: number } {
  const calc = calculerDocument(
    {
      type: d.type,
      assujettiTVA: d.assujettiTVA,
      remiseGlobalePct: d.remiseGlobalePct,
      montantPaye: d.montantPaye,
      lignes: d.lignes.map((l) => ({
        designation: l.designation,
        quantite: l.quantite,
        prixUnitaireHT: l.prixUnitaireHT,
        tauxTVA: l.tauxTVA,
        remisePct: l.remisePct,
      })),
    },
    { tauxTVADefaut: PARAMETRES.tva.taux },
  );
  return { totalHT: calc.totalHT, totalTVA: calc.totalTVA, totalTTC: calc.totalTTC };
}

export async function listerDocumentsAction(entrepriseId: string): Promise<DocumentLocal[]> {
  if (!entrepriseId) return [];
  const s = await creerClientServeur();
  const { data, error } = await s
    .from("documents")
    .select(COLS)
    .eq("entreprise_id", entrepriseId)
    .order("date_emission", { ascending: false });
  if (error || !data) return [];
  return (data as unknown as DocumentRow[]).map(versDocument);
}

export async function upsertDocumentAction(entrepriseId: string, d: DocumentLocal): Promise<DocumentLocal> {
  const s = await creerClientServeur();
  const role = await roleCourantServeur();
  const snap = snapshot(d);
  const champs = {
    type: d.type,
    numero: d.numero,
    client_id: d.clientId || null,
    client_nom: d.clientNom?.trim() || null,
    date_emission: d.dateEmission,
    statut: d.statut,
    assujetti_tva: d.assujettiTVA,
    remise_globale_pct: d.remiseGlobalePct,
    montant_paye: Math.round(d.montantPaye),
    total_ht: snap.totalHT,
    total_tva: snap.totalTVA,
    total_ttc: snap.totalTTC,
  };

  let docId = d.id;
  if (docId) {
    // Verrou : l'entreprise ne modifie qu'un document en brouillon (rappel sinon).
    let q = s.from("documents").update(champs).eq("id", docId);
    if (role !== "comptable") q = q.eq("transmission", "brouillon");
    const { data, error } = await q.select("id");
    if (error) throw new Error(error.message);
    if (role !== "comptable" && (!data || data.length === 0)) throw new Error(MSG_VERROU_DOC);
  } else {
    const { data, error } = await s
      .from("documents")
      .insert({ entreprise_id: entrepriseId, ...champs, ...transmissionInitiale(role) })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "Creation du document impossible.");
    docId = (data as { id: string }).id;
  }

  // Remplace les lignes (approche simple : purge + reinsertion ordonnee).
  await s.from("lignes_document").delete().eq("document_id", docId);
  if (d.lignes.length > 0) {
    const lignes = d.lignes.map((l, i) => ({
      document_id: docId,
      entreprise_id: entrepriseId,
      ordre: i,
      designation: l.designation,
      quantite: l.quantite,
      prix_unitaire_ht: Math.round(l.prixUnitaireHT),
      taux_tva: l.tauxTVA,
      remise_pct: l.remisePct,
    }));
    const { error } = await s.from("lignes_document").insert(lignes);
    if (error) throw new Error(error.message);
  }

  return { ...d, id: docId, totalHT: snap.totalHT, totalTVA: snap.totalTVA, totalTTC: snap.totalTTC };
}

export async function supprimerDocumentAction(id: string): Promise<void> {
  const s = await creerClientServeur();
  const role = await roleCourantServeur();
  let q = s.from("documents").delete().eq("id", id);
  if (role !== "comptable") q = q.eq("transmission", "brouillon");
  const { data, error } = await q.select("id");
  if (error) throw new Error(error.message);
  if (role !== "comptable" && (!data || data.length === 0)) throw new Error(MSG_VERROU_DOC);
}
