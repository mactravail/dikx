import { describe, expect, it } from "vitest";
import { calculerAchats, calculerCommande } from "../src/engine/achats.js";
import type { CommandeAchatInput } from "../src/types/achats.js";

const OPTS = { tauxTVADefaut: 0.18 };

describe("calculerCommande (une commande d'achat)", () => {
  it("calcule HT, TVA deductible, TTC et reste a payer", () => {
    const cmd: CommandeAchatInput = {
      fournisseur: "Grands Moulins",
      statut: "envoyee",
      montantPaye: 5000,
      lignes: [{ designation: "Farine T55", quantite: 10, quantiteRecue: 4, prixUnitaireHT: 1000 }],
    };
    const c = calculerCommande(cmd, OPTS);

    expect(c.totalHT).toBe(10_000);
    expect(c.totalTVA).toBe(1800); // 10 000 x 18 %
    expect(c.totalTTC).toBe(11_800);
    expect(c.resteAPayer).toBe(6800); // 11 800 − 5 000
  });

  it("suit la reception (valeur recue, reste a recevoir, taux)", () => {
    const c = calculerCommande(
      {
        fournisseur: "F",
        lignes: [{ designation: "X", quantite: 10, quantiteRecue: 4, prixUnitaireHT: 1000 }],
      },
      OPTS,
    );
    const l = c.lignes[0]!;
    expect(l.montantRecuHT).toBe(4000);
    expect(l.resteARecevoir).toBe(6);
    expect(c.valeurRecueHT).toBe(4000);
    expect(c.valeurARecevoirHT).toBe(6000); // 10 000 − 4 000
    expect(c.tauxReception).toBeCloseTo(0.4, 5); // 4 / 10
  });

  it("applique la remise de ligne", () => {
    const c = calculerCommande(
      {
        fournisseur: "F",
        lignes: [{ designation: "X", quantite: 2, prixUnitaireHT: 1000, remisePct: 0.1 }],
      },
      OPTS,
    );
    const l = c.lignes[0]!;
    expect(l.montantHT).toBe(1800); // 2 x 900
    expect(l.montantTVA).toBe(324); // 1 800 x 18 %
  });

  it("commande non assujettie : TVA nulle", () => {
    const c = calculerCommande(
      {
        fournisseur: "F",
        assujettiTVA: false,
        lignes: [{ designation: "X", quantite: 10, prixUnitaireHT: 1000 }],
      },
      OPTS,
    );
    expect(c.totalTVA).toBe(0);
    expect(c.totalTTC).toBe(10_000);
  });

  it("plafonne la quantite recue a la quantite commandee", () => {
    const c = calculerCommande(
      {
        fournisseur: "F",
        lignes: [{ designation: "X", quantite: 5, quantiteRecue: 8, prixUnitaireHT: 100 }],
      },
      OPTS,
    );
    const l = c.lignes[0]!;
    expect(l.quantiteRecue).toBe(5);
    expect(l.resteARecevoir).toBe(0);
    expect(c.tauxReception).toBe(1);
  });
});

describe("calculerAchats (agregation)", () => {
  it("additionne les totaux et l'encours des commandes actives", () => {
    const commandes: CommandeAchatInput[] = [
      {
        fournisseur: "A",
        statut: "envoyee",
        montantPaye: 0,
        lignes: [{ designation: "X", quantite: 10, prixUnitaireHT: 1000 }],
      },
      {
        fournisseur: "B",
        statut: "recue",
        montantPaye: 5900,
        lignes: [{ designation: "Y", quantite: 5, quantiteRecue: 5, prixUnitaireHT: 1000 }],
      },
    ];
    const r = calculerAchats(commandes, OPTS);
    expect(r.totalHT).toBe(15_000); // 10 000 + 5 000
    expect(r.totalTVA).toBe(2700); // 1 800 + 900
    expect(r.totalTTC).toBe(17_700);
    expect(r.totalPaye).toBe(5900);
    expect(r.totalAPayer).toBe(11_800); // (11 800 − 0) + (5 900 − 5 900)
  });

  it("exclut les commandes annulees de l'encours et de la valeur a recevoir", () => {
    const r = calculerAchats(
      [
        {
          fournisseur: "A",
          statut: "annulee",
          lignes: [{ designation: "X", quantite: 100, prixUnitaireHT: 1000 }],
        },
        {
          fournisseur: "B",
          statut: "envoyee",
          lignes: [{ designation: "Y", quantite: 2, prixUnitaireHT: 1000 }],
        },
      ],
      OPTS,
    );
    expect(r.totalHT).toBe(2000); // seule la commande active compte
    expect(r.totalARecevoirHT).toBe(2000);
  });

  it("aucune commande : totaux a zero", () => {
    const r = calculerAchats([], OPTS);
    expect(r.totalTTC).toBe(0);
    expect(r.totalAPayer).toBe(0);
    expect(r.commandes).toEqual([]);
  });
});
