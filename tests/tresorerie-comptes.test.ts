import { describe, expect, it } from "vitest";
import { calculerTresorerie } from "../src/engine/tresorerie-comptes.js";
import type {
  CompteTresorerieInput,
  MouvementTresorerieInput,
} from "../src/types/tresorerie.js";

const COMPTES: CompteTresorerieInput[] = [
  { id: "c1", nom: "CBAO", type: "banque", operateur: "CBAO", soldeInitial: 1_000_000 },
  { id: "c2", nom: "Wave pro", type: "mobile_money", operateur: "Wave", soldeInitial: 200_000 },
  { id: "c3", nom: "Caisse", type: "caisse", soldeInitial: 50_000 },
];

describe("calculerTresorerie", () => {
  it("calcule les soldes courants et les totaux (valeurs verifiees a la main)", () => {
    const mouvements: MouvementTresorerieInput[] = [
      { compteId: "c1", sens: "entree", montant: 500_000, categorie: "encaissement_client" },
      { compteId: "c1", sens: "sortie", montant: 300_000, categorie: "fournisseurs" },
      { compteId: "c1", sens: "sortie", montant: 100_000, categorie: "salaires" },
      { compteId: "c2", sens: "entree", montant: 150_000, categorie: "encaissement_client" },
      { compteId: "c2", sens: "sortie", montant: 80_000, categorie: "transfert" },
      { compteId: "c3", sens: "sortie", montant: 20_000, categorie: "transport" },
    ];
    const r = calculerTresorerie(COMPTES, mouvements);

    const c1 = r.comptes.find((c) => c.compteId === "c1");
    expect(c1?.totalEntrees).toBe(500_000);
    expect(c1?.totalSorties).toBe(400_000);
    expect(c1?.soldeCourant).toBe(1_100_000);
    expect(c1?.nbMouvements).toBe(3);

    const c3 = r.comptes.find((c) => c.compteId === "c3");
    expect(c3?.soldeCourant).toBe(30_000);

    expect(r.totalSoldeInitial).toBe(1_250_000);
    expect(r.totalEntrees).toBe(650_000);
    expect(r.totalSorties).toBe(500_000);
    expect(r.fluxNet).toBe(150_000);
    expect(r.totalDisponible).toBe(1_400_000);
    // Invariant : disponible = solde initial + flux net.
    expect(r.totalDisponible).toBe(r.totalSoldeInitial + r.fluxNet);
  });

  it("ventile le disponible par nature de compte, part decroissante", () => {
    const r = calculerTresorerie(COMPTES, [
      { compteId: "c1", sens: "sortie", montant: 400_000, categorie: "fournisseurs" },
    ]);
    // Disponible : banque 600 000, mobile 200 000, caisse 50 000 -> total 850 000.
    expect(r.parType.map((t) => t.type)).toEqual(["banque", "mobile_money", "caisse"]);
    expect(r.parType[0]?.soldeCourant).toBe(600_000);
    expect(r.parType[0]?.part).toBeCloseTo(600_000 / 850_000, 6);
  });

  it("ventile les sorties par categorie (« qu'a-t-on depense »), part decroissante", () => {
    const r = calculerTresorerie(COMPTES, [
      { compteId: "c1", sens: "sortie", montant: 300_000, categorie: "fournisseurs" },
      { compteId: "c1", sens: "sortie", montant: 100_000, categorie: "salaires" },
      { compteId: "c3", sens: "sortie", montant: 20_000, categorie: "transport" },
      { compteId: "c1", sens: "entree", montant: 999_999, categorie: "apport" }, // ignore (entree)
    ]);
    expect(r.sortiesParCategorie.map((s) => s.categorie)).toEqual([
      "fournisseurs",
      "salaires",
      "transport",
    ]);
    expect(r.sortiesParCategorie[0]?.total).toBe(300_000);
    expect(r.sortiesParCategorie[0]?.part).toBeCloseTo(300_000 / 420_000, 6);
  });

  it("ignore un mouvement portant un compte inconnu", () => {
    const r = calculerTresorerie(COMPTES, [
      { compteId: "inexistant", sens: "entree", montant: 1_000_000, categorie: "autre" },
    ]);
    expect(r.totalEntrees).toBe(0);
    expect(r.totalDisponible).toBe(1_250_000);
  });

  it("ramene a 0 un montant negatif ou non fini", () => {
    const r = calculerTresorerie(COMPTES, [
      { compteId: "c1", sens: "sortie", montant: -50_000, categorie: "autre" },
      { compteId: "c1", sens: "entree", montant: Number.NaN, categorie: "autre" },
    ]);
    const c1 = r.comptes.find((c) => c.compteId === "c1");
    expect(c1?.totalSorties).toBe(0);
    expect(c1?.totalEntrees).toBe(0);
    expect(c1?.soldeCourant).toBe(1_000_000);
  });

  it("aucun compte : tout a zero", () => {
    const r = calculerTresorerie([], []);
    expect(r.comptes).toEqual([]);
    expect(r.totalDisponible).toBe(0);
    expect(r.parType).toEqual([]);
    expect(r.sortiesParCategorie).toEqual([]);
  });
});
