/**
 * T4 — Salaires & charges sociales.
 *
 * Pour chaque poste : brut annuel = brut mensuel x nombre x 12 ; charges
 * patronales = brut x taux (PARAMETRABLE — voir parametres.chargesSocialesPatronales,
 * a valider par un expert paie SN) ; cout employeur = brut + charges.
 *
 * Le salaire du dirigeant est traite comme un poste dedie. NB : le regime social
 * d'un gerant majoritaire peut differer — taux a valider par un expert.
 *
 * Projection 5 ans : cout employeur constant (pas d'inflation salariale en v1).
 */

import type { PostePersonnel, SalaireDirigeant } from "../types/dossier-input.js";
import type { Serie5FCFA, Taux } from "../types/money.js";
import type { T4, T4LignePoste } from "../types/dossier-output.js";
import { arrondiFCFA } from "./arrondi.js";

export interface OptionsSalaires {
  tauxChargesPatronales: Taux;
}

export function calculerSalaires(
  personnel: PostePersonnel[],
  dirigeant: SalaireDirigeant | null | undefined,
  options: OptionsSalaires,
): T4 {
  const taux = options.tauxChargesPatronales;

  const postes = personnel.map((p) =>
    ligne(p.intitule, p.nombre ?? 1, p.salaireBrutMensuel, taux),
  );

  const ligneDirigeant = dirigeant
    ? ligne("Dirigeant", 1, dirigeant.montantMensuel, taux)
    : null;

  const toutes = ligneDirigeant ? [...postes, ligneDirigeant] : postes;
  const totalBrutAnnuel = somme(toutes, (l) => l.salaireBrutAnnuel);
  const totalChargesPatronales = somme(toutes, (l) => l.chargesPatronales);
  const totalCoutEmployeur = somme(toutes, (l) => l.coutTotalAnnuel);

  const coutEmployeurParAn: Serie5FCFA = [
    totalCoutEmployeur,
    totalCoutEmployeur,
    totalCoutEmployeur,
    totalCoutEmployeur,
    totalCoutEmployeur,
  ];

  return {
    postes,
    dirigeant: ligneDirigeant,
    tauxChargesPatronales: taux,
    totalBrutAnnuel,
    totalChargesPatronales,
    totalCoutEmployeur,
    coutEmployeurParAn,
  };
}

function ligne(
  intitule: string,
  nombre: number,
  salaireBrutMensuel: number,
  taux: Taux,
): T4LignePoste {
  const salaireBrutAnnuel = arrondiFCFA(salaireBrutMensuel * nombre * 12);
  const chargesPatronales = arrondiFCFA(salaireBrutAnnuel * taux);
  const coutTotalAnnuel = arrondiFCFA(salaireBrutAnnuel + chargesPatronales);
  return {
    intitule,
    nombre,
    salaireBrutMensuel: arrondiFCFA(salaireBrutMensuel),
    salaireBrutAnnuel,
    chargesPatronales,
    coutTotalAnnuel,
  };
}

function somme(lignes: T4LignePoste[], pick: (l: T4LignePoste) => number): number {
  return lignes.reduce((s, l) => s + pick(l), 0);
}
