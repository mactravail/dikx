"use server";

/**
 * Persistance du module RAPPORT FINANCIER dans Supabase (table `rapport_financier`,
 * 0008 + policies RLS 0014), sous RLS scopee par entreprise. Un rapport est
 * unique par (entreprise, exercice) : editer l'exercice ouvre/cree le rapport de
 * cet exercice (historique multi-exercice).
 *
 * Aucun chiffre d'activite n'est stocke ici : les montants de l'exercice sont
 * TOUJOURS recalcules par les moteurs a l'affichage. On ne persiste que le
 * NARRATIF (texte), les parametres du rapport et les REFERENCES saisies (N-1,
 * budget) — des saisies, jamais des totaux calcules par l'UI.
 */
import { creerClientServeur } from "@/lib/supabase/server";
import type { RapportBrouillon, ComparatifSaisie } from "@/lib/rapport-data";

interface RapportRow {
  exercice: number;
  periode: string | null;
  lieu: string | null;
  date_presentation: string | null;
  faits_marquants: string | null;
  analyse_exploitation: string | null;
  analyse_ecarts: string | null;
  perspectives: string | null;
  conclusion: string | null;
  n1_chiffre_affaires: number | null;
  n1_total_produits: number | null;
  n1_total_charges: number | null;
  n1_resultat_net: number | null;
  budget_chiffre_affaires: number | null;
  budget_total_produits: number | null;
  budget_total_charges: number | null;
  budget_resultat_net: number | null;
}

const COLS =
  "exercice,periode,lieu,date_presentation,faits_marquants,analyse_exploitation,analyse_ecarts," +
  "perspectives,conclusion,n1_chiffre_affaires,n1_total_produits,n1_total_charges,n1_resultat_net," +
  "budget_chiffre_affaires,budget_total_produits,budget_total_charges,budget_resultat_net";

function comparatif(ca: number | null, tp: number | null, tc: number | null, rn: number | null): ComparatifSaisie {
  return {
    chiffreAffaires: Number(ca ?? 0),
    totalProduits: Number(tp ?? 0),
    totalCharges: Number(tc ?? 0),
    resultatNet: Number(rn ?? 0),
  };
}

function versBrouillon(r: RapportRow): RapportBrouillon {
  const comparerN1 = r.n1_chiffre_affaires != null || r.n1_total_produits != null ||
    r.n1_total_charges != null || r.n1_resultat_net != null;
  const comparerBudget = r.budget_chiffre_affaires != null || r.budget_total_produits != null ||
    r.budget_total_charges != null || r.budget_resultat_net != null;
  return {
    exercice: Number(r.exercice),
    periode: r.periode ?? "",
    lieu: r.lieu ?? "",
    datePresentation: r.date_presentation ?? "",
    faitsMarquants: r.faits_marquants ?? "",
    analyseExploitation: r.analyse_exploitation ?? "",
    analyseEcarts: r.analyse_ecarts ?? "",
    perspectives: r.perspectives ?? "",
    conclusion: r.conclusion ?? "",
    comparerN1,
    comparerBudget,
    exercicePrecedent: comparatif(r.n1_chiffre_affaires, r.n1_total_produits, r.n1_total_charges, r.n1_resultat_net),
    budget: comparatif(r.budget_chiffre_affaires, r.budget_total_produits, r.budget_total_charges, r.budget_resultat_net),
  };
}

/** Charge le rapport le plus recent de l'entreprise (null si aucun). */
export async function chargerRapportAction(entrepriseId: string): Promise<RapportBrouillon | null> {
  if (!entrepriseId) return null;
  const s = await creerClientServeur();
  const { data, error } = await s
    .from("rapport_financier")
    .select(COLS)
    .eq("entreprise_id", entrepriseId)
    .order("exercice", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return versBrouillon(data as unknown as RapportRow);
}

/** Enregistre (upsert par exercice) le brouillon de rapport de l'entreprise. */
export async function sauverRapportAction(entrepriseId: string, b: RapportBrouillon): Promise<void> {
  if (!entrepriseId) return;
  const s = await creerClientServeur();
  const n1 = b.comparerN1 ? b.exercicePrecedent : null;
  const bg = b.comparerBudget ? b.budget : null;
  const champs = {
    entreprise_id: entrepriseId,
    exercice: b.exercice,
    periode: b.periode || null,
    lieu: b.lieu || null,
    date_presentation: b.datePresentation || null,
    faits_marquants: b.faitsMarquants || null,
    analyse_exploitation: b.analyseExploitation || null,
    analyse_ecarts: b.analyseEcarts || null,
    perspectives: b.perspectives || null,
    conclusion: b.conclusion || null,
    n1_chiffre_affaires: n1 ? Math.round(n1.chiffreAffaires) : null,
    n1_total_produits: n1 ? Math.round(n1.totalProduits) : null,
    n1_total_charges: n1 ? Math.round(n1.totalCharges) : null,
    n1_resultat_net: n1 ? Math.round(n1.resultatNet) : null,
    budget_chiffre_affaires: bg ? Math.round(bg.chiffreAffaires) : null,
    budget_total_produits: bg ? Math.round(bg.totalProduits) : null,
    budget_total_charges: bg ? Math.round(bg.totalCharges) : null,
    budget_resultat_net: bg ? Math.round(bg.resultatNet) : null,
  };
  const { error } = await s
    .from("rapport_financier")
    .upsert(champs, { onConflict: "entreprise_id,exercice" });
  if (error) throw new Error(error.message);
}
