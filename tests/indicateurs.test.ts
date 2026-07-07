import { describe, expect, it } from "vitest";
import { calculerIndicateurs } from "../src/engine/indicateurs.js";
import type { Serie5FCFA } from "../src/types/money.js";

function cinq(v: number): Serie5FCFA {
  return [v, v, v, v, v];
}

describe("calculerIndicateurs (IND)", () => {
  it("seuil de rentabilite, CAF et DSCR", () => {
    const ind = calculerIndicateurs({
      caParAn: cinq(10_000_000),
      chargesVariables: cinq(4_000_000),
      chargesFixes: cinq(3_000_000),
      resultatNet: cinq(300_000),
      dotations: cinq(300_000),
      serviceDette: cinq(500_000),
    });

    // taux de marge sur couts variables = (10-4)/10 = 0.6
    expect(ind.tauxMargeSurCoutsVariables[0]).toBeCloseTo(0.6, 10);
    // seuil = 3 000 000 / 0.6 = 5 000 000
    expect(ind.seuilRentabilite).toEqual(cinq(5_000_000));
    // point mort = 5M/10M x 12 = 6 mois
    expect(ind.pointMortMois[0]).toBeCloseTo(6, 10);
    // CAF = resultat net + dotations
    expect(ind.caf).toEqual(cinq(600_000));
    // DSCR = CAF / service de la dette = 600 000 / 500 000 = 1.2
    expect(ind.dscr[0]).toBeCloseTo(1.2, 10);
  });

  it("DSCR null quand il n'y a pas de service de dette", () => {
    const ind = calculerIndicateurs({
      caParAn: cinq(10_000_000),
      chargesVariables: cinq(4_000_000),
      chargesFixes: cinq(3_000_000),
      resultatNet: cinq(300_000),
      dotations: cinq(300_000),
      serviceDette: cinq(0),
    });
    expect(ind.dscr).toEqual([null, null, null, null, null]);
  });
});
