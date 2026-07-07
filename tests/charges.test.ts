import { describe, expect, it } from "vitest";
import { calculerCharges } from "../src/engine/charges.js";
import type { ChargesExploitation } from "../src/types/dossier-input.js";
import type { Serie5FCFA } from "../src/types/money.js";

const ca: Serie5FCFA = [10_000_000, 11_000_000, 12_100_000, 13_310_000, 14_641_000];
const opts = { inflationChargesFixes: 0 };

describe("calculerCharges", () => {
  it("achats en % du CA suivent le CA ; loyer fixe annualise", () => {
    const charges: ChargesExploitation = {
      achatsMatieres: { mode: "pourcentageCA", valeur: 0.40 },
      loyerMensuel: 200_000,
    };
    const r = calculerCharges(charges, ca, opts);
    expect(r.achatsConsommes).toEqual([4_000_000, 4_400_000, 4_840_000, 5_324_000, 5_856_400]);
    // loyer 200 000 x 12 = 2 400 000, constant (inflation 0)
    expect(r.chargesExternesFixes).toEqual([2_400_000, 2_400_000, 2_400_000, 2_400_000, 2_400_000]);
    expect(r.chargesExternes).toEqual([2_400_000, 2_400_000, 2_400_000, 2_400_000, 2_400_000]);
    expect(r.chargesVariables).toEqual(r.achatsConsommes);
  });

  it("achats en montant fixe suivent la proportion du CA", () => {
    const charges: ChargesExploitation = {
      achatsMatieres: { mode: "montant", valeur: 3_000_000 },
    };
    const r = calculerCharges(charges, ca, opts);
    // annee 2 : 3 000 000 x (11/10) = 3 300 000
    expect(r.achatsConsommes[0]).toBe(3_000_000);
    expect(r.achatsConsommes[1]).toBe(3_300_000);
  });

  it("transport est une charge variable (suit le CA) et entre dans les charges externes", () => {
    const charges: ChargesExploitation = {
      achatsMatieres: { mode: "pourcentageCA", valeur: 0 },
      transportCarburantAnnuel: 1_200_000,
    };
    const r = calculerCharges(charges, ca, opts);
    expect(r.transport[0]).toBe(1_200_000);
    expect(r.transport[1]).toBe(1_320_000); // 1 200 000 x 1.1
    expect(r.chargesVariables[0]).toBe(1_200_000);
    expect(r.chargesExternes[0]).toBe(1_200_000); // transport seul ici
  });

  it("impots & taxes sont une ligne separee, inflatables", () => {
    const charges: ChargesExploitation = {
      achatsMatieres: { mode: "pourcentageCA", valeur: 0 },
      impotsTaxesAnnuel: 500_000,
    };
    const r = calculerCharges(charges, ca, { inflationChargesFixes: 0.02 });
    expect(r.impotsTaxes[0]).toBe(500_000);
    expect(r.impotsTaxes[1]).toBe(510_000); // 500 000 x 1.02
  });
});
