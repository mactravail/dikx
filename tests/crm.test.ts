import { describe, expect, it } from "vitest";
import { calculerPipeline } from "../src/engine/crm.js";
import type { OpportuniteInput } from "../src/engine/crm.js";

const ETAPES = ["Prospection", "Devis", "Gagne"];

describe("calculerPipeline", () => {
  it("agrege par etape : nombre, total et prevision ponderee", () => {
    const opps: OpportuniteInput[] = [
      { etape: "Prospection", montant: 1_000_000, probabilite: 0.2 },
      { etape: "Devis", montant: 2_000_000, probabilite: 0.5 },
      { etape: "Devis", montant: 500_000, probabilite: 0.5 },
      { etape: "Gagne", montant: 3_000_000, probabilite: 1 },
    ];
    const r = calculerPipeline(opps, ETAPES);

    expect(r.parEtape[0]).toEqual({
      etape: "Prospection",
      nombre: 1,
      total: 1_000_000,
      totalPondere: 200_000,
    });
    expect(r.parEtape[1]).toEqual({
      etape: "Devis",
      nombre: 2,
      total: 2_500_000,
      totalPondere: 1_250_000, // 1 000 000 + 250 000
    });
    expect(r.parEtape[2]).toEqual({
      etape: "Gagne",
      nombre: 1,
      total: 3_000_000,
      totalPondere: 3_000_000,
    });

    expect(r.nombre).toBe(4);
    expect(r.total).toBe(6_500_000);
    expect(r.totalPondere).toBe(4_450_000);
  });

  it("conserve les etapes vides a zero, dans l'ordre fourni", () => {
    const r = calculerPipeline([], ETAPES);
    expect(r.parEtape.map((e) => e.etape)).toEqual(ETAPES);
    expect(r.total).toBe(0);
    expect(r.totalPondere).toBe(0);
  });

  it("probabilite absente => ponderation nulle", () => {
    const r = calculerPipeline(
      [{ etape: "Prospection", montant: 4_000_000 }],
      ETAPES,
    );
    expect(r.total).toBe(4_000_000);
    expect(r.totalPondere).toBe(0);
  });

  it("arrondit la ponderation au FCFA (probabilite 33 %)", () => {
    const r = calculerPipeline(
      [{ etape: "Devis", montant: 1_000, probabilite: 0.33 }],
      ETAPES,
    );
    // 1 000 × 0.33 = 330
    expect(r.totalPondere).toBe(330);
  });
});
