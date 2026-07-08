import { describe, expect, it } from "vitest";
import { calculerComptabilite } from "../src/engine/comptabilite.js";
import type { EcritureInput } from "../src/types/comptabilite.js";

function ecriture(over: Partial<EcritureInput> = {}): EcritureInput {
  return {
    date: "2026-01-15",
    journal: "OD",
    libelle: "Ecriture",
    lignes: [],
    ...over,
  };
}

describe("calculerComptabilite", () => {
  it("ecriture d'achat equilibree : 601 + 4452 au debit, 401 au credit", () => {
    // Achat de marchandises 100 000 HT + TVA deductible 18 000 = 118 000 du.
    const r = calculerComptabilite([
      ecriture({
        journal: "AC",
        libelle: "Facture fournisseur",
        lignes: [
          { compte: "601", libelle: "Achats de marchandises", debit: 100_000, credit: 0 },
          { compte: "4452", libelle: "TVA deductible", debit: 18_000, credit: 0 },
          { compte: "401", libelle: "Fournisseurs", debit: 0, credit: 118_000 },
        ],
      }),
    ]);

    expect(r.ecritures[0]?.totalDebit).toBe(118_000);
    expect(r.ecritures[0]?.totalCredit).toBe(118_000);
    expect(r.ecritures[0]?.equilibree).toBe(true);

    // Balance triee : 401, 4452, 601.
    expect(r.balance.map((b) => b.compte)).toEqual(["401", "4452", "601"]);
    const c401 = r.balance.find((b) => b.compte === "401");
    expect(c401?.soldeCrediteur).toBe(118_000);
    expect(c401?.soldeDebiteur).toBe(0);
    const c601 = r.balance.find((b) => b.compte === "601");
    expect(c601?.soldeDebiteur).toBe(100_000);

    expect(r.totalDebit).toBe(118_000);
    expect(r.totalCredit).toBe(118_000);
    expect(r.totalSoldeDebiteur).toBe(118_000);
    expect(r.totalSoldeCrediteur).toBe(118_000);
    expect(r.equilibre).toBe(true);
  });

  it("cumule les mouvements d'un meme compte sur plusieurs ecritures", () => {
    const r = calculerComptabilite([
      ecriture({
        journal: "BQ",
        lignes: [
          { compte: "521", libelle: "Banque", debit: 500_000, credit: 0 },
          { compte: "411", libelle: "Clients", debit: 0, credit: 500_000 },
        ],
      }),
      ecriture({
        journal: "BQ",
        lignes: [
          { compte: "521", debit: 0, credit: 200_000 },
          { compte: "401", libelle: "Fournisseurs", debit: 200_000, credit: 0 },
        ],
      }),
    ]);

    const banque = r.balance.find((b) => b.compte === "521");
    expect(banque?.totalDebit).toBe(500_000);
    expect(banque?.totalCredit).toBe(200_000);
    // Solde debiteur de la banque = 500 000 − 200 000 = 300 000.
    expect(banque?.soldeDebiteur).toBe(300_000);
    expect(banque?.soldeCrediteur).toBe(0);
    // Le libelle est repris de la 1re occurrence (2e ecriture ne le fournit pas).
    expect(banque?.libelle).toBe("Banque");

    expect(r.totalDebit).toBe(700_000);
    expect(r.totalCredit).toBe(700_000);
    expect(r.equilibre).toBe(true);
  });

  it("detecte une ecriture desequilibree sans casser la balance", () => {
    const r = calculerComptabilite([
      ecriture({
        lignes: [
          { compte: "601", debit: 100_000, credit: 0 },
          { compte: "401", debit: 0, credit: 90_000 },
        ],
      }),
    ]);
    expect(r.ecritures[0]?.equilibree).toBe(false);
    expect(r.equilibre).toBe(false);
    expect(r.totalDebit).toBe(100_000);
    expect(r.totalCredit).toBe(90_000);
  });

  it("ignore les montants negatifs (mouvement invalide -> 0)", () => {
    const r = calculerComptabilite([
      ecriture({
        lignes: [
          { compte: "601", debit: 100_000, credit: 0 },
          { compte: "401", debit: -5_000, credit: 100_000 },
        ],
      }),
    ]);
    const c401 = r.balance.find((b) => b.compte === "401");
    expect(c401?.totalDebit).toBe(0);
    expect(c401?.soldeCrediteur).toBe(100_000);
  });

  it("aucune ecriture : totaux a zero, equilibre vrai", () => {
    const r = calculerComptabilite([]);
    expect(r.balance).toEqual([]);
    expect(r.totalDebit).toBe(0);
    expect(r.totalCredit).toBe(0);
    expect(r.equilibre).toBe(true);
  });
});
