"use server";

/**
 * Persistance du module ACHATS dans Supabase (tables `commandes_achat` +
 * `lignes_commande_achat`, 0005 + entreprise_id 0014), sous RLS scopee par
 * entreprise.
 *
 * Une commande porte ses lignes. Les totaux (HT, TVA deductible, TTC, reste a
 * payer) et les montants de ligne sont un SNAPSHOT calcule PAR LE MOTEUR cote
 * serveur (calculerCommande), jamais dans le navigateur. Le taux de TVA par
 * defaut vient des PARAMETRES.
 */
import { creerClientServeur } from "@/lib/supabase/server";
import { calculerCommande, PARAMETRES } from "@/lib/engine";
import type { CommandeLocal, LigneCommandeLocal } from "@/lib/achats-stock-data";
import type { StatutCommande, CommandeAchatCalc } from "@/lib/engine";

interface LigneRow {
  id: string;
  designation: string;
  quantite: number | string;
  quantite_recue: number | string;
  prix_unitaire_ht: number;
  position: number;
}
interface CommandeRow {
  id: string;
  numero: string;
  fournisseur: string;
  date_commande: string;
  statut: StatutCommande;
  assujetti_tva: boolean;
  montant_paye: number;
  total_ttc: number;
  reste_a_payer: number;
  lignes_commande_achat?: LigneRow[];
}

const COLS =
  "id,numero,fournisseur,date_commande,statut,assujetti_tva,montant_paye,total_ttc,reste_a_payer," +
  "lignes_commande_achat(id,designation,quantite,quantite_recue,prix_unitaire_ht,position)";

function versLigne(r: LigneRow): LigneCommandeLocal {
  return {
    id: r.id,
    designation: r.designation,
    quantite: Number(r.quantite),
    quantiteRecue: Number(r.quantite_recue),
    prixUnitaireHT: Number(r.prix_unitaire_ht),
  };
}

function versCommande(r: CommandeRow): CommandeLocal {
  const lignes = (r.lignes_commande_achat ?? [])
    .slice()
    .sort((a, b) => a.position - b.position)
    .map(versLigne);
  return {
    id: r.id,
    numero: r.numero,
    fournisseur: r.fournisseur,
    date: r.date_commande,
    statut: r.statut,
    assujettiTVA: r.assujetti_tva,
    montantPaye: Number(r.montant_paye),
    lignes,
    totalTTC: Number(r.total_ttc),
    resteAPayer: Number(r.reste_a_payer),
  };
}

/** Snapshot moteur d'une commande (totaux + montants de ligne). */
function snapshot(c: CommandeLocal): CommandeAchatCalc {
  return calculerCommande(
    {
      fournisseur: c.fournisseur,
      statut: c.statut,
      assujettiTVA: c.assujettiTVA,
      montantPaye: c.montantPaye,
      lignes: c.lignes.map((l) => ({
        designation: l.designation,
        quantite: l.quantite,
        quantiteRecue: l.quantiteRecue,
        prixUnitaireHT: l.prixUnitaireHT,
      })),
    },
    { tauxTVADefaut: PARAMETRES.tva.taux },
  );
}

export async function listerCommandesAction(entrepriseId: string): Promise<CommandeLocal[]> {
  if (!entrepriseId) return [];
  const s = await creerClientServeur();
  const { data, error } = await s
    .from("commandes_achat")
    .select(COLS)
    .eq("entreprise_id", entrepriseId)
    .order("date_commande", { ascending: false });
  if (error || !data) return [];
  return (data as unknown as CommandeRow[]).map(versCommande);
}

export async function upsertCommandeAction(entrepriseId: string, c: CommandeLocal): Promise<CommandeLocal> {
  const s = await creerClientServeur();
  const snap = snapshot(c);
  const champs = {
    numero: c.numero.trim(),
    fournisseur: c.fournisseur.trim(),
    date_commande: c.date,
    statut: c.statut,
    assujetti_tva: c.assujettiTVA,
    montant_paye: Math.max(0, Math.round(c.montantPaye)),
    total_ht: snap.totalHT,
    total_tva: snap.totalTVA,
    total_ttc: snap.totalTTC,
    reste_a_payer: snap.resteAPayer,
  };

  let commandeId = c.id;
  if (commandeId) {
    const { error } = await s.from("commandes_achat").update(champs).eq("id", commandeId);
    if (error) throw new Error(error.message);
    await s.from("lignes_commande_achat").delete().eq("commande_id", commandeId);
  } else {
    const { data, error } = await s
      .from("commandes_achat")
      .insert({ entreprise_id: entrepriseId, ...champs })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "Creation de la commande impossible.");
    commandeId = (data as { id: string }).id;
  }

  // Lignes : montants = snapshot du moteur (meme ordre que la saisie).
  const rows = c.lignes.map((l, i) => {
    const sl = snap.lignes[i];
    return {
      entreprise_id: entrepriseId,
      commande_id: commandeId,
      designation: l.designation.trim(),
      quantite: l.quantite,
      quantite_recue: l.quantiteRecue,
      prix_unitaire_ht: Math.max(0, Math.round(l.prixUnitaireHT)),
      taux_tva: sl?.tauxTVA ?? null,
      montant_ht: sl?.montantHT ?? 0,
      montant_tva: sl?.montantTVA ?? 0,
      montant_ttc: sl?.montantTTC ?? 0,
      position: i,
    };
  });
  if (rows.length > 0) {
    const { error } = await s.from("lignes_commande_achat").insert(rows);
    if (error) throw new Error(error.message);
  }

  const { data } = await s.from("commandes_achat").select(COLS).eq("id", commandeId).single();
  return versCommande(data as unknown as CommandeRow);
}

export async function supprimerCommandeAction(id: string): Promise<void> {
  const s = await creerClientServeur();
  const { error } = await s.from("commandes_achat").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
