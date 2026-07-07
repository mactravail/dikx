import { describe, expect, it } from "vitest";
import { calculerEmprunt } from "../src/engine/emprunt.js";
import type { Emprunt } from "../src/types/dossier-input.js";

describe("calculerEmprunt (T3)", () => {
  it("annuites constantes, taux 0 : capital lineaire, pas d'interets", () => {
    const e: Emprunt = { montant: 12_000_000, tauxAnnuel: 0, dureeAnnees: 5, differeMois: 0 };
    const t3 = calculerEmprunt(e, { methode: "annuites_constantes" });

    expect(t3.interetsParAn).toEqual([0, 0, 0, 0, 0]);
    expect(t3.capitalParAn).toEqual([2_400_000, 2_400_000, 2_400_000, 2_400_000, 2_400_000]);
    expect(t3.annuiteParAn).toEqual([2_400_000, 2_400_000, 2_400_000, 2_400_000, 2_400_000]);
    expect(t3.lignes.at(-1)!.capitalRestantDu).toBe(0);
    expect(t3.lignes[0]!.capitalRestantDu).toBe(9_600_000);
    expect(t3.totalInterets).toBe(0);
    expect(t3.serviceMensuelAnnee1).toEqual([
      200_000, 200_000, 200_000, 200_000, 200_000, 200_000,
      200_000, 200_000, 200_000, 200_000, 200_000, 200_000,
    ]);
  });

  it("capital constant 12 % : capital fixe, annuite decroissante", () => {
    // C=10 000 000, t mensuel = 1 %. Capital/mois = 166 666,67.
    // Annee 1 : capital 2 000 000 ; interets = 1% * somme des soldes = 1 090 000.
    const e: Emprunt = { montant: 10_000_000, tauxAnnuel: 0.12, dureeAnnees: 5, differeMois: 0 };
    const t3 = calculerEmprunt(e, { methode: "capital_constant" });

    expect(t3.capitalParAn).toEqual([2_000_000, 2_000_000, 2_000_000, 2_000_000, 2_000_000]);
    expect(t3.interetsParAn[0]).toBeCloseTo(1_090_000, -1);
    expect(t3.annuiteParAn[0]).toBeCloseTo(3_090_000, -1);
    expect(t3.lignes[0]!.capitalRestantDu).toBe(8_000_000);
    // annuite decroissante (interets baissent)
    expect(t3.annuiteParAn[1]!).toBeLessThan(t3.annuiteParAn[0]!);
    // le capital total rembourse = montant emprunte
    const totalCapital = t3.capitalParAn.reduce((a, b) => a + b, 0);
    expect(totalCapital).toBe(10_000_000);
  });

  it("annuites constantes avec interets : annuite ~constante, interets decroissants", () => {
    const e: Emprunt = { montant: 10_000_000, tauxAnnuel: 0.10, dureeAnnees: 5, differeMois: 0 };
    const t3 = calculerEmprunt(e, { methode: "annuites_constantes" });

    // annuite quasi constante d'une annee sur l'autre (a +/- 2 FCFA d'arrondi)
    for (let i = 1; i < 5; i++) {
      expect(Math.abs(t3.annuiteParAn[i]! - t3.annuiteParAn[0]!)).toBeLessThanOrEqual(2);
    }
    // interets decroissants, capital croissant
    expect(t3.interetsParAn[1]!).toBeLessThan(t3.interetsParAn[0]!);
    expect(t3.capitalParAn[1]!).toBeGreaterThan(t3.capitalParAn[0]!);
    // capital total ~ montant, solde final ~ 0
    const totalCapital = t3.capitalParAn.reduce((a, b) => a + b, 0);
    expect(Math.abs(totalCapital - 10_000_000)).toBeLessThanOrEqual(2);
    expect(Math.abs(t3.lignes.at(-1)!.capitalRestantDu)).toBeLessThanOrEqual(2);
  });

  it("differe partiel : pas de remboursement de capital pendant le differe", () => {
    const e: Emprunt = { montant: 12_000_000, tauxAnnuel: 0, dureeAnnees: 5, differeMois: 12 };
    const t3 = calculerEmprunt(e, { methode: "annuites_constantes" });

    // Annee 1 = differe : aucun capital rembourse, solde inchange.
    expect(t3.capitalParAn).toEqual([0, 3_000_000, 3_000_000, 3_000_000, 3_000_000]);
    expect(t3.lignes[0]!.capitalRestantDu).toBe(12_000_000);
    expect(t3.lignes.at(-1)!.capitalRestantDu).toBe(0);
  });
});
