import { describe, expect, it } from "vitest";
import { calculerBFR } from "../src/engine/bfr.js";
import type { Serie5FCFA } from "../src/types/money.js";

function cinq(v: number): Serie5FCFA {
  return [v, v, v, v, v];
}

describe("calculerBFR (T7)", () => {
  it("BFR = stocks + creances clients (TTC) - dettes fournisseurs (TTC)", () => {
    // CA 36M HT, achats 18M HT ; clients 60j, fournisseurs 30j, stock 30j ; TVA 18 %.
    // CA TTC=42 480 000 -> creances 60/360 = 7 080 000
    // achats TTC=21 240 000 -> dettes 30/360 = 1 770 000
    // stocks 18M x30/360 = 1 500 000
    // BFR = 1 500 000 + 7 080 000 - 1 770 000 = 6 810 000
    const t7 = calculerBFR(
      { caParAn: cinq(36_000_000), achatsParAn: cinq(18_000_000) },
      {
        delaiClientsJours: 60,
        delaiFournisseursJours: 30,
        delaiStockJours: 30,
        tauxTVA: 0.18,
        assujettiTVA: true,
        joursAnnee: 360,
      },
    );
    expect(t7.creancesClients).toEqual(cinq(7_080_000));
    expect(t7.dettesFournisseurs).toEqual(cinq(1_770_000));
    expect(t7.stocks).toEqual(cinq(1_500_000));
    expect(t7.bfr).toEqual(cinq(6_810_000));
    // CA constant => variation nulle apres l'annee 1
    expect(t7.variationBFR).toEqual([6_810_000, 0, 0, 0, 0]);
  });

  it("non assujetti TVA : montants en HT (TTC = HT)", () => {
    const t7 = calculerBFR(
      { caParAn: cinq(36_000_000), achatsParAn: cinq(18_000_000) },
      {
        delaiClientsJours: 60,
        delaiFournisseursJours: 30,
        delaiStockJours: 30,
        tauxTVA: 0.18,
        assujettiTVA: false,
        joursAnnee: 360,
      },
    );
    expect(t7.creancesClients).toEqual(cinq(6_000_000));
    expect(t7.dettesFournisseurs).toEqual(cinq(1_500_000));
    expect(t7.bfr).toEqual(cinq(6_000_000));
  });
});
