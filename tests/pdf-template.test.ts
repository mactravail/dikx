import { describe, expect, it } from "vitest";
import { genererHTML } from "../src/pdf/template.js";
import { genererDossier } from "../src/index.js";
import type { DossierInput } from "../src/types/dossier-input.js";

const input: DossierInput = {
  nomProjet: "Boulangerie <Teranga>",
  secteur: "Boulangerie",
  formeJuridique: "SARL",
  moisDemarrage: { mois: 1, annee: 2026 },
  assujettiTVA: true,
  investissements: [{ nature: "materiel", montantHT: 6_000_000, dureeAmortissement: 5 }],
  financement: {
    apportCapital: 10_000_000,
    emprunt: { montant: 10_000_000, tauxAnnuel: 0.1, dureeAnnees: 5, differeMois: 0 },
  },
  chiffreAffaires: { mode: "simple", montantAnnee1: 48_000_000, tauxCroissance: 0.08 },
  charges: { achatsMatieres: { mode: "pourcentageCA", valeur: 0.42 }, loyerMensuel: 300_000 },
  personnel: [{ intitule: "Vendeur", nombre: 2, salaireBrutMensuel: 120_000 }],
  delais: { delaiClientsJours: 15, delaiFournisseursJours: 30, delaiStockJours: 20 },
};

const dossier = genererDossier(input, { dateGeneration: new Date("2026-01-01T00:00:00.000Z") });
const html = genererHTML(dossier);

describe("genererHTML", () => {
  it("produit un document HTML complet", () => {
    expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(html).toContain("</html>");
    expect(html).toContain('lang="fr"');
  });

  it("affiche les meta du projet et echappe le nom", () => {
    expect(html).toContain("Boulangerie &lt;Teranga&gt;");
    expect(html).not.toContain("Boulangerie <Teranga>");
    expect(html).toContain("01/2026");
  });

  it("contient les 9 tableaux et les indicateurs", () => {
    for (const titre of [
      "Investissements",
      "Amortissements",
      "Emprunt",
      "Salaires",
      "Compte de r", // resultat
      "SIG",
      "Besoin en Fonds de Roulement",
      "Plan de financement",
      "sorerie", // budget de trésorerie
      "Indicateurs",
    ]) {
      expect(html.toLowerCase()).toContain(titre.toLowerCase());
    }
  });

  it("affiche des montants formates avec separateur d'espace", () => {
    expect(html).toContain("48 000 000"); // CA annee 1
  });

  it("affiche les avertissements quand il y en a", () => {
    // DSCR/tresorerie faibles attendus sur ce dossier de demarrage
    if (dossier.avertissements.length > 0) {
      expect(html.toLowerCase()).toContain("avertissement");
    }
  });
});
