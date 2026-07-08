"use server";

/**
 * Server action du module Production / MRP : calcule les besoins matiere (bruts
 * et nets) et le cout matiere des ordres de fabrication via le MOTEUR (pur,
 * teste) cote serveur. Le calcul des besoins n'est jamais fait dans le navigateur.
 */

import { calculerProduction } from "../../../lib/engine";
import type {
  NomenclatureInput,
  OrdreFabricationInput,
  StockComposant,
  ResultatProduction,
} from "../../../lib/engine";

export type ResultatProductionAction =
  | { ok: true; resultat: ResultatProduction }
  | { ok: false; error: string };

export async function calculerProductionAction(
  nomenclatures: NomenclatureInput[],
  ordres: OrdreFabricationInput[],
  stock: StockComposant[],
): Promise<ResultatProductionAction> {
  try {
    const resultat = calculerProduction(nomenclatures, ordres, stock);
    return { ok: true, resultat };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
