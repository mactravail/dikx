/**
 * Charges d'exploitation (helper, alimente T5, T6, IND).
 *
 * Classification (indispensable au seuil de rentabilite) :
 *  - VARIABLES (varient avec le CA) : achats de marchandises/matieres (4.1),
 *    transport/carburant (4.5).
 *  - FIXES : loyer, eau/electricite, telecom, assurances, honoraires, marketing,
 *    entretien (4.2-4.4, 4.6-4.9) et impots & taxes (4.10, ligne separee en T5).
 *
 * Projection 5 ans (hypotheses a valider, voir plan) :
 *  - charges variables proportionnelles au CA ;
 *  - charges fixes constantes, indexees par `inflationChargesFixes` (defaut 0).
 *
 * Toutes les valeurs de sortie sont arrondies (arrondiSerie5).
 */

import type { ChargesExploitation } from "../types/dossier-input.js";
import type { Serie5FCFA, Taux } from "../types/money.js";
import { arrondiSerie5 } from "./arrondi.js";

const HORIZON = 5;

export interface OptionsCharges {
  inflationChargesFixes: Taux;
}

export interface ResultatCharges {
  /** Achats consommes (variable) — ligne dediee de T5. */
  achatsConsommes: Serie5FCFA;
  /** Transport/carburant (variable) — inclus dans les charges externes. */
  transport: Serie5FCFA;
  /** Total charges variables = achats + transport. */
  chargesVariables: Serie5FCFA;
  /** Charges externes (T5) = part fixe (loyer...) + transport. */
  chargesExternes: Serie5FCFA;
  /** Part FIXE des charges externes (loyer, eau, telecom, assurances...). */
  chargesExternesFixes: Serie5FCFA;
  /** Impots & taxes (4.10) — ligne separee en T5. */
  impotsTaxes: Serie5FCFA;
}

export function calculerCharges(
  charges: ChargesExploitation,
  caParAn: Serie5FCFA,
  options: OptionsCharges,
): ResultatCharges {
  const ca0 = caParAn[0] || 0;
  // Facteur de proportion au CA par annee (1 pour l'annee 1).
  const facteurCA = caParAn.map((ca) => (ca0 > 0 ? ca / ca0 : 1));
  // Facteur d'inflation des charges fixes par annee.
  const facteurInfl = Array.from({ length: HORIZON }, (_, i) =>
    Math.pow(1 + options.inflationChargesFixes, i),
  );

  // --- Achats (variable) ---
  const achatsExact = caParAn.map((ca, i) => {
    if (charges.achatsMatieres.mode === "pourcentageCA") {
      return ca * charges.achatsMatieres.valeur;
    }
    return charges.achatsMatieres.valeur * (facteurCA[i] ?? 1);
  });

  // --- Transport (variable) ---
  const transportAnnuel = charges.transportCarburantAnnuel ?? 0;
  const transportExact = facteurCA.map((f) => transportAnnuel * f);

  // --- Charges externes fixes (mensuelles annualisees + annuelles) ---
  const externesFixesAnnee1 =
    (charges.loyerMensuel ?? 0) * 12 +
    (charges.eauElectriciteMensuel ?? 0) * 12 +
    (charges.telecomMensuel ?? 0) * 12 +
    (charges.assurancesAnnuel ?? 0) +
    (charges.honorairesAnnuel ?? 0) +
    (charges.marketingAnnuel ?? 0) +
    (charges.entretienDiversAnnuel ?? 0);
  const externesFixesExact = facteurInfl.map((f) => externesFixesAnnee1 * f);

  // --- Impots & taxes (4.10, fixe inflatable) ---
  const impotsTaxesAnnee1 = charges.impotsTaxesAnnuel ?? 0;
  const impotsTaxesExact = facteurInfl.map((f) => impotsTaxesAnnee1 * f);

  // --- Agregats ---
  const variablesExact = achatsExact.map((a, i) => a + (transportExact[i] ?? 0));
  const externesExact = externesFixesExact.map((f, i) => f + (transportExact[i] ?? 0));

  return {
    achatsConsommes: arrondiSerie5(achatsExact),
    transport: arrondiSerie5(transportExact),
    chargesVariables: arrondiSerie5(variablesExact),
    chargesExternes: arrondiSerie5(externesExact),
    chargesExternesFixes: arrondiSerie5(externesFixesExact),
    impotsTaxes: arrondiSerie5(impotsTaxesExact),
  };
}
