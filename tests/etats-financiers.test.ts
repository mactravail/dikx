import { describe, expect, it } from "vitest";
import { calculerComptabilite } from "../src/engine/comptabilite.js";
import { calculerEtatsFinanciers } from "../src/engine/etats-financiers.js";
import type { EcritureInput, LigneBalance } from "../src/types/comptabilite.js";

/** Petite fabrique de ligne de balance pour les tests directs. */
function ligne(
  compte: string,
  soldeDebiteur: number,
  soldeCrediteur: number,
  libelle = compte,
): LigneBalance {
  return {
    compte,
    libelle,
    totalDebit: soldeDebiteur,
    totalCredit: soldeCrediteur,
    soldeDebiteur,
    soldeCrediteur,
  };
}

describe("calculerEtatsFinanciers", () => {
  it("derive compte de resultat et bilan equilibre d'un exercice complet", () => {
    // Scenario PME (valeurs verifiees a la main) :
    //  - apport capital 5 000 000 en banque
    //  - achat materiel 1 000 000 (banque)
    //  - vente 1 000 000 HT + TVA 180 000 (client)
    //  - achat marchandises 600 000 HT + TVA ded. 108 000 (fournisseur)
    //  - loyer 200 000 (banque)
    const ecritures: EcritureInput[] = [
      {
        date: "2026-01-02",
        journal: "OD",
        libelle: "Apport en capital",
        lignes: [
          { compte: "521", libelle: "Banques", debit: 5_000_000, credit: 0 },
          { compte: "101", libelle: "Capital social", debit: 0, credit: 5_000_000 },
        ],
      },
      {
        date: "2026-01-05",
        journal: "BQ",
        libelle: "Achat materiel",
        lignes: [
          { compte: "241", libelle: "Materiel et outillage", debit: 1_000_000, credit: 0 },
          { compte: "521", libelle: "Banques", debit: 0, credit: 1_000_000 },
        ],
      },
      {
        date: "2026-01-10",
        journal: "VT",
        libelle: "Vente de marchandises",
        lignes: [
          { compte: "411", libelle: "Clients", debit: 1_180_000, credit: 0 },
          { compte: "701", libelle: "Ventes de marchandises", debit: 0, credit: 1_000_000 },
          { compte: "4431", libelle: "TVA collectee", debit: 0, credit: 180_000 },
        ],
      },
      {
        date: "2026-01-12",
        journal: "AC",
        libelle: "Achat de marchandises",
        lignes: [
          { compte: "601", libelle: "Achats de marchandises", debit: 600_000, credit: 0 },
          { compte: "4452", libelle: "TVA deductible", debit: 108_000, credit: 0 },
          { compte: "401", libelle: "Fournisseurs", debit: 0, credit: 708_000 },
        ],
      },
      {
        date: "2026-01-20",
        journal: "BQ",
        libelle: "Loyer",
        lignes: [
          { compte: "612", libelle: "Locations (loyer)", debit: 200_000, credit: 0 },
          { compte: "521", libelle: "Banques", debit: 0, credit: 200_000 },
        ],
      },
    ];

    const { balance } = calculerComptabilite(ecritures);
    const { compteResultat: cr, bilan } = calculerEtatsFinanciers(balance);

    // Compte de resultat.
    expect(cr.totalProduits).toBe(1_000_000);
    expect(cr.totalCharges).toBe(800_000); // 600 000 achats + 200 000 loyer
    expect(cr.resultatNet).toBe(200_000);
    expect(cr.margeNette).toBeCloseTo(0.2, 6); // 200 000 / 1 000 000
    expect(cr.beneficiaire).toBe(true);
    expect(cr.produits.map((p) => p.compte)).toEqual(["701"]);
    // Charges triees par montant decroissant : 601 (600k) avant 612 (200k).
    expect(cr.charges.map((p) => p.compte)).toEqual(["601", "612"]);

    // Bilan — actif.
    expect(bilan.totalActif).toBe(6_088_000);
    // 241 (1 000 000) + 411 (1 180 000) + 4452 (108 000) + 521 (3 800 000).
    expect(bilan.actif.find((p) => p.compte === "521")?.montant).toBe(3_800_000);
    expect(bilan.actif.find((p) => p.compte === "411")?.montant).toBe(1_180_000);

    // Bilan — passif (hors resultat) + resultat.
    expect(bilan.totalPassifHorsResultat).toBe(5_888_000);
    expect(bilan.resultatNet).toBe(200_000);
    expect(bilan.totalPassif).toBe(6_088_000);
    expect(bilan.passif.find((p) => p.compte === "401")?.montant).toBe(708_000);

    // Equilibre garanti par la partie double.
    expect(bilan.equilibre).toBe(true);
    expect(bilan.ecart).toBe(0);
  });

  it("traite l'amortissement (281 crediteur) comme un actif negatif", () => {
    // Materiel 1 000 000, amorti de 200 000, finance par capital 800 000.
    const balance = [
      ligne("101", 0, 800_000, "Capital social"),
      ligne("241", 1_000_000, 0, "Materiel"),
      ligne("281", 0, 200_000, "Amortissements"),
    ];
    const { bilan, compteResultat } = calculerEtatsFinanciers(balance);

    expect(bilan.actif.find((p) => p.compte === "281")?.montant).toBe(-200_000);
    // Immobilisations nettes = 1 000 000 − 200 000 = 800 000.
    expect(bilan.totalActif).toBe(800_000);
    expect(bilan.totalPassifHorsResultat).toBe(800_000);
    expect(compteResultat.resultatNet).toBe(0);
    expect(bilan.equilibre).toBe(true);
  });

  it("un compte de tiers a solde crediteur va au passif, debiteur a l'actif", () => {
    const balance = [
      ligne("411", 500_000, 0, "Clients"), // creance -> actif
      ligne("401", 0, 300_000, "Fournisseurs"), // dette -> passif
      ligne("521", 0, 200_000, "Banque (decouvert)"), // decouvert -> passif
    ];
    const { bilan } = calculerEtatsFinanciers(balance);
    expect(bilan.actif.map((p) => p.compte)).toEqual(["411"]);
    expect(bilan.passif.map((p) => p.compte)).toEqual(["401", "521"]);
    expect(bilan.totalActif).toBe(500_000);
    expect(bilan.totalPassifHorsResultat).toBe(500_000);
    expect(bilan.equilibre).toBe(true);
  });

  it("perte : resultat net negatif, bilan toujours equilibre", () => {
    // Charges 300 000 payees en banque (capital 1 000 000).
    const balance = [
      ligne("101", 0, 1_000_000, "Capital"),
      ligne("521", 700_000, 0, "Banque"),
      ligne("601", 300_000, 0, "Achats"),
    ];
    const { compteResultat: cr, bilan } = calculerEtatsFinanciers(balance);
    expect(cr.totalProduits).toBe(0);
    expect(cr.resultatNet).toBe(-300_000);
    expect(cr.beneficiaire).toBe(false);
    expect(bilan.totalActif).toBe(700_000);
    expect(bilan.totalPassif).toBe(700_000); // 1 000 000 − 300 000
    expect(bilan.equilibre).toBe(true);
  });

  it("balance vide : tout a zero, bilan equilibre", () => {
    const { compteResultat: cr, bilan } = calculerEtatsFinanciers([]);
    expect(cr.totalProduits).toBe(0);
    expect(cr.totalCharges).toBe(0);
    expect(cr.resultatNet).toBe(0);
    expect(bilan.totalActif).toBe(0);
    expect(bilan.totalPassif).toBe(0);
    expect(bilan.equilibre).toBe(true);
  });
});
