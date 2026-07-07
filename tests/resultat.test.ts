import { describe, expect, it } from "vitest";
import { calculerResultat } from "../src/engine/resultat.js";
import type { Serie5FCFA } from "../src/types/money.js";

function cinq(v: number): Serie5FCFA {
  return [v, v, v, v, v];
}

describe("calculerResultat (T5)", () => {
  it("cascade CA -> resultat net avec IS sur benefice", () => {
    const t5 = calculerResultat(
      {
        caParAn: cinq(10_000_000),
        achatsConsommes: cinq(4_000_000),
        chargesExternes: cinq(2_400_000),
        impotsTaxes: cinq(0),
        chargesPersonnel: cinq(3_000_000),
        dotations: cinq(300_000),
        chargesFinancieres: cinq(200_000),
      },
      { tauxIS: 0.30 },
    );

    expect(t5.margeBrute).toEqual(cinq(6_000_000));
    expect(t5.valeurAjoutee).toEqual(cinq(3_600_000));
    expect(t5.excedentBrutExploitation).toEqual(cinq(600_000));
    expect(t5.resultatExploitation).toEqual(cinq(300_000));
    expect(t5.resultatAvantImpot).toEqual(cinq(100_000));
    expect(t5.impotSocietes).toEqual(cinq(30_000));
    expect(t5.resultatNet).toEqual(cinq(70_000));
  });

  it("pas d'IS quand le resultat avant impot est negatif", () => {
    const t5 = calculerResultat(
      {
        caParAn: cinq(1_000_000),
        achatsConsommes: cinq(500_000),
        chargesExternes: cinq(400_000),
        impotsTaxes: cinq(0),
        chargesPersonnel: cinq(300_000),
        dotations: cinq(100_000),
        chargesFinancieres: cinq(50_000),
      },
      { tauxIS: 0.30 },
    );
    expect(t5.excedentBrutExploitation).toEqual(cinq(-200_000));
    expect(t5.resultatAvantImpot).toEqual(cinq(-350_000));
    expect(t5.impotSocietes).toEqual(cinq(0));
    expect(t5.resultatNet).toEqual(cinq(-350_000));
  });
});
