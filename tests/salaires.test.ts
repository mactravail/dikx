import { describe, expect, it } from "vitest";
import { calculerSalaires } from "../src/engine/salaires.js";
import type { PostePersonnel, SalaireDirigeant } from "../src/types/dossier-input.js";

describe("calculerSalaires (T4)", () => {
  const postes: PostePersonnel[] = [
    { intitule: "Vendeur", nombre: 2, salaireBrutMensuel: 150_000 },
    { intitule: "Comptable", nombre: 1, salaireBrutMensuel: 300_000 },
  ];
  const dirigeant: SalaireDirigeant = { montantMensuel: 500_000 };

  it("calcule brut annuel + charges patronales + cout employeur", () => {
    const t4 = calculerSalaires(postes, dirigeant, { tauxChargesPatronales: 0.21 });

    expect(t4.postes[0]!.salaireBrutAnnuel).toBe(3_600_000); // 150k x2 x12
    expect(t4.postes[0]!.chargesPatronales).toBe(756_000); // 21 %
    expect(t4.postes[0]!.coutTotalAnnuel).toBe(4_356_000);

    expect(t4.dirigeant!.salaireBrutAnnuel).toBe(6_000_000); // 500k x12
    expect(t4.dirigeant!.coutTotalAnnuel).toBe(7_260_000);

    expect(t4.totalBrutAnnuel).toBe(13_200_000);
    expect(t4.totalChargesPatronales).toBe(2_772_000);
    expect(t4.totalCoutEmployeur).toBe(15_972_000);
    expect(t4.coutEmployeurParAn).toEqual([
      15_972_000, 15_972_000, 15_972_000, 15_972_000, 15_972_000,
    ]);
  });

  it("nombre par defaut = 1, pas de dirigeant => dirigeant null", () => {
    const t4 = calculerSalaires(
      [{ intitule: "Gerant operationnel", salaireBrutMensuel: 200_000 }],
      null,
      { tauxChargesPatronales: 0.20 },
    );
    expect(t4.postes[0]!.nombre).toBe(1);
    expect(t4.postes[0]!.salaireBrutAnnuel).toBe(2_400_000);
    expect(t4.dirigeant).toBeNull();
    expect(t4.totalCoutEmployeur).toBe(2_880_000); // 2.4M + 20 %
  });
});
