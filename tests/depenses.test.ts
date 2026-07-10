import { describe, expect, it } from "vitest";
import { calculerDepenses } from "../src/engine/depenses.js";
import type { DepenseInput } from "../src/types/depenses.js";

const opts = { tauxTVADefaut: 0.18 };

describe("calculerDepenses", () => {
  it("depense avec TVA 18 % deductible : HT, TVA et TTC", () => {
    const depenses: DepenseInput[] = [
      { categorie: "energie", montantHT: 100_000, tauxTVA: 0.18, recurrence: "mensuelle" },
    ];
    const r = calculerDepenses(depenses, opts);

    expect(r.lignes[0]?.montantHT).toBe(100_000);
    expect(r.lignes[0]?.montantTVA).toBe(18_000);
    expect(r.lignes[0]?.montantTTC).toBe(118_000);
    expect(r.totalHT).toBe(100_000);
    expect(r.totalTVA).toBe(18_000);
    expect(r.totalTTC).toBe(118_000);
  });

  it("cout annuel selon la recurrence (mensuelle × 12, ponctuelle × 0)", () => {
    const r = calculerDepenses(
      [
        { categorie: "loyer", montantHT: 300_000, tauxTVA: 0, recurrence: "mensuelle" },
        { categorie: "assurance", montantHT: 240_000, tauxTVA: 0, recurrence: "annuelle" },
        { categorie: "fournitures", montantHT: 50_000, tauxTVA: 0, recurrence: "ponctuelle" },
      ],
      opts,
    );
    // Loyer 300 000 × 12 = 3 600 000 ; assurance 240 000 × 1 ; achat ponctuel × 0.
    expect(r.lignes[0]?.montantAnnualiseTTC).toBe(3_600_000);
    expect(r.lignes[1]?.montantAnnualiseTTC).toBe(240_000);
    expect(r.lignes[2]?.montantAnnualiseTTC).toBe(0);
    expect(r.totalAnnualiseTTC).toBe(3_840_000);
  });

  it("taux de TVA par defaut applique quand la ligne n'en fournit pas", () => {
    const r = calculerDepenses(
      [{ categorie: "honoraires", montantHT: 200_000, recurrence: "ponctuelle" }],
      opts,
    );
    // Defaut 18 % : TVA = 36 000.
    expect(r.lignes[0]?.montantTVA).toBe(36_000);
    expect(r.lignes[0]?.montantTTC).toBe(236_000);
  });

  it("repartition par categorie triee, avec la part de chacune", () => {
    const r = calculerDepenses(
      [
        { categorie: "loyer", montantHT: 300_000, tauxTVA: 0, recurrence: "mensuelle" },
        { categorie: "energie", montantHT: 100_000, tauxTVA: 0, recurrence: "mensuelle" },
        { categorie: "energie", montantHT: 100_000, tauxTVA: 0, recurrence: "mensuelle" },
      ],
      opts,
    );
    // Total TTC = 500 000. Loyer 300 000 (60 %) puis energie 200 000 (40 %).
    expect(r.totalTTC).toBe(500_000);
    expect(r.repartition[0]?.categorie).toBe("loyer");
    expect(r.repartition[0]?.totalTTC).toBe(300_000);
    expect(r.repartition[0]?.part).toBeCloseTo(0.6, 5);
    expect(r.repartition[1]?.categorie).toBe("energie");
    expect(r.repartition[1]?.totalTTC).toBe(200_000);
    expect(r.repartition[1]?.part).toBeCloseTo(0.4, 5);
  });

  it("arrondi FCFA sur la TVA d'une depense", () => {
    const r = calculerDepenses(
      [{ categorie: "telecom", montantHT: 33_333, tauxTVA: 0.18, recurrence: "mensuelle" }],
      opts,
    );
    // TVA exacte = 5 999,94 -> 6 000 ; TTC = 39 333.
    expect(r.lignes[0]?.montantTVA).toBe(6_000);
    expect(r.lignes[0]?.montantTTC).toBe(39_333);
  });

  it("aucune depense : tous les totaux a zero, repartition vide", () => {
    const r = calculerDepenses([], opts);
    expect(r.totalHT).toBe(0);
    expect(r.totalTTC).toBe(0);
    expect(r.totalAnnualiseTTC).toBe(0);
    expect(r.repartition).toEqual([]);
  });
});
