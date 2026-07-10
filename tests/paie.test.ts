import { describe, expect, it } from "vitest";
import { calculerPaie } from "../src/engine/paie.js";
import type { BulletinInput } from "../src/types/rh.js";

// Taux de test (fractions). Independants des parametres reels (injectes en prod).
const opts = { tauxCotisationsSalariales: 0.056, tauxCotisationsPatronales: 0.21 };

describe("calculerPaie", () => {
  it("bulletin simple : cotisations, net a payer et cout employeur", () => {
    const bulletins: BulletinInput[] = [{ salaireBrutMensuel: 300_000 }];
    const r = calculerPaie(bulletins, opts);
    const b = r.bulletins[0]!;

    // brut 300 000 ; sal 300 000×5,6 % = 16 800 ; pat 300 000×21 % = 63 000.
    expect(b.brut).toBe(300_000);
    expect(b.cotisationsSalariales).toBe(16_800);
    expect(b.cotisationsPatronales).toBe(63_000);
    expect(b.netAPayer).toBe(283_200); // 300 000 − 16 800
    expect(b.coutEmployeur).toBe(363_000); // 300 000 + 63 000
  });

  it("les primes s'ajoutent au brut (donc a l'assiette des cotisations)", () => {
    const r = calculerPaie([{ salaireBrutMensuel: 300_000, primes: 50_000 }], opts);
    const b = r.bulletins[0]!;

    expect(b.brut).toBe(350_000);
    expect(b.cotisationsSalariales).toBe(19_600); // 350 000×5,6 %
    expect(b.cotisationsPatronales).toBe(73_500); // 350 000×21 %
    expect(b.netAPayer).toBe(330_400); // 350 000 − 19 600
    expect(b.coutEmployeur).toBe(423_500);
  });

  it("les autres retenues sont deduites du net (avances, IR estime...)", () => {
    const r = calculerPaie(
      [{ salaireBrutMensuel: 300_000, autresRetenues: 30_000 }],
      opts,
    );
    // net = 300 000 − 16 800 − 30 000 = 253 200. Le cout employeur est inchange.
    expect(r.bulletins[0]!.netAPayer).toBe(253_200);
    expect(r.bulletins[0]!.coutEmployeur).toBe(363_000);
  });

  it("le net a payer ne peut pas etre negatif (plancher a 0)", () => {
    const r = calculerPaie(
      [{ salaireBrutMensuel: 100_000, autresRetenues: 200_000 }],
      opts,
    );
    expect(r.bulletins[0]!.netAPayer).toBe(0);
  });

  it("totaux : masse salariale chargee sur plusieurs bulletins", () => {
    const r = calculerPaie(
      [{ salaireBrutMensuel: 300_000 }, { salaireBrutMensuel: 200_000 }],
      opts,
    );
    expect(r.totalBrut).toBe(500_000);
    expect(r.totalCotisationsSalariales).toBe(28_000); // 16 800 + 11 200
    expect(r.totalCotisationsPatronales).toBe(105_000); // 63 000 + 42 000
    expect(r.totalNetAPayer).toBe(472_000); // 283 200 + 188 800
    expect(r.totalCoutEmployeur).toBe(605_000); // 363 000 + 242 000
    // Les taux appliques sont exposes pour tracabilite.
    expect(r.tauxCotisationsSalariales).toBe(0.056);
    expect(r.tauxCotisationsPatronales).toBe(0.21);
  });

  it("arrondi FCFA sur les cotisations", () => {
    const r = calculerPaie([{ salaireBrutMensuel: 333_333 }], opts);
    const b = r.bulletins[0]!;
    // sal exact 18 666,648 -> 18 667 ; pat exact 69 999,93 -> 70 000.
    expect(b.cotisationsSalariales).toBe(18_667);
    expect(b.cotisationsPatronales).toBe(70_000);
    expect(b.netAPayer).toBe(314_666); // 333 333 − 18 667
    expect(b.coutEmployeur).toBe(403_333); // 333 333 + 70 000
  });

  it("aucun bulletin : tous les totaux a zero", () => {
    const r = calculerPaie([], opts);
    expect(r.totalBrut).toBe(0);
    expect(r.totalNetAPayer).toBe(0);
    expect(r.totalCoutEmployeur).toBe(0);
    expect(r.bulletins).toEqual([]);
  });
});
