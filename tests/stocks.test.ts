import { describe, expect, it } from "vitest";
import { calculerStock } from "../src/engine/stocks.js";
import type { ArticleStockInput } from "../src/types/stocks.js";

describe("calculerStock (valorisation CUMP)", () => {
  it("calcule le CUMP apres deux entrees et une sortie", () => {
    // 100 @ 500 -> valeur 50 000 ; +50 @ 800 -> valeur 90 000, qte 150,
    // CUMP = 90 000 / 150 = 600 ; sortie 60 @ 600 -> valeur 54 000, qte 90.
    const articles: ArticleStockInput[] = [
      {
        ref: "FAR-T55",
        designation: "Farine T55",
        type: "matiere_premiere",
        unite: "kg",
        mouvements: [
          { type: "entree", quantite: 100, coutUnitaire: 500 },
          { type: "entree", quantite: 50, coutUnitaire: 800 },
          { type: "sortie", quantite: 60 },
        ],
      },
    ];
    const r = calculerStock(articles);
    const a = r.articles[0]!;

    expect(a.quantite).toBe(90);
    expect(a.cump).toBe(600);
    expect(a.valeurStock).toBe(54_000);
    expect(r.valeurTotale).toBe(54_000);
  });

  it("la sortie ne change pas le CUMP (cout moyen fige aux entrees)", () => {
    const r = calculerStock([
      {
        ref: "A",
        designation: "A",
        type: "marchandise",
        unite: "u",
        mouvements: [
          { type: "entree", quantite: 10, coutUnitaire: 1000 },
          { type: "sortie", quantite: 3 },
        ],
      },
    ]);
    const a = r.articles[0]!;
    expect(a.quantite).toBe(7);
    expect(a.cump).toBe(1000);
    expect(a.valeurStock).toBe(7000);
  });

  it("l'inventaire ajuste la quantite au CUMP courant", () => {
    const r = calculerStock([
      {
        ref: "A",
        designation: "A",
        type: "marchandise",
        unite: "u",
        mouvements: [
          { type: "entree", quantite: 100, coutUnitaire: 500 },
          { type: "inventaire", quantite: 80 },
        ],
      },
    ]);
    const a = r.articles[0]!;
    expect(a.quantite).toBe(80);
    expect(a.cump).toBe(500);
    expect(a.valeurStock).toBe(40_000); // 80 x 500
  });

  it("signale la rupture (quantite <= 0) et met la valeur a 0", () => {
    const r = calculerStock([
      {
        ref: "A",
        designation: "A",
        type: "marchandise",
        unite: "u",
        mouvements: [
          { type: "entree", quantite: 10, coutUnitaire: 500 },
          { type: "sortie", quantite: 10 },
        ],
      },
    ]);
    const a = r.articles[0]!;
    expect(a.quantite).toBe(0);
    expect(a.valeurStock).toBe(0);
    expect(a.cump).toBe(0);
    expect(a.enRupture).toBe(true);
    expect(r.nbRuptures).toBe(1);
  });

  it("une sortie superieure au stock ne rend ni la quantite ni la valeur negatives", () => {
    const r = calculerStock([
      {
        ref: "A",
        designation: "A",
        type: "marchandise",
        unite: "u",
        mouvements: [
          { type: "entree", quantite: 10, coutUnitaire: 500 },
          { type: "sortie", quantite: 15 },
        ],
      },
    ]);
    const a = r.articles[0]!;
    expect(a.quantite).toBe(0);
    expect(a.valeurStock).toBe(0);
  });

  it("signale un article sous le seuil de reappro (sans etre en rupture)", () => {
    const r = calculerStock([
      {
        ref: "A",
        designation: "A",
        type: "matiere_premiere",
        unite: "kg",
        seuilAlerte: 100,
        mouvements: [{ type: "entree", quantite: 90, coutUnitaire: 500 }],
      },
    ]);
    const a = r.articles[0]!;
    expect(a.sousSeuil).toBe(true);
    expect(a.enRupture).toBe(false);
    expect(r.nbSousSeuil).toBe(1);
    expect(r.nbRuptures).toBe(0);
  });

  it("additionne la valeur totale de plusieurs articles", () => {
    const r = calculerStock([
      {
        ref: "A",
        designation: "A",
        type: "marchandise",
        unite: "u",
        mouvements: [{ type: "entree", quantite: 10, coutUnitaire: 1000 }],
      },
      {
        ref: "B",
        designation: "B",
        type: "marchandise",
        unite: "u",
        mouvements: [{ type: "entree", quantite: 5, coutUnitaire: 2000 }],
      },
    ]);
    expect(r.valeurTotale).toBe(20_000); // 10 000 + 10 000
    expect(r.nbArticles).toBe(2);
  });

  it("aucun article : totaux a zero", () => {
    const r = calculerStock([]);
    expect(r.valeurTotale).toBe(0);
    expect(r.nbArticles).toBe(0);
    expect(r.articles).toEqual([]);
  });
});
