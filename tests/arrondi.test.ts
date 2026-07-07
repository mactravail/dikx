import { describe, expect, it } from "vitest";
import { arrondiFCFA, arrondiSerie5 } from "../src/engine/arrondi.js";

describe("arrondiFCFA", () => {
  it("arrondit vers l'entier le plus proche", () => {
    expect(arrondiFCFA(2.4)).toBe(2);
    expect(arrondiFCFA(2.6)).toBe(3);
    expect(arrondiFCFA(1_000_000.49)).toBe(1_000_000);
    expect(arrondiFCFA(1_000_000.5)).toBe(1_000_001);
  });

  it("arrondit le demi a l'ecart du zero (symetrique)", () => {
    expect(arrondiFCFA(2.5)).toBe(3);
    expect(arrondiFCFA(-2.5)).toBe(-3);
    expect(arrondiFCFA(-2.4)).toBe(-2);
    expect(arrondiFCFA(-2.6)).toBe(-3);
  });

  it("laisse 0 a 0", () => {
    expect(arrondiFCFA(0)).toBe(0);
    expect(arrondiFCFA(-0)).toBe(0);
    expect(arrondiFCFA(0.4)).toBe(0);
  });

  it("rejette les valeurs non finies", () => {
    expect(() => arrondiFCFA(Number.NaN)).toThrow();
    expect(() => arrondiFCFA(Number.POSITIVE_INFINITY)).toThrow();
  });
});

describe("arrondiSerie5", () => {
  it("applique arrondiFCFA a chaque element", () => {
    expect(arrondiSerie5([1.2, 2.5, 3.6, 4.4, 5.5])).toEqual([1, 3, 4, 4, 6]);
  });
});
