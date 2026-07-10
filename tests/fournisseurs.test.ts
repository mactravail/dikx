import { describe, expect, it } from "vitest";
import { calculerFournisseurs } from "../src/engine/fournisseurs.js";
import type { FournisseurInput } from "../src/types/fournisseurs.js";

const REF = "2026-07-08";

describe("calculerFournisseurs (encours et echeances)", () => {
  it("additionne l'encours et ventile echu / a echoir", () => {
    const fournisseurs: FournisseurInput[] = [
      { nom: "Grands Moulins", encours: 100_000, echeance: "2026-06-01" }, // echu
      { nom: "Emballages SN", encours: 50_000, echeance: "2026-08-01" }, // a echoir
      { nom: "Transport Diallo", encours: 30_000 }, // sans echeance -> a echoir
    ];
    const r = calculerFournisseurs(fournisseurs, REF);

    expect(r.totalEncours).toBe(180_000);
    expect(r.totalEchu).toBe(100_000);
    expect(r.totalAEchoir).toBe(80_000);
    expect(r.nbFournisseurs).toBe(3);
  });

  it("trie par encours decroissant et calcule la part", () => {
    const r = calculerFournisseurs(
      [
        { nom: "Petit", encours: 20_000 },
        { nom: "Gros", encours: 80_000 },
      ],
      REF,
    );
    expect(r.parFournisseur[0]!.nom).toBe("Gros");
    expect(r.parFournisseur[0]!.part).toBeCloseTo(0.8, 5); // 80 000 / 100 000
    expect(r.parFournisseur[1]!.part).toBeCloseTo(0.2, 5);
  });

  it("une echeance egale a la date de reference est consideree echue", () => {
    const r = calculerFournisseurs([{ nom: "F", encours: 1000, echeance: REF }], REF);
    expect(r.parFournisseur[0]!.echu).toBe(true);
    expect(r.totalEchu).toBe(1000);
  });

  it("les encours negatifs sont ramenes a 0", () => {
    const r = calculerFournisseurs([{ nom: "F", encours: -5000 }], REF);
    expect(r.totalEncours).toBe(0);
    expect(r.parFournisseur[0]!.encours).toBe(0);
  });

  it("aucun fournisseur : totaux a zero", () => {
    const r = calculerFournisseurs([], REF);
    expect(r.totalEncours).toBe(0);
    expect(r.parFournisseur).toEqual([]);
  });
});
