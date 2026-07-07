import { describe, expect, it } from "vitest";
import { genererDossier } from "../src/index.js";
import type { DossierInput } from "../src/types/dossier-input.js";

const dateFixe = new Date("2026-01-01T00:00:00.000Z");

const dossierBase: DossierInput = {
  nomProjet: "Test SARL",
  secteur: "Commerce",
  formeJuridique: "SARL",
  moisDemarrage: { mois: 1, annee: 2026 },
  assujettiTVA: true,
  investissements: [
    { nature: "materiel", montantHT: 6_000_000, dureeAmortissement: 5 },
    { nature: "terrain", montantHT: 3_000_000 },
  ],
  financement: {
    apportCapital: 5_000_000,
    apportCompteCourant: 0,
    subventionInvestissement: 0,
    emprunt: { montant: 10_000_000, tauxAnnuel: 0.10, dureeAnnees: 5, differeMois: 0 },
  },
  chiffreAffaires: { mode: "simple", montantAnnee1: 30_000_000, tauxCroissance: 0.05 },
  charges: {
    achatsMatieres: { mode: "pourcentageCA", valeur: 0.40 },
    loyerMensuel: 300_000,
    eauElectriciteMensuel: 100_000,
    telecomMensuel: 25_000,
    assurancesAnnuel: 300_000,
    honorairesAnnuel: 400_000,
    impotsTaxesAnnuel: 250_000,
  },
  personnel: [{ intitule: "Vendeur", nombre: 3, salaireBrutMensuel: 130_000 }],
  salaireDirigeant: { montantMensuel: 350_000 },
  delais: { delaiClientsJours: 30, delaiFournisseursJours: 45, delaiStockJours: 30 },
};

describe("genererDossier (integration)", () => {
  const d = genererDossier(dossierBase, { dateGeneration: dateFixe });

  it("produit les 9 tableaux + indicateurs et la meta", () => {
    expect(d.meta.devise).toBe("XOF");
    expect(d.meta.moisDemarrage).toBe("01/2026");
    expect(d.meta.dateGeneration).toBe("2026-01-01T00:00:00.000Z");
    expect(d.t1).toBeDefined();
    expect(d.t2.postes).toHaveLength(2);
    expect(d.t3).not.toBeNull();
    expect(d.t5.chiffreAffaires[0]).toBe(30_000_000);
    expect(d.indicateurs.caf).toHaveLength(5);
  });

  it("coherence : CAF = resultat net + dotations", () => {
    for (let i = 0; i < 5; i++) {
      expect(d.indicateurs.caf[i]).toBe(d.t5.resultatNet[i]! + d.t2.totalDotations[i]!);
    }
  });

  it("coherence : T5 charges financieres = interets de l'emprunt (T3)", () => {
    expect(d.t5.chargesFinancieres).toEqual(d.t3!.interetsParAn);
  });

  it("coherence : DSCR = CAF / service de la dette quand il y a un emprunt", () => {
    const service = d.indicateurs.serviceDette[0]!;
    expect(service).toBeGreaterThan(0);
    expect(d.indicateurs.dscr[0]).toBeCloseTo(d.indicateurs.caf[0]! / service, 6);
  });

  it("le terrain n'est pas amorti (dotation nulle)", () => {
    const terrain = d.t2.postes.find((p) => p.nature === "terrain")!;
    expect(terrain.amortissable).toBe(false);
    expect(terrain.dotations).toEqual([0, 0, 0, 0, 0]);
  });

  it("signale le desequilibre de financement quand les ressources sont insuffisantes", () => {
    const sousFinance = genererDossier(
      {
        ...dossierBase,
        financement: { apportCapital: 1_000_000, emprunt: null },
      },
      { dateGeneration: dateFixe },
    );
    expect(sousFinance.t1.equilibre).toBe(false);
    expect(sousFinance.avertissements.some((a) => a.includes("Financement insuffisant"))).toBe(true);
  });

  it("fonctionne sans emprunt (T3 null, DSCR null)", () => {
    const sansEmprunt = genererDossier(
      { ...dossierBase, financement: { apportCapital: 20_000_000, emprunt: null } },
      { dateGeneration: dateFixe },
    );
    expect(sansEmprunt.t3).toBeNull();
    expect(sansEmprunt.indicateurs.dscr).toEqual([null, null, null, null, null]);
    expect(sansEmprunt.t5.chargesFinancieres).toEqual([0, 0, 0, 0, 0]);
  });
});
