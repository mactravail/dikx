import { describe, expect, it } from "vitest";
import { calculerChiffreAffaires } from "../src/engine/chiffre-affaires.js";
import type { ChiffreAffaires } from "../src/types/dossier-input.js";

describe("calculerChiffreAffaires", () => {
  it("mode simple : croissance composee sur 5 ans", () => {
    const ca: ChiffreAffaires = { mode: "simple", montantAnnee1: 10_000_000, tauxCroissance: 0.10 };
    const r = calculerChiffreAffaires(ca);
    expect(r.caParAn).toEqual([10_000_000, 11_000_000, 12_100_000, 13_310_000, 14_641_000]);
  });

  it("mode detaille : somme prix x quantite", () => {
    const ca: ChiffreAffaires = {
      mode: "detaille",
      tauxCroissance: 0,
      produits: [
        { libelle: "A", prixUnitaire: 5_000, quantiteAnnee1: 1_000 },
        { libelle: "B", prixUnitaire: 2_000, quantiteAnnee1: 500 },
      ],
    };
    const r = calculerChiffreAffaires(ca);
    expect(r.caParAn[0]).toBe(6_000_000);
  });

  it("repartition mensuelle egale par defaut, somme = CA annee 1", () => {
    const ca: ChiffreAffaires = { mode: "simple", montantAnnee1: 12_000_000, tauxCroissance: 0 };
    const r = calculerChiffreAffaires(ca);
    const somme = r.caMensuelAnnee1.reduce((a, b) => a + b, 0);
    expect(somme).toBe(12_000_000);
    expect(r.caMensuelAnnee1[0]).toBe(1_000_000);
  });

  it("repartition saisonniere normalisee, somme = CA annee 1", () => {
    const ca: ChiffreAffaires = {
      mode: "simple",
      montantAnnee1: 1_300_000,
      tauxCroissance: 0,
      saisonnier: true,
      repartitionMensuelle: [2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    };
    const r = calculerChiffreAffaires(ca);
    expect(r.caMensuelAnnee1[0]).toBe(200_000);
    expect(r.caMensuelAnnee1[1]).toBe(100_000);
    const somme = r.caMensuelAnnee1.reduce((a, b) => a + b, 0);
    expect(somme).toBe(1_300_000);
  });
});
