import { describe, expect, it } from "vitest";
import { calculerProduction } from "../src/engine/production.js";
import type {
  NomenclatureInput,
  OrdreFabricationInput,
  StockComposant,
} from "../src/types/production.js";

// Nomenclature d'un pain : 0,5 kg de farine (400), 0,3 L d'eau (50),
// 0,01 kg de sel (200). Cout matiere unitaire = 200 + 15 + 2 = 217 FCFA.
const NOMENCLATURES: NomenclatureInput[] = [
  {
    produit: "PAIN",
    composants: [
      { ref: "FAR", quantite: 0.5, coutUnitaire: 400 },
      { ref: "EAU", quantite: 0.3, coutUnitaire: 50 },
      { ref: "SEL", quantite: 0.01, coutUnitaire: 200 },
    ],
  },
];

describe("calculerProduction (MRP)", () => {
  it("calcule le cout matiere d'un ordre de fabrication", () => {
    const ordres: OrdreFabricationInput[] = [{ produit: "PAIN", quantite: 100 }];
    const r = calculerProduction(NOMENCLATURES, ordres, []);
    // 100 x 217 = 21 700
    expect(r.ordres[0]!.coutMatiere).toBe(21_700);
    expect(r.coutMatiereTotal).toBe(21_700);
    expect(r.nbOrdres).toBe(1);
  });

  it("calcule le besoin net et la valeur a acheter par composant", () => {
    const r = calculerProduction(
      NOMENCLATURES,
      [{ produit: "PAIN", quantite: 100 }],
      [{ ref: "FAR", quantite: 20 }], // 20 kg de farine deja en stock
    );
    const far = r.besoins.find((b) => b.ref === "FAR")!;
    expect(far.besoinBrut).toBe(50); // 100 x 0,5
    expect(far.disponible).toBe(20);
    expect(far.besoinNet).toBe(30); // 50 − 20
    expect(far.valeurAAcheter).toBe(12_000); // 30 x 400

    // valeur totale a acheter = 12 000 (FAR) + 1 500 (EAU, 30 x 50) + 200 (SEL, 1 x 200)
    expect(r.valeurAAcheterTotale).toBe(13_700);
  });

  it("trie les besoins par valeur a acheter decroissante", () => {
    const r = calculerProduction(NOMENCLATURES, [{ produit: "PAIN", quantite: 100 }], []);
    expect(r.besoins.map((b) => b.ref)).toEqual(["FAR", "EAU", "SEL"]);
  });

  it("agrege le besoin d'un composant sur plusieurs ordres", () => {
    const r = calculerProduction(
      NOMENCLATURES,
      [
        { produit: "PAIN", quantite: 100 },
        { produit: "PAIN", quantite: 100 },
      ],
      [],
    );
    const far = r.besoins.find((b) => b.ref === "FAR")!;
    expect(far.besoinBrut).toBe(100); // (100 + 100) x 0,5
  });

  it("besoin net plafonne a 0 quand le stock couvre le besoin", () => {
    const r = calculerProduction(
      NOMENCLATURES,
      [{ produit: "PAIN", quantite: 10 }],
      [{ ref: "FAR", quantite: 999 }],
    );
    const far = r.besoins.find((b) => b.ref === "FAR")!;
    expect(far.besoinNet).toBe(0);
    expect(far.valeurAAcheter).toBe(0);
  });

  it("signale un ordre dont le produit n'a pas de nomenclature", () => {
    const r = calculerProduction(NOMENCLATURES, [{ produit: "INCONNU", quantite: 5 }], []);
    expect(r.ordres[0]!.sansNomenclature).toBe(true);
    expect(r.ordres[0]!.coutMatiere).toBe(0);
    expect(r.besoins).toEqual([]);
  });

  it("aucun ordre : totaux a zero", () => {
    const r = calculerProduction(NOMENCLATURES, [], []);
    expect(r.coutMatiereTotal).toBe(0);
    expect(r.valeurAAcheterTotale).toBe(0);
    expect(r.besoins).toEqual([]);
  });
});
