/**
 * Moteur PRODUCTION / MRP — calcul des besoins matiere a partir des ordres de
 * fabrication et des nomenclatures (BOM). Pur et deterministe (aucune I/O, aucun
 * aleatoire).
 *
 * A partir des ordres de fabrication (produire une quantite d'un produit), des
 * nomenclatures (composants par produit) et du stock disponible des composants,
 * il produit : le besoin brut, le besoin net (= brut − stock disponible) et la
 * valeur a acheter par composant ; plus le cout matiere de chaque ordre. C'est le
 * SEUL endroit ou ces montants sont produits ; ni l'UI ni l'IA ne calculent un
 * chiffre.
 *
 * Arrondi : les valeurs monetaires (cout matiere, valeur a acheter) sont
 * arrondies a l'entier FCFA au moment de produire la ligne. Les besoins en
 * quantite ne sont pas monetaires (non arrondis).
 */

import type { FCFA } from "../types/money.js";
import type {
  NomenclatureInput,
  OrdreFabricationInput,
  StockComposant,
  BesoinComposant,
  CoutOrdre,
  ResultatProduction,
} from "../types/production.js";
import { arrondiFCFA } from "./arrondi.js";

interface ComposantAgg {
  ref: string;
  besoinBrut: number;
  coutUnitaire: number;
}

export function calculerProduction(
  nomenclatures: NomenclatureInput[],
  ordres: OrdreFabricationInput[],
  stock: StockComposant[],
): ResultatProduction {
  // Index : produit -> nomenclature.
  const bom = new Map<string, NomenclatureInput>();
  for (const n of nomenclatures) bom.set(n.produit, n);

  // Index : ref composant -> stock disponible.
  const dispo = new Map<string, number>();
  for (const s of stock) {
    dispo.set(s.ref, (dispo.get(s.ref) ?? 0) + quantiteValide(s.quantite));
  }

  const composants = new Map<string, ComposantAgg>();
  const coutsOrdres: CoutOrdre[] = [];

  for (const of of ordres) {
    const quantite = quantiteValide(of.quantite);
    const nomenclature = bom.get(of.produit);

    if (!nomenclature) {
      coutsOrdres.push({
        produit: of.produit,
        quantite,
        coutMatiere: 0,
        sansNomenclature: true,
      });
      continue;
    }

    let coutMatiereExact = 0;
    for (const c of nomenclature.composants) {
      const qUnit = quantiteValide(c.quantite);
      const coutUnitaire = montantValide(c.coutUnitaire ?? 0);
      const besoin = quantite * qUnit;

      coutMatiereExact += besoin * coutUnitaire;

      const agg = composants.get(c.ref) ?? {
        ref: c.ref,
        besoinBrut: 0,
        coutUnitaire,
      };
      agg.besoinBrut += besoin;
      // Le cout unitaire connu le plus recent fait foi (nomenclatures coherentes).
      if (coutUnitaire > 0) agg.coutUnitaire = coutUnitaire;
      composants.set(c.ref, agg);
    }

    coutsOrdres.push({
      produit: of.produit,
      quantite,
      coutMatiere: arrondiFCFA(coutMatiereExact),
      sansNomenclature: false,
    });
  }

  const besoins: BesoinComposant[] = [...composants.values()].map((c) => {
    const disponible = dispo.get(c.ref) ?? 0;
    const besoinNet = Math.max(0, c.besoinBrut - disponible);
    return {
      ref: c.ref,
      besoinBrut: c.besoinBrut,
      disponible,
      besoinNet,
      coutUnitaire: arrondiFCFA(c.coutUnitaire),
      valeurAAcheter: arrondiFCFA(besoinNet * c.coutUnitaire),
    };
  });
  besoins.sort((a, b) => b.valeurAAcheter - a.valeurAAcheter);

  return {
    besoins,
    ordres: coutsOrdres,
    coutMatiereTotal: somme(coutsOrdres.map((o) => o.coutMatiere)),
    valeurAAcheterTotale: somme(besoins.map((b) => b.valeurAAcheter)),
    nbOrdres: coutsOrdres.length,
  };
}

function somme(xs: FCFA[]): FCFA {
  return xs.reduce((s, x) => s + x, 0);
}

/** Normalise une quantite (les valeurs invalides / negatives -> 0). */
function quantiteValide(x: number): number {
  return Number.isFinite(x) && x > 0 ? x : 0;
}

/** Normalise un montant fini (les valeurs invalides / negatives -> 0). */
function montantValide(x: number): number {
  return Number.isFinite(x) && x > 0 ? x : 0;
}
