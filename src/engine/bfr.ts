/**
 * T7 — Besoin en Fonds de Roulement.
 *
 * BFR normatif a partir des delais (bloc 6) :
 *   creances clients   = CA TTC      x delaiClients / joursAnnee
 *   stocks             = achats HT   x delaiStock   / joursAnnee
 *   dettes fournisseurs= achats TTC  x delaiFourn   / joursAnnee
 *   BFR = stocks + creances - dettes
 *
 * Le TTC n'est applique que si l'entreprise est assujettie a la TVA (sinon TTC=HT).
 * Convention `joursAnnee` parametrable (usuel OHADA : 360). Variation du BFR
 * d'une annee sur l'autre (annee 1 = BFR de depart, alimente T1 et T8).
 *
 * Arrondi via arrondiSerie5.
 */

import type { Serie5FCFA, Taux } from "../types/money.js";
import type { T7 } from "../types/dossier-output.js";
import { arrondiSerie5 } from "./arrondi.js";

const HORIZON = 5;

export interface EntreeBFR {
  /** CA HT par an. */
  caParAn: Serie5FCFA;
  /** Achats consommes HT par an. */
  achatsParAn: Serie5FCFA;
}

export interface OptionsBFR {
  delaiClientsJours: number;
  delaiFournisseursJours: number;
  delaiStockJours: number;
  tauxTVA: Taux;
  assujettiTVA: boolean;
  joursAnnee: number;
}

export function calculerBFR(e: EntreeBFR, options: OptionsBFR): T7 {
  const coeffTTC = options.assujettiTVA ? 1 + options.tauxTVA : 1;
  const j = options.joursAnnee;

  const creancesExact = e.caParAn.map((ca) => (ca * coeffTTC * options.delaiClientsJours) / j);
  const stocksExact = e.achatsParAn.map((a) => (a * options.delaiStockJours) / j);
  const dettesExact = e.achatsParAn.map((a) => (a * coeffTTC * options.delaiFournisseursJours) / j);
  const bfrExact = creancesExact.map(
    (cr, i) => (stocksExact[i] ?? 0) + cr - (dettesExact[i] ?? 0),
  );

  const stocks = arrondiSerie5(stocksExact);
  const creancesClients = arrondiSerie5(creancesExact);
  const dettesFournisseurs = arrondiSerie5(dettesExact);
  const bfr = arrondiSerie5(bfrExact);

  const variationBFR: Serie5FCFA = [0, 0, 0, 0, 0];
  for (let i = 0; i < HORIZON; i++) {
    variationBFR[i] = (bfr[i] ?? 0) - (i === 0 ? 0 : bfr[i - 1] ?? 0);
  }

  return { stocks, creancesClients, dettesFournisseurs, bfr, variationBFR };
}
