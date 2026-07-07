/**
 * T3 — Echeancier d'emprunt.
 *
 * Deux methodes, choisies via parametres (aucune en dur) :
 *  - "annuites_constantes" (defaut) : annuite fixe ; la part d'interets decroit,
 *    la part de capital croit. Formule : a = C * i / (1 - (1+i)^-m).
 *  - "capital_constant" : capital rembourse fixe ; l'annuite totale decroit.
 *
 * Le calcul est fait au PAS MENSUEL (taux mensuel = taux annuel / 12), puis
 * agrege a l'annee. Le pas mensuel permet de gerer proprement le differe en mois
 * et d'alimenter la tresorerie (T9) avec un service mensuel pour l'annee 1.
 *
 * Differe = differe PARTIEL : pendant les `differeMois`, on paie les interets
 * mais aucun capital ; le capital est ensuite amorti sur les mois restants.
 * `dureeAnnees` est la duree TOTALE (differe inclus). Hypothese a valider.
 *
 * Arrondi : le schema mensuel reste en decimales ; chaque champ de sortie est
 * arrondi independamment via arrondiFCFA. De petits ecarts d'arrondi (+/-1 FCFA)
 * entre lignes sont possibles et acceptes pour un previsionnel.
 */

import type { Emprunt } from "../types/dossier-input.js";
import type { Serie5FCFA, Serie12, FCFA } from "../types/money.js";
import type { T3, T3LigneAnnuelle, MethodeAmortissementEmprunt } from "../types/dossier-output.js";
import { arrondiFCFA } from "./arrondi.js";

export interface OptionsEmprunt {
  methode: MethodeAmortissementEmprunt;
}

interface MoisEcheance {
  interet: number;
  capital: number;
  annuite: number;
  soldeApres: number;
}

export function calculerEmprunt(emprunt: Emprunt, options: OptionsEmprunt): T3 {
  const C = emprunt.montant;
  const tMensuel = emprunt.tauxAnnuel / 12;
  const N = emprunt.dureeAnnees;
  const n = Math.round(N * 12);
  // Differe borne : on garde au moins 1 mois d'amortissement du capital.
  const differe = Math.min(Math.max(0, Math.floor(emprunt.differeMois ?? 0)), Math.max(0, n - 1));
  const moisAmortissement = n - differe;

  const schema = construireSchemaMensuel(C, tMensuel, n, differe, moisAmortissement, options.methode);

  // Agregation annuelle sur la duree complete de l'emprunt.
  const lignes: T3LigneAnnuelle[] = [];
  let totalInteretsExact = 0;
  for (let annee = 1; annee <= N; annee++) {
    const debut = (annee - 1) * 12;
    const fin = Math.min(annee * 12, n);
    const moisAnnee = schema.slice(debut, fin);

    const interets = moisAnnee.reduce((s, mo) => s + mo.interet, 0);
    const capital = moisAnnee.reduce((s, mo) => s + mo.capital, 0);
    const annuite = moisAnnee.reduce((s, mo) => s + mo.annuite, 0);
    const capitalDebut = debut === 0 ? C : (schema[debut - 1]?.soldeApres ?? 0);
    const capitalRestant = moisAnnee.length > 0 ? moisAnnee[moisAnnee.length - 1]!.soldeApres : capitalDebut;
    totalInteretsExact += interets;

    lignes.push({
      annee,
      capitalDebutPeriode: arrondiFCFA(capitalDebut),
      interets: arrondiFCFA(interets),
      capitalRembourse: arrondiFCFA(capital),
      annuite: arrondiFCFA(annuite),
      capitalRestantDu: arrondiFCFA(Math.max(0, capitalRestant)),
    });
  }

  const interetsParAn = serie5DepuisLignes(lignes, (l) => l.interets);
  const capitalParAn = serie5DepuisLignes(lignes, (l) => l.capitalRembourse);
  const annuiteParAn = serie5DepuisLignes(lignes, (l) => l.annuite);

  const serviceMensuelAnnee1 = construireServiceMensuelAnnee1(schema);

  return {
    methode: options.methode,
    montant: arrondiFCFA(C),
    tauxAnnuel: emprunt.tauxAnnuel,
    dureeAnnees: N,
    differeMois: differe,
    lignes,
    interetsParAn,
    capitalParAn,
    annuiteParAn,
    totalInterets: arrondiFCFA(totalInteretsExact),
    serviceMensuelAnnee1,
  };
}

function construireSchemaMensuel(
  C: number,
  tMensuel: number,
  n: number,
  differe: number,
  moisAmortissement: number,
  methode: MethodeAmortissementEmprunt,
): MoisEcheance[] {
  const schema: MoisEcheance[] = [];
  let solde = C;

  // Annuite constante calculee sur le capital restant a la fin du differe (= C,
  // car aucun capital n'est rembourse pendant le differe).
  const annuiteConstante =
    tMensuel === 0
      ? C / moisAmortissement
      : (C * tMensuel) / (1 - Math.pow(1 + tMensuel, -moisAmortissement));
  const capitalConstantParMois = C / moisAmortissement;

  for (let mois = 1; mois <= n; mois++) {
    const interet = solde * tMensuel;
    let capital: number;

    if (mois <= differe) {
      // Differe partiel : interets seulement, pas de capital.
      capital = 0;
    } else if (methode === "annuites_constantes") {
      capital = annuiteConstante - interet;
    } else {
      capital = capitalConstantParMois;
    }

    // Derniere echeance : solder exactement le capital restant (corrige le fp).
    if (mois === n) {
      capital = solde;
    }

    solde = solde - capital;
    schema.push({ interet, capital, annuite: interet + capital, soldeApres: solde });
  }

  return schema;
}

function construireServiceMensuelAnnee1(schema: MoisEcheance[]): Serie12<FCFA> {
  const service = [] as unknown as Serie12<FCFA>;
  for (let i = 0; i < 12; i++) {
    service[i] = arrondiFCFA(schema[i]?.annuite ?? 0);
  }
  return service;
}

function serie5DepuisLignes(
  lignes: T3LigneAnnuelle[],
  pick: (l: T3LigneAnnuelle) => FCFA,
): Serie5FCFA {
  const serie: Serie5FCFA = [0, 0, 0, 0, 0];
  for (let i = 0; i < 5; i++) {
    const ligne = lignes[i];
    serie[i] = ligne ? pick(ligne) : 0;
  }
  return serie;
}
