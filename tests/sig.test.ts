import { describe, expect, it } from "vitest";
import { calculerSIG } from "../src/engine/sig.js";
import { calculerResultat } from "../src/engine/resultat.js";
import type { Serie5FCFA } from "../src/types/money.js";

function cinq(v: number): Serie5FCFA {
  return [v, v, v, v, v];
}

describe("calculerSIG (T6)", () => {
  it("reprend les soldes du resultat et calcule le % du CA", () => {
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
    const t6 = calculerSIG(t5);

    expect(t6.margeCommerciale.valeur).toEqual(cinq(6_000_000));
    expect(t6.margeCommerciale.pourcentageCA[0]).toBeCloseTo(0.6, 10);
    expect(t6.valeurAjoutee.pourcentageCA[0]).toBeCloseTo(0.36, 10);
    expect(t6.excedentBrutExploitation.pourcentageCA[0]).toBeCloseTo(0.06, 10);
    expect(t6.resultatExploitation.valeur).toEqual(cinq(300_000));
    expect(t6.resultatCourant.valeur).toEqual(cinq(100_000));
    expect(t6.resultatNet.valeur).toEqual(cinq(70_000));
    expect(t6.resultatNet.pourcentageCA[0]).toBeCloseTo(0.007, 10);
  });

  it("pourcentage = 0 quand le CA est nul", () => {
    const t5 = calculerResultat(
      {
        caParAn: cinq(0),
        achatsConsommes: cinq(0),
        chargesExternes: cinq(0),
        impotsTaxes: cinq(0),
        chargesPersonnel: cinq(0),
        dotations: cinq(0),
        chargesFinancieres: cinq(0),
      },
      { tauxIS: 0.30 },
    );
    const t6 = calculerSIG(t5);
    expect(t6.margeCommerciale.pourcentageCA).toEqual(cinq(0));
  });
});
