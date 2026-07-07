import { describe, expect, it } from "vitest";
import { calculerT1 } from "../src/engine/investissements-financement.js";
import type { Investissement } from "../src/types/dossier-input.js";

const investissements: Investissement[] = [
  { nature: "terrain", montantHT: 5_000_000 },
  { nature: "materiel", libelle: "Four", montantHT: 1_500_000 },
];

describe("calculerT1 (Investissements & financements)", () => {
  it("equilibre quand les ressources couvrent emplois (invest + BFR)", () => {
    const t1 = calculerT1({
      investissements,
      bfrInitial: 1_000_000,
      apportCapital: 3_000_000,
      apportCompteCourant: 500_000,
      subventionInvestissement: 0,
      emprunt: 4_000_000,
    });
    expect(t1.totalInvestissements).toBe(6_500_000);
    expect(t1.totalEmplois).toBe(7_500_000);
    expect(t1.totalRessources).toBe(7_500_000);
    expect(t1.ecart).toBe(0);
    expect(t1.equilibre).toBe(true);
  });

  it("desequilibre quand le financement ne boucle pas", () => {
    const t1 = calculerT1({
      investissements,
      bfrInitial: 1_000_000,
      apportCapital: 2_000_000,
      apportCompteCourant: 0,
      subventionInvestissement: 0,
      emprunt: 4_000_000,
    });
    expect(t1.totalRessources).toBe(6_000_000);
    expect(t1.ecart).toBe(-1_500_000);
    expect(t1.equilibre).toBe(false);
  });
});
