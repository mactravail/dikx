"use server";

/**
 * VUE PORTEFEUILLE (comptable) — agrege les saisies de TOUTES les entreprises
 * du cabinet en une seule vue d'ensemble.
 *
 * La RLS (0006 + helpers 0009) fait qu'une seule requete par table renvoie
 * uniquement les lignes des entreprises du comptable ; on regroupe ensuite par
 * `entreprise_id` cote serveur.
 *
 * Regle raktak : aucun montant n'est calcule dans le navigateur. TOUTE somme
 * (par entreprise ET totaux du portefeuille) est faite ICI, cote serveur :
 *  - la tresorerie disponible passe par le MOTEUR teste (calculerTresorerie) ;
 *  - charges / masse salariale / valeur de stock / CA facture somment des
 *    SNAPSHOTS deja produits par les moteurs a l'ecriture (montant_ttc,
 *    cout_employeur, valeur_stock, total_ttc), jamais un total forge par l'UI.
 * Le composant client ne fait qu'AFFICHER ce que cette action renvoie.
 */

import { creerClientServeur } from "@/lib/supabase/server";
import { chargerEntreprises } from "@/lib/entreprise-serveur";
import { calculerTresorerie } from "@/lib/engine";
import type {
  CompteTresorerieInput,
  MouvementTresorerieInput,
  RegimeComptable,
  RegimeFiscal,
} from "@/lib/engine";

export interface LignePortefeuille {
  entrepriseId: string;
  raisonSociale: string;
  regimeComptable: RegimeComptable;
  regimeFiscal: RegimeFiscal;
  tresorerie: number; // disponible (moteur)
  effectif: number; // employes actifs
  masseSalariale: number; // Σ cout employeur mensuel (snapshot)
  charges: number; // Σ TTC des depenses (snapshot)
  valeurStock: number; // Σ valeur de stock (snapshot)
  caFacture: number; // Σ TTC des factures (snapshot)
}

export interface TotauxPortefeuille {
  tresorerie: number;
  effectif: number;
  masseSalariale: number;
  charges: number;
  valeurStock: number;
  caFacture: number;
}

export interface Portefeuille {
  lignes: LignePortefeuille[];
  totaux: TotauxPortefeuille;
  nombreEntreprises: number;
}

/* --------------------------------- rows --------------------------------- */

interface CompteRow {
  id: string;
  entreprise_id: string;
  nom: string;
  type: CompteTresorerieInput["type"];
  operateur: string | null;
  solde_initial: number;
}
interface MvtRow {
  entreprise_id: string;
  compte_id: string;
  sens: MouvementTresorerieInput["sens"];
  montant: number;
  categorie: string;
}
interface MontantRow {
  entreprise_id: string;
  montant: number;
}
interface DocRow {
  entreprise_id: string;
  type: "devis" | "facture" | "avoir";
  total_ttc: number;
}

/** Regroupe des lignes par entreprise (index rapide, ordre indifferent). */
function grouper<T extends { entreprise_id: string }>(rows: T[]): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const arr = m.get(r.entreprise_id);
    if (arr) arr.push(r);
    else m.set(r.entreprise_id, [r]);
  }
  return m;
}

function somme<T>(rows: T[] | undefined, valeur: (r: T) => number): number {
  return (rows ?? []).reduce((s, r) => s + (Number(valeur(r)) || 0), 0);
}

const TOTAUX_VIDES: TotauxPortefeuille = {
  tresorerie: 0,
  effectif: 0,
  masseSalariale: 0,
  charges: 0,
  valeurStock: 0,
  caFacture: 0,
};

/**
 * Agrege le portefeuille du comptable connecte. Degrade proprement (portefeuille
 * vide) si les tables/migrations ne sont pas encore en place.
 */
export async function chargerPortefeuilleAction(): Promise<Portefeuille> {
  const entreprises = await chargerEntreprises();
  if (entreprises.length === 0) {
    return { lignes: [], totaux: { ...TOTAUX_VIDES }, nombreEntreprises: 0 };
  }

  const s = await creerClientServeur();
  // Une requete par table : la RLS restreint deja aux entreprises du comptable.
  const [comptesR, mvtsR, depR, empR, artR, docR] = await Promise.all([
    s.from("comptes_tresorerie").select("id,entreprise_id,nom,type,operateur,solde_initial").eq("actif", true),
    s.from("mouvements_tresorerie").select("entreprise_id,compte_id,sens,montant,categorie"),
    s.from("depenses").select("entreprise_id,montant_ttc"),
    s.from("employes").select("entreprise_id,cout_employeur").eq("actif", true),
    s.from("articles").select("entreprise_id,valeur_stock"),
    s.from("documents").select("entreprise_id,type,total_ttc"),
  ]);

  const comptesParE = grouper((comptesR.data ?? []) as unknown as CompteRow[]);
  const mvtsParE = grouper((mvtsR.data ?? []) as unknown as MvtRow[]);
  const depParE = grouper((depR.data ?? []).map((r) => ({ entreprise_id: (r as { entreprise_id: string }).entreprise_id, montant: Number((r as { montant_ttc: number }).montant_ttc) })) as MontantRow[]);
  const empParE = grouper((empR.data ?? []).map((r) => ({ entreprise_id: (r as { entreprise_id: string }).entreprise_id, montant: Number((r as { cout_employeur: number }).cout_employeur) })) as MontantRow[]);
  const artParE = grouper((artR.data ?? []).map((r) => ({ entreprise_id: (r as { entreprise_id: string }).entreprise_id, montant: Number((r as { valeur_stock: number }).valeur_stock) })) as MontantRow[]);
  const docParE = grouper((docR.data ?? []) as unknown as DocRow[]);

  const lignes: LignePortefeuille[] = entreprises.map((e) => {
    // Tresorerie disponible : passe par le moteur (sommer des mouvements = calcul).
    const comptes: CompteTresorerieInput[] = (comptesParE.get(e.id) ?? []).map((c) => ({
      id: c.id,
      nom: c.nom,
      type: c.type,
      operateur: c.operateur ?? undefined,
      soldeInitial: Number(c.solde_initial),
    }));
    const mouvements: MouvementTresorerieInput[] = (mvtsParE.get(e.id) ?? []).map((m) => ({
      compteId: m.compte_id,
      sens: m.sens,
      montant: Number(m.montant),
      categorie: m.categorie,
    }));
    const tresorerie = calculerTresorerie(comptes, mouvements).totalDisponible;

    const emp = empParE.get(e.id) ?? [];
    return {
      entrepriseId: e.id,
      raisonSociale: e.raisonSociale,
      regimeComptable: e.regimeComptable,
      regimeFiscal: e.regimeFiscal,
      tresorerie,
      effectif: emp.length,
      masseSalariale: somme(emp, (r) => r.montant),
      charges: somme(depParE.get(e.id), (r) => r.montant),
      valeurStock: somme(artParE.get(e.id), (r) => r.montant),
      caFacture: somme(
        (docParE.get(e.id) ?? []).filter((d) => d.type === "facture"),
        (d) => Number(d.total_ttc),
      ),
    };
  });

  const totaux: TotauxPortefeuille = {
    tresorerie: somme(lignes, (l) => l.tresorerie),
    effectif: somme(lignes, (l) => l.effectif),
    masseSalariale: somme(lignes, (l) => l.masseSalariale),
    charges: somme(lignes, (l) => l.charges),
    valeurStock: somme(lignes, (l) => l.valeurStock),
    caFacture: somme(lignes, (l) => l.caFacture),
  };

  return { lignes, totaux, nombreEntreprises: entreprises.length };
}
