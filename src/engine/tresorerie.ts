/**
 * T9 — Budget de tresorerie mensuel (12 mois, annee 1).
 *
 * Encaissements : CA TTC (decale du delai client), apports, deblocage emprunt,
 *                 subvention (apports/emprunt/subvention au mois 1).
 * Decaissements : investissements TTC (mois 1), achats TTC (decales du delai
 *                 fournisseur), charges externes, salaires (cout employeur),
 *                 echeance d'emprunt (capital+interets), TVA nette, IS.
 *
 * Modele TVA (si assujetti) : les flux d'achats/ventes/investissements sont en
 * TTC, et la TVA nette due a l'Etat (collectee - deductible) est decaissee a part.
 * Globalement la TVA est NEUTRE sur la marge (seul le timing joue). Base
 * "sur les debits" : TVA reconnue au mois de la facture, pas de l'encaissement.
 * Credit de TVA reporte sur le mois suivant.
 *
 * IS : paye en N+1 sur le benefice de N => 0 dans le budget de l'annee 1.
 *
 * Delais : convertis en mois entiers par arrondi (jours / 30). Hypothese a valider.
 *
 * Tout montant de sortie est arrondi (arrondiSerie12 / arrondiFCFA).
 */

import type { FCFA, Serie12, Taux } from "../types/money.js";
import type { T9 } from "../types/dossier-output.js";
import { arrondiFCFA, arrondiSerie12 } from "./arrondi.js";

const MOIS = 12;

export interface EntreeTresorerie {
  caMensuelAnnee1: Serie12<FCFA>; // HT
  achatsMensuelAnnee1: Serie12<FCFA>; // HT
  chargesExternesMensuelAnnee1: Serie12<FCFA>; // payees telles quelles (TVA non modelisee dessus)
  salairesMensuelAnnee1: Serie12<FCFA>; // cout employeur mensuel
  serviceEmpruntMensuelAnnee1: Serie12<FCFA>; // capital + interets
  investissementsTotalHT: FCFA;
  apportsTotal: FCFA; // capital + compte courant
  empruntMontant: FCFA;
  subvention: FCFA;
}

export interface OptionsTresorerie {
  assujettiTVA: boolean;
  tauxTVA: Taux;
  delaiClientsJours: number;
  delaiFournisseursJours: number;
  soldeInitial?: FCFA;
}

export function calculerTresorerie(e: EntreeTresorerie, options: OptionsTresorerie): T9 {
  const coeffTTC = options.assujettiTVA ? 1 + options.tauxTVA : 1;
  const taux = options.assujettiTVA ? options.tauxTVA : 0;
  const decalClients = Math.round(options.delaiClientsJours / 30);
  const decalFourn = Math.round(options.delaiFournisseursJours / 30);

  // --- Encaissements ---
  const caTTCExact = e.caMensuelAnnee1.map((v) => v * coeffTTC);
  const encaissementsCAExact = decaler(caTTCExact, decalClients);

  const encaissementsApportsExact = mois1Seulement(e.apportsTotal);
  const encaissementsEmpruntExact = mois1Seulement(e.empruntMontant);
  const encaissementsSubventionExact = mois1Seulement(e.subvention);

  // --- Decaissements ---
  const investTTC = e.investissementsTotalHT * coeffTTC;
  const decaissementsInvestExact = mois1Seulement(investTTC);

  const achatsTTCExact = e.achatsMensuelAnnee1.map((v) => v * coeffTTC);
  const decaissementsAchatsExact = decaler(achatsTTCExact, decalFourn);

  // --- TVA nette (base facture, credit reporte) ---
  const decaissementsTVAExact = new Array<number>(MOIS).fill(0);
  let reportTVA = 0;
  for (let m = 0; m < MOIS; m++) {
    const collectee = taux * (e.caMensuelAnnee1[m] ?? 0);
    const deductible =
      taux * ((e.achatsMensuelAnnee1[m] ?? 0) + (m === 0 ? e.investissementsTotalHT : 0));
    const dueBrut = collectee - deductible + reportTVA;
    if (dueBrut >= 0) {
      decaissementsTVAExact[m] = dueBrut;
      reportTVA = 0;
    } else {
      decaissementsTVAExact[m] = 0;
      reportTVA = dueBrut; // credit (negatif) reporte
    }
  }

  // --- Series arrondies ---
  const encaissementsCA = arrondiSerie12(encaissementsCAExact);
  const encaissementsApports = arrondiSerie12(encaissementsApportsExact);
  const encaissementsEmprunt = arrondiSerie12(encaissementsEmpruntExact);
  const encaissementsSubvention = arrondiSerie12(encaissementsSubventionExact);

  const decaissementsInvestissements = arrondiSerie12(decaissementsInvestExact);
  const decaissementsAchats = arrondiSerie12(decaissementsAchatsExact);
  const decaissementsChargesExternes = arrondiSerie12([...e.chargesExternesMensuelAnnee1]);
  const decaissementsSalaires = arrondiSerie12([...e.salairesMensuelAnnee1]);
  const decaissementsEmprunt = arrondiSerie12([...e.serviceEmpruntMensuelAnnee1]);
  const decaissementsTVA = arrondiSerie12(decaissementsTVAExact);
  const decaissementsIS = arrondiSerie12(new Array<number>(MOIS).fill(0));

  const totalEncaissements = sommeSeries([
    encaissementsCA,
    encaissementsApports,
    encaissementsEmprunt,
    encaissementsSubvention,
  ]);
  const totalDecaissements = sommeSeries([
    decaissementsInvestissements,
    decaissementsAchats,
    decaissementsChargesExternes,
    decaissementsSalaires,
    decaissementsEmprunt,
    decaissementsTVA,
    decaissementsIS,
  ]);

  const soldeInitial = arrondiFCFA(options.soldeInitial ?? 0);
  const soldeMensuel = [] as unknown as Serie12<FCFA>;
  const soldeCumule = [] as unknown as Serie12<FCFA>;
  let cumul = soldeInitial;
  for (let m = 0; m < MOIS; m++) {
    soldeMensuel[m] = (totalEncaissements[m] ?? 0) - (totalDecaissements[m] ?? 0);
    cumul += soldeMensuel[m]!;
    soldeCumule[m] = cumul;
  }

  return {
    soldeInitial,
    encaissementsCA,
    encaissementsApports,
    encaissementsEmprunt,
    encaissementsSubvention,
    totalEncaissements,
    decaissementsInvestissements,
    decaissementsAchats,
    decaissementsChargesExternes,
    decaissementsSalaires,
    decaissementsEmprunt,
    decaissementsTVA,
    decaissementsIS,
    totalDecaissements,
    soldeMensuel,
    soldeCumule,
  };
}

/** Decale une serie de `n` mois vers la droite (les sorties avant index 0 sont perdues). */
function decaler(serie: number[], n: number): number[] {
  const out = new Array<number>(MOIS).fill(0);
  for (let m = 0; m < MOIS; m++) {
    const src = m - n;
    if (src >= 0 && src < MOIS) out[m] = serie[src] ?? 0;
  }
  return out;
}

function mois1Seulement(valeur: number): number[] {
  const out = new Array<number>(MOIS).fill(0);
  out[0] = valeur;
  return out;
}

function sommeSeries(series: Array<Serie12<FCFA>>): Serie12<FCFA> {
  const out = [] as unknown as Serie12<FCFA>;
  for (let m = 0; m < MOIS; m++) {
    out[m] = series.reduce((s, serie) => s + (serie[m] ?? 0), 0);
  }
  return out;
}
