import { describe, expect, it } from "vitest";
import { calculerDocument } from "../src/engine/facturation.js";
import type { DocumentInput } from "../src/types/facturation.js";

const opts = { tauxTVADefaut: 0.18 };

function doc(over: Partial<DocumentInput> = {}): DocumentInput {
  return {
    type: "facture",
    assujettiTVA: true,
    lignes: [],
    ...over,
  };
}

describe("calculerDocument", () => {
  it("facture simple : HT, TVA 18 % et TTC par ligne puis totaux", () => {
    const r = calculerDocument(
      doc({
        lignes: [
          { designation: "Prestation A", quantite: 10, prixUnitaireHT: 5_000 },
          { designation: "Prestation B", quantite: 2, prixUnitaireHT: 12_500 },
        ],
      }),
      opts,
    );

    // Ligne 1 : 10 × 5 000 = 50 000 HT ; TVA 9 000 ; TTC 59 000
    expect(r.lignes[0]?.montantHT).toBe(50_000);
    expect(r.lignes[0]?.montantTVA).toBe(9_000);
    expect(r.lignes[0]?.montantTTC).toBe(59_000);
    // Ligne 2 : 2 × 12 500 = 25 000 HT ; TVA 4 500 ; TTC 29 500
    expect(r.lignes[1]?.montantHT).toBe(25_000);
    expect(r.lignes[1]?.montantTVA).toBe(4_500);

    expect(r.totalBrutHT).toBe(75_000);
    expect(r.totalHT).toBe(75_000);
    expect(r.totalTVA).toBe(13_500);
    expect(r.totalTTC).toBe(88_500);
    expect(r.remise).toBe(0);
    expect(r.ventilationTVA).toEqual([
      { taux: 0.18, baseHT: 75_000, montantTVA: 13_500 },
    ]);
  });

  it("reste a payer = TTC − acompte", () => {
    const r = calculerDocument(
      doc({
        lignes: [{ designation: "Vente", quantite: 10, prixUnitaireHT: 5_000 }],
        montantPaye: 30_000,
      }),
      opts,
    );
    // TTC = 50 000 + 9 000 = 59 000 ; reste = 59 000 − 30 000 = 29 000
    expect(r.totalTTC).toBe(59_000);
    expect(r.montantPaye).toBe(30_000);
    expect(r.resteAPayer).toBe(29_000);
  });

  it("remise de ligne (10 %) puis remise globale (5 %) sont proportionnelles", () => {
    const r = calculerDocument(
      doc({
        remiseGlobalePct: 0.05,
        lignes: [
          {
            designation: "Lot",
            quantite: 3,
            prixUnitaireHT: 10_000,
            remisePct: 0.1,
          },
        ],
      }),
      opts,
    );
    // Brut 30 000 ; apres remise ligne 27 000 ; apres remise globale 25 650
    expect(r.lignes[0]?.montantBrutHT).toBe(30_000);
    expect(r.lignes[0]?.montantHT).toBe(25_650);
    // TVA = 25 650 × 0.18 = 4 617
    expect(r.lignes[0]?.montantTVA).toBe(4_617);
    expect(r.totalBrutHT).toBe(30_000);
    expect(r.totalHT).toBe(25_650);
    expect(r.remise).toBe(4_350);
    expect(r.totalTVA).toBe(4_617);
    expect(r.totalTTC).toBe(30_267);
  });

  it("non assujetti : aucune TVA, TTC = HT", () => {
    const r = calculerDocument(
      doc({
        assujettiTVA: false,
        lignes: [{ designation: "Service", quantite: 1, prixUnitaireHT: 100_000 }],
      }),
      opts,
    );
    expect(r.totalTVA).toBe(0);
    expect(r.totalTTC).toBe(100_000);
    expect(r.ventilationTVA).toEqual([{ taux: 0, baseHT: 100_000, montantTVA: 0 }]);
  });

  it("arrondi FCFA au plus proche sur la TVA d'une ligne", () => {
    const r = calculerDocument(
      doc({
        lignes: [{ designation: "Unite", quantite: 3, prixUnitaireHT: 3_333 }],
      }),
      opts,
    );
    // HT = 9 999 ; TVA exacte = 1 799,82 -> 1 800 ; TTC = 11 799
    expect(r.totalHT).toBe(9_999);
    expect(r.totalTVA).toBe(1_800);
    expect(r.totalTTC).toBe(11_799);
  });

  it("ventile la TVA par taux (18 % et exonere)", () => {
    const r = calculerDocument(
      doc({
        lignes: [
          { designation: "Taxable", quantite: 1, prixUnitaireHT: 10_000 },
          { designation: "Exonere", quantite: 1, prixUnitaireHT: 5_000, tauxTVA: 0 },
        ],
      }),
      opts,
    );
    expect(r.totalHT).toBe(15_000);
    expect(r.totalTVA).toBe(1_800);
    expect(r.totalTTC).toBe(16_800);
    expect(r.ventilationTVA).toEqual([
      { taux: 0.18, baseHT: 10_000, montantTVA: 1_800 },
      { taux: 0, baseHT: 5_000, montantTVA: 0 },
    ]);
  });

  it("document vide : tous les totaux a zero", () => {
    const r = calculerDocument(doc(), opts);
    expect(r.totalHT).toBe(0);
    expect(r.totalTTC).toBe(0);
    expect(r.resteAPayer).toBe(0);
    expect(r.ventilationTVA).toEqual([]);
  });
});
