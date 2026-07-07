import { describe, expect, it } from "vitest";
import { construireDossierInput } from "../src/db/mapper.js";
import { genererDossier } from "../src/index.js";
import type {
  DossierRow,
  InvestissementRow,
  PostePersonnelRow,
  ProduitRow,
} from "../src/db/types.js";

function dossierRow(over: Partial<DossierRow> = {}): DossierRow {
  return {
    id: "d1",
    conversation_id: "c1",
    nom_projet: "Boulangerie",
    secteur: "Boulangerie",
    forme_juridique: "SARL",
    mois_demarrage_mois: 1,
    mois_demarrage_annee: 2026,
    assujetti_tva: true,
    apport_capital: "8000000",
    apport_compte_courant: 2000000,
    subvention_investissement: 0,
    emprunt_present: true,
    emprunt_montant: "12000000",
    emprunt_taux_annuel: "0.09",
    emprunt_duree_annees: 5,
    emprunt_differe_mois: 6,
    ca_mode: "simple",
    ca_montant_annee1: "48000000",
    ca_taux_croissance: "0.08",
    ca_saisonnier: false,
    ca_repartition_mensuelle: null,
    achats_mode: "pourcentage_ca",
    achats_valeur: 0.42,
    loyer_mensuel: 350000,
    eau_electricite_mensuel: 250000,
    telecom_mensuel: 30000,
    transport_carburant_annuel: 1200000,
    assurances_annuel: 400000,
    honoraires_annuel: 600000,
    marketing_annuel: 300000,
    entretien_divers_annuel: 500000,
    impots_taxes_annuel: 350000,
    salaire_dirigeant_mensuel: 400000,
    delai_clients_jours: 15,
    delai_fournisseurs_jours: 30,
    delai_stock_jours: 20,
    taux_tva_override: null,
    taux_is_override: null,
    taux_charges_sociales_override: null,
    ...over,
  };
}

const invests: InvestissementRow[] = [
  { dossier_id: "d1", ordre: 1, nature: "materiel", libelle: "Four", montant_ht: "6000000", duree_amortissement: 5 },
  { dossier_id: "d1", ordre: 0, nature: "frais_etablissement", libelle: "Creation", montant_ht: 500000, duree_amortissement: null },
];

const postes: PostePersonnelRow[] = [
  { dossier_id: "d1", ordre: 0, intitule: "Boulanger", nombre: 2, salaire_brut_mensuel: 200000 },
];

describe("construireDossierInput (mapper DB -> DossierInput)", () => {
  it("reconstruit un DossierInput valide consommable par le moteur", () => {
    const input = construireDossierInput(dossierRow(), invests, postes, []);
    expect(input.nomProjet).toBe("Boulangerie");
    expect(input.assujettiTVA).toBe(true);
    expect(input.financement.apportCapital).toBe(8_000_000);
    expect(input.financement.emprunt).not.toBeNull();
    expect(input.financement.emprunt!.tauxAnnuel).toBeCloseTo(0.09, 10);

    // le moteur tourne sans erreur sur le resultat du mapper
    const dossier = genererDossier(input, { dateGeneration: new Date("2026-01-01T00:00:00.000Z") });
    expect(dossier.t5.chiffreAffaires[0]).toBe(48_000_000);
  });

  it("traduit les enums snake_case du DB vers le domaine camelCase", () => {
    const input = construireDossierInput(dossierRow(), invests, postes, []);
    // investissements tries par ordre : frais_etablissement (ordre 0) avant materiel
    expect(input.investissements[0]!.nature).toBe("fraisEtablissement");
    expect(input.investissements[1]!.nature).toBe("materiel");
    expect(input.charges.achatsMatieres.mode).toBe("pourcentageCA");
  });

  it("mode detaille : reconstruit les produits", () => {
    const produits: ProduitRow[] = [
      { dossier_id: "d1", ordre: 0, libelle: "Pain", prix_unitaire: 150, quantite_annee1: 100000 },
    ];
    const input = construireDossierInput(
      dossierRow({ ca_mode: "detaille", ca_montant_annee1: null }),
      [],
      [],
      produits,
    );
    expect(input.chiffreAffaires.mode).toBe("detaille");
    expect(input.chiffreAffaires.produits).toHaveLength(1);
    expect(input.chiffreAffaires.produits![0]!.prixUnitaire).toBe(150);
  });

  it("pas d'emprunt => emprunt null ; pas de dirigeant => null", () => {
    const input = construireDossierInput(
      dossierRow({ emprunt_present: false, emprunt_montant: null, salaire_dirigeant_mensuel: null }),
      invests,
      postes,
      [],
    );
    expect(input.financement.emprunt).toBeNull();
    expect(input.salaireDirigeant).toBeNull();
  });

  it("applique les overrides de taux quand ils sont presents", () => {
    const input = construireDossierInput(
      dossierRow({ taux_is_override: "0.25" }),
      invests,
      postes,
      [],
    );
    expect(input.parametres?.tauxIS).toBeCloseTo(0.25, 10);
  });
});
