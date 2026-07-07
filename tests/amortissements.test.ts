import { describe, expect, it } from "vitest";
import { calculerAmortissements } from "../src/engine/amortissements.js";
import { PARAMETRES } from "../src/config/parametres.js";
import type { Investissement } from "../src/types/dossier-input.js";

const opts = {
  dureesDefaut: PARAMETRES.dureesAmortissementDefaut,
};

describe("calculerAmortissements (T2)", () => {
  it("amortit lineairement un materiel 1 500 000 sur 5 ans => 300 000/an", () => {
    const inv: Investissement[] = [
      { nature: "materiel", libelle: "Four", montantHT: 1_500_000, dureeAmortissement: 5 },
    ];
    const t2 = calculerAmortissements(inv, opts);
    const poste = t2.postes[0]!;
    expect(poste.amortissable).toBe(true);
    expect(poste.dotations).toEqual([300_000, 300_000, 300_000, 300_000, 300_000]);
    expect(poste.cumul).toEqual([300_000, 600_000, 900_000, 1_200_000, 1_500_000]);
    expect(poste.vnc).toEqual([1_200_000, 900_000, 600_000, 300_000, 0]);
    expect(t2.totalDotations).toEqual([300_000, 300_000, 300_000, 300_000, 300_000]);
  });

  it("ne amortit pas un terrain (non amortissable)", () => {
    const inv: Investissement[] = [
      { nature: "terrain", montantHT: 5_000_000 },
    ];
    const t2 = calculerAmortissements(inv, opts);
    const poste = t2.postes[0]!;
    expect(poste.amortissable).toBe(false);
    expect(poste.dureeAmortissement).toBe(0);
    expect(poste.dotations).toEqual([0, 0, 0, 0, 0]);
    expect(poste.vnc).toEqual([5_000_000, 5_000_000, 5_000_000, 5_000_000, 5_000_000]);
    expect(t2.totalDotations).toEqual([0, 0, 0, 0, 0]);
  });

  it("applique la duree par defaut selon la nature (informatique = 3 ans)", () => {
    const inv: Investissement[] = [
      { nature: "informatique", montantHT: 900_000 },
    ];
    const t2 = calculerAmortissements(inv, opts);
    const poste = t2.postes[0]!;
    expect(poste.dureeAmortissement).toBe(3);
    expect(poste.dotations).toEqual([300_000, 300_000, 300_000, 0, 0]);
    expect(poste.cumul).toEqual([300_000, 600_000, 900_000, 900_000, 900_000]);
    expect(poste.vnc).toEqual([600_000, 300_000, 0, 0, 0]);
  });

  it("absorbe l'arrondi sans derive : 1 000 000 / 3 ans somme = 1 000 000", () => {
    const inv: Investissement[] = [
      { nature: "informatique", montantHT: 1_000_000, dureeAmortissement: 3 },
    ];
    const t2 = calculerAmortissements(inv, opts);
    const poste = t2.postes[0]!;
    expect(poste.dotations).toEqual([333_333, 333_334, 333_333, 0, 0]);
    const somme = poste.dotations.reduce((a, b) => a + b, 0);
    expect(somme).toBe(1_000_000);
    expect(poste.vnc[2]).toBe(0);
  });

  it("agrege les dotations de plusieurs postes par annee", () => {
    const inv: Investissement[] = [
      { nature: "materiel", montantHT: 1_500_000, dureeAmortissement: 5 },
      { nature: "informatique", montantHT: 900_000, dureeAmortissement: 3 },
    ];
    const t2 = calculerAmortissements(inv, opts);
    expect(t2.totalDotations).toEqual([600_000, 600_000, 600_000, 300_000, 300_000]);
  });
});
