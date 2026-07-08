import { describe, expect, it } from "vitest";
import { calculerProjets } from "../src/engine/projets.js";
import type { TacheInput } from "../src/types/projets.js";

describe("calculerProjets", () => {
  it("compte les taches par etat et calcule l'avancement d'un projet", () => {
    const taches: TacheInput[] = [
      { projet: "A", statut: "termine" },
      { projet: "A", statut: "termine" },
      { projet: "A", statut: "en_cours" },
      { projet: "A", statut: "a_faire" },
    ];
    const r = calculerProjets(taches, ["A"]);
    const a = r.parProjet[0]!;

    expect(a.total).toBe(4);
    expect(a.terminees).toBe(2);
    expect(a.enCours).toBe(1);
    expect(a.aFaire).toBe(1);
    expect(a.avancement).toBeCloseTo(0.5, 5); // 2 / 4
  });

  it("agrege la charge en heures et l'ecart (realise − estime)", () => {
    const r = calculerProjets(
      [
        { projet: "A", statut: "termine", heuresEstimees: 8, heuresRealisees: 10 },
        { projet: "A", statut: "en_cours", heuresEstimees: 4, heuresRealisees: 3 },
      ],
      ["A"],
    );
    const a = r.parProjet[0]!;
    expect(a.heuresEstimees).toBe(12);
    expect(a.heuresRealisees).toBe(13);
    expect(a.ecartHeures).toBe(1); // 13 − 12 (depassement)
  });

  it("conserve les projets sans tache a zero (affichage stable)", () => {
    const r = calculerProjets([{ projet: "A", statut: "a_faire" }], ["A", "B"]);
    const b = r.parProjet.find((p) => p.projet === "B")!;
    expect(b.total).toBe(0);
    expect(b.avancement).toBe(0);
    expect(r.parProjet).toHaveLength(2);
  });

  it("totaux et avancement global sur plusieurs projets", () => {
    const r = calculerProjets(
      [
        { projet: "A", statut: "termine" },
        { projet: "A", statut: "a_faire" },
        { projet: "B", statut: "termine" },
        { projet: "B", statut: "termine" },
      ],
      ["A", "B"],
    );
    expect(r.totalTaches).toBe(4);
    expect(r.terminees).toBe(3);
    expect(r.avancementGlobal).toBeCloseTo(0.75, 5); // 3 / 4
  });

  it("une tache sur un projet hors ordre est quand meme comptee", () => {
    const r = calculerProjets([{ projet: "Z", statut: "termine" }], ["A"]);
    expect(r.totalTaches).toBe(1);
    expect(r.parProjet.find((p) => p.projet === "Z")?.terminees).toBe(1);
  });

  it("heures negatives ou non finies normalisees a 0", () => {
    const r = calculerProjets(
      [{ projet: "A", statut: "a_faire", heuresEstimees: -5, heuresRealisees: NaN }],
      ["A"],
    );
    expect(r.totalHeuresEstimees).toBe(0);
    expect(r.totalHeuresRealisees).toBe(0);
  });

  it("aucune tache : tous les totaux a zero, avancement global 0", () => {
    const r = calculerProjets([], []);
    expect(r.totalTaches).toBe(0);
    expect(r.avancementGlobal).toBe(0);
    expect(r.parProjet).toEqual([]);
  });
});
