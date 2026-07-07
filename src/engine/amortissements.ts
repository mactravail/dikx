/**
 * T2 — Amortissements.
 *
 * Amortissement LINEAIRE : dotation annuelle = montant HT / duree, par poste.
 * Le terrain (duree 0) n'est pas amortissable.
 *
 * Arrondi : on calcule le cumul EXACT (decimal) puis on l'arrondit annee par
 * annee ; la dotation d'une annee = cumul arrondi(N) - cumul arrondi(N-1).
 * Cette technique garantit que la somme des dotations entieres egale exactement
 * le montant HT (pas de derive d'arrondi) et que la VNC tombe a 0 a la fin.
 * C'est le seul arrondi de ce module (via arrondiFCFA).
 */

import type { Investissement, NatureInvestissement } from "../types/dossier-input.js";
import type { Serie5FCFA, FCFA } from "../types/money.js";
import type { T2, T2LignePoste } from "../types/dossier-output.js";
import { arrondiFCFA } from "./arrondi.js";

const HORIZON = 5;

export interface OptionsAmortissements {
  dureesDefaut: Record<NatureInvestissement, number>;
}

export function calculerAmortissements(
  investissements: Investissement[],
  options: OptionsAmortissements,
): T2 {
  const postes = investissements.map((inv) => calculerPoste(inv, options));

  const totalDotations: Serie5FCFA = [0, 0, 0, 0, 0];
  for (const poste of postes) {
    for (let i = 0; i < HORIZON; i++) {
      totalDotations[i] = (totalDotations[i] ?? 0) + (poste.dotations[i] ?? 0);
    }
  }

  return { postes, totalDotations };
}

function calculerPoste(inv: Investissement, options: OptionsAmortissements): T2LignePoste {
  const duree = inv.dureeAmortissement ?? options.dureesDefaut[inv.nature] ?? 0;
  const montantHT = inv.montantHT;
  const amortissable = duree > 0 && montantHT > 0;

  const dotations: Serie5FCFA = [0, 0, 0, 0, 0];
  const cumul: Serie5FCFA = [0, 0, 0, 0, 0];
  const vnc: Serie5FCFA = [0, 0, 0, 0, 0];

  if (!amortissable) {
    // Non amortissable : VNC constante au montant HT.
    for (let i = 0; i < HORIZON; i++) {
      vnc[i] = arrondiFCFA(montantHT);
    }
    return ligne(inv, amortissable ? duree : 0, montantHT, dotations, cumul, vnc);
  }

  const dotationExacte = montantHT / duree;
  let cumulArrondiPrecedent = 0;
  for (let i = 0; i < HORIZON; i++) {
    const annee = i + 1;
    // Cumul exact plafonne au montant HT (au-dela de la duree, plus de dotation).
    const cumulExact = annee >= duree ? montantHT : dotationExacte * annee;
    const cumulArrondi = arrondiFCFA(cumulExact);
    cumul[i] = cumulArrondi;
    dotations[i] = cumulArrondi - cumulArrondiPrecedent;
    vnc[i] = arrondiFCFA(montantHT) - cumulArrondi;
    cumulArrondiPrecedent = cumulArrondi;
  }

  return ligne(inv, duree, montantHT, dotations, cumul, vnc);
}

function ligne(
  inv: Investissement,
  duree: number,
  montantHT: FCFA,
  dotations: Serie5FCFA,
  cumul: Serie5FCFA,
  vnc: Serie5FCFA,
): T2LignePoste {
  return {
    nature: inv.nature,
    libelle: inv.libelle ?? inv.nature,
    montantHT: arrondiFCFA(montantHT),
    dureeAmortissement: duree,
    amortissable: duree > 0 && montantHT > 0,
    dotations,
    cumul,
    vnc,
  };
}
