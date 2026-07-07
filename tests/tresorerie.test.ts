import { describe, expect, it } from "vitest";
import { calculerTresorerie } from "../src/engine/tresorerie.js";
import type { Serie12, FCFA } from "../src/types/money.js";

function douze(v: number): Serie12<FCFA> {
  return [v, v, v, v, v, v, v, v, v, v, v, v];
}

describe("calculerTresorerie (T9)", () => {
  it("budget mensuel sans TVA ni delais : soldes coherents", () => {
    const t9 = calculerTresorerie(
      {
        caMensuelAnnee1: douze(1_000_000),
        achatsMensuelAnnee1: douze(400_000),
        chargesExternesMensuelAnnee1: douze(200_000),
        salairesMensuelAnnee1: douze(300_000),
        serviceEmpruntMensuelAnnee1: douze(200_000),
        investissementsTotalHT: 6_000_000,
        apportsTotal: 3_000_000,
        empruntMontant: 4_000_000,
        subvention: 0,
      },
      {
        assujettiTVA: false,
        tauxTVA: 0.18,
        delaiClientsJours: 0,
        delaiFournisseursJours: 0,
      },
    );

    // Mois 1 : 1M + 3M + 4M encaisses ; 6M+0.4M+0.2M+0.3M+0.2M decaisses
    expect(t9.totalEncaissements[0]).toBe(8_000_000);
    expect(t9.totalDecaissements[0]).toBe(7_100_000);
    expect(t9.soldeMensuel[0]).toBe(900_000);
    // Mois 2..12 : 1M encaisse ; 1.1M decaisse => -100 000
    expect(t9.soldeMensuel[1]).toBe(-100_000);
    expect(t9.soldeCumule[0]).toBe(900_000);
    expect(t9.soldeCumule[1]).toBe(800_000);
    expect(t9.soldeCumule[11]).toBe(-200_000);
  });

  it("avec TVA et sans delais : la TVA est neutre sur la marge (mois 1)", () => {
    const t9 = calculerTresorerie(
      {
        caMensuelAnnee1: douze(1_000_000),
        achatsMensuelAnnee1: douze(400_000),
        chargesExternesMensuelAnnee1: douze(0),
        salairesMensuelAnnee1: douze(0),
        serviceEmpruntMensuelAnnee1: douze(0),
        investissementsTotalHT: 0,
        apportsTotal: 0,
        empruntMontant: 0,
        subvention: 0,
      },
      {
        assujettiTVA: true,
        tauxTVA: 0.18,
        delaiClientsJours: 0,
        delaiFournisseursJours: 0,
      },
    );

    expect(t9.encaissementsCA[0]).toBe(1_180_000); // CA TTC
    expect(t9.decaissementsAchats[0]).toBe(472_000); // achats TTC
    expect(t9.decaissementsTVA[0]).toBe(108_000); // 180 000 - 72 000
    // marge HT preservee : 1 000 000 - 400 000 = 600 000
    expect(t9.soldeMensuel[0]).toBe(600_000);
  });

  it("delai client de 30 jours decale l'encaissement d'un mois", () => {
    const t9 = calculerTresorerie(
      {
        caMensuelAnnee1: douze(1_000_000),
        achatsMensuelAnnee1: douze(0),
        chargesExternesMensuelAnnee1: douze(0),
        salairesMensuelAnnee1: douze(0),
        serviceEmpruntMensuelAnnee1: douze(0),
        investissementsTotalHT: 0,
        apportsTotal: 0,
        empruntMontant: 0,
        subvention: 0,
      },
      {
        assujettiTVA: false,
        tauxTVA: 0.18,
        delaiClientsJours: 30,
        delaiFournisseursJours: 0,
      },
    );
    // Mois 1 : rien encaisse (vente du mois 1 encaissee au mois 2)
    expect(t9.encaissementsCA[0]).toBe(0);
    expect(t9.encaissementsCA[1]).toBe(1_000_000);
    // Le CA du mois 12 n'est pas encaisse dans l'annee (devient creance)
    expect(t9.encaissementsCA[11]).toBe(1_000_000); // vente du mois 11
  });
});
