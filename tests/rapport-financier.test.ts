import { describe, expect, it } from "vitest";
import { calculerEtatsFinanciers } from "../src/engine/etats-financiers.js";
import { calculerRapportFinancier } from "../src/engine/rapport-financier.js";
import type { LigneBalance } from "../src/types/comptabilite.js";

/**
 * Construit une ligne de balance a partir d'un solde (debiteur si positif,
 * crediteur si negatif). Simplifie l'ecriture des scenarios de test.
 */
function ligne(compte: string, libelle: string, solde: number): LigneBalance {
  const soldeDebiteur = solde > 0 ? solde : 0;
  const soldeCrediteur = solde < 0 ? -solde : 0;
  return {
    compte,
    libelle,
    totalDebit: soldeDebiteur,
    totalCredit: soldeCrediteur,
    soldeDebiteur,
    soldeCrediteur,
  };
}

/**
 * Scenario de reference — balance equilibree verifiee a la main :
 *   Σ soldes debiteurs = Σ soldes crediteurs = 24 000 000.
 *   Produits 13 200 000 − charges 10 600 000 = resultat net 2 600 000.
 *   Actif 13 400 000 = Passif hors resultat 10 800 000 + resultat 2 600 000.
 */
const BALANCE: LigneBalance[] = [
  // Passif durable (classe 1)
  ligne("101", "Capital social", -5_000_000),
  ligne("106", "Reserves", -1_000_000),
  ligne("162", "Emprunts", -3_000_000),
  // Actif immobilise (classe 2)
  ligne("231", "Batiments", 6_000_000),
  ligne("241", "Materiel", 2_000_000),
  // Stock (classe 3)
  ligne("311", "Marchandises", 1_500_000),
  // Tiers (classe 4)
  ligne("411", "Clients", 2_400_000),
  ligne("401", "Fournisseurs", -1_800_000),
  // Tresorerie (classe 5)
  ligne("521", "Banque", 1_200_000),
  ligne("571", "Caisse", 300_000),
  // Produits (classe 7)
  ligne("701", "Ventes de marchandises", -12_000_000),
  ligne("706", "Prestations de services", -1_000_000),
  ligne("771", "Produits financiers", -200_000),
  // Charges (classe 6)
  ligne("601", "Achats de marchandises", 7_300_000),
  ligne("661", "Salaires", 2_500_000),
  ligne("612", "Loyer", 800_000),
];

function rapportDeReference() {
  const etats = calculerEtatsFinanciers(BALANCE);
  return calculerRapportFinancier({
    compteResultat: etats.compteResultat,
    bilan: etats.bilan,
    balance: BALANCE,
    tresorerieDisponible: 1_500_000,
    exercicePrecedent: {
      chiffreAffaires: 10_000_000,
      totalCharges: 9_000_000,
      resultatNet: 1_500_000,
    },
    budget: {
      chiffreAffaires: 14_000_000,
      totalCharges: 10_000_000,
      resultatNet: 3_000_000,
    },
  });
}

describe("calculerRapportFinancier — synthese", () => {
  const r = rapportDeReference();
  const s = r.synthese;

  it("isole le chiffre d'affaires (comptes 70) des autres produits", () => {
    // 701 (12M) + 706 (1M) ; 771 (produits financiers) exclu.
    expect(s.chiffreAffaires).toBe(13_000_000);
    expect(s.totalProduits).toBe(13_200_000);
  });

  it("reprend charges, resultat net et marge nette (sur CA)", () => {
    expect(s.totalCharges).toBe(10_600_000);
    expect(s.resultatNet).toBe(2_600_000);
    expect(s.beneficiaire).toBe(true);
    expect(s.margeNette).toBeCloseTo(0.2, 10); // 2 600 000 / 13 000 000
  });

  it("classe la structure du bilan par nature", () => {
    expect(s.actifImmobilise).toBe(8_000_000); // 231 + 241
    expect(s.actifCirculant).toBe(3_900_000); // stock 1,5M + creances 2,4M
    expect(s.dettesCirculantes).toBe(1_800_000); // fournisseurs 401
    expect(s.tresorerieActif).toBe(1_500_000); // 521 + 571
    expect(s.tresoreriePassif).toBe(0);
  });

  it("calcule capitaux propres (avec resultat), dettes financieres et ressources stables", () => {
    expect(s.capitauxPropres).toBe(8_600_000); // 6M capital/reserves + 2,6M resultat
    expect(s.dettesFinancieres).toBe(3_000_000); // 162
    expect(s.ressourcesStables).toBe(11_600_000);
  });

  it("derive FDR, BFR et tresorerie nette avec l'invariant FDR − BFR = TN", () => {
    expect(s.fondsDeRoulement).toBe(3_600_000); // 11,6M − 8M
    expect(s.bfr).toBe(2_100_000); // 3,9M − 1,8M
    expect(s.tresorerieNette).toBe(1_500_000); // 1,5M − 0
    expect(s.fondsDeRoulement - s.bfr).toBe(s.tresorerieNette);
  });

  it("porte le disponible reel de tresorerie et l'equilibre du bilan", () => {
    expect(s.tresorerieDisponible).toBe(1_500_000);
    expect(s.totalActif).toBe(13_400_000);
    expect(s.totalPassif).toBe(13_400_000);
    expect(r.bilanEquilibre).toBe(true);
  });

  it("calcule la marge nette de l'exercice precedent quand N-1 est saisi", () => {
    expect(s.margeNettePrecedent).toBeCloseTo(0.15, 10); // 1,5M / 10M
  });
});

describe("calculerRapportFinancier — ratios", () => {
  const { ratios } = rapportDeReference();

  it("autonomie financiere = capitaux propres / total passif", () => {
    expect(ratios.autonomieFinanciere).toBeCloseTo(8_600_000 / 13_400_000, 10);
  });

  it("taux d'endettement = dettes financieres / capitaux propres", () => {
    expect(ratios.tauxEndettement).toBeCloseTo(3_000_000 / 8_600_000, 10);
  });

  it("liquidite generale = (actif circulant + tresorerie) / dettes circulantes", () => {
    expect(ratios.liquiditeGenerale).toBeCloseTo(3, 10); // 5,4M / 1,8M
  });

  it("delai clients (DSO) en jours = creances / CA × 360", () => {
    expect(ratios.delaiClients).toBe(66); // round(2,4M / 13M × 360)
  });

  it("delai fournisseurs (DPO) en jours = dettes / achats × 360", () => {
    expect(ratios.delaiFournisseurs).toBe(89); // round(1,8M / 7,3M × 360)
  });
});

describe("calculerRapportFinancier — comparaisons N-1 et budget", () => {
  const { exploitation } = rapportDeReference();
  const parCle = Object.fromEntries(exploitation.map((l) => [l.cle, l]));

  it("compare le CA a N-1 et au budget", () => {
    const ca = parCle.ca!;
    expect(ca.valeur).toBe(13_000_000);
    expect(ca.n1?.ecart).toBe(3_000_000);
    expect(ca.n1?.ecartPct).toBeCloseTo(0.3, 10); // +3M / 10M
    expect(ca.budget?.ecart).toBe(-1_000_000);
    expect(ca.budget?.ecartPct).toBeCloseTo(-1_000_000 / 14_000_000, 10);
  });

  it("compare le resultat net (hausse vs N-1, en retrait vs budget)", () => {
    const res = parCle.resultat!;
    expect(res.n1?.ecart).toBe(1_100_000);
    expect(res.budget?.ecart).toBe(-400_000);
  });

  it("n'attache pas de variation quand la base n'est pas fournie", () => {
    // N-1 et budget ne renseignent pas totalProduits.
    expect(parCle.produits!.n1).toBeUndefined();
    expect(parCle.produits!.budget).toBeUndefined();
  });
});

describe("calculerRapportFinancier — cas limites", () => {
  it("ne divise pas par zero sur une balance vide (ratios nuls/indefinis)", () => {
    const etats = calculerEtatsFinanciers([]);
    const r = calculerRapportFinancier({
      compteResultat: etats.compteResultat,
      bilan: etats.bilan,
      balance: [],
    });
    expect(r.synthese.chiffreAffaires).toBe(0);
    expect(r.synthese.margeNette).toBe(0);
    expect(r.synthese.tresorerieDisponible).toBeNull();
    expect(r.ratios.autonomieFinanciere).toBeNull();
    expect(r.ratios.liquiditeGenerale).toBeNull();
    expect(r.ratios.delaiClients).toBeNull();
    expect(r.ratios.delaiFournisseurs).toBeNull();
  });

  it("gere une perte (resultat net negatif)", () => {
    const balancePerte: LigneBalance[] = [
      ligne("701", "Ventes", -1_000_000),
      ligne("601", "Achats", 1_500_000),
      ligne("521", "Banque", -500_000), // decouvert (tresorerie de passif)
    ];
    const etats = calculerEtatsFinanciers(balancePerte);
    const r = calculerRapportFinancier({
      compteResultat: etats.compteResultat,
      bilan: etats.bilan,
      balance: balancePerte,
    });
    expect(r.synthese.resultatNet).toBe(-500_000);
    expect(r.synthese.beneficiaire).toBe(false);
    expect(r.synthese.tresoreriePassif).toBe(500_000);
  });
});
