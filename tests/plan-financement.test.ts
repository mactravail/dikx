import { describe, expect, it } from "vitest";
import { calculerPlanFinancement } from "../src/engine/plan-financement.js";
import type { Serie5FCFA } from "../src/types/money.js";

function cinq(v: number): Serie5FCFA {
  return [v, v, v, v, v];
}

describe("calculerPlanFinancement (T8)", () => {
  it("emplois vs ressources et solde cumule sur 5 ans", () => {
    const t8 = calculerPlanFinancement({
      investissementsAnnee1: 6_500_000,
      variationBFR: [1_000_000, 0, 0, 0, 0],
      remboursementsCapital: cinq(800_000),
      caf: cinq(2_000_000),
      apportsAnnee1: 3_500_000,
      subventionAnnee1: 0,
      empruntAnnee1: 4_000_000,
    });

    expect(t8.totalEmplois).toEqual([8_300_000, 800_000, 800_000, 800_000, 800_000]);
    expect(t8.totalRessources).toEqual([9_500_000, 2_000_000, 2_000_000, 2_000_000, 2_000_000]);
    expect(t8.soldeAnnuel).toEqual([1_200_000, 1_200_000, 1_200_000, 1_200_000, 1_200_000]);
    expect(t8.soldeCumule).toEqual([1_200_000, 2_400_000, 3_600_000, 4_800_000, 6_000_000]);
  });
});
