import { describe, expect, it } from "vitest";
import { formatFCFA, formatNombre, formatPct, echapperHTML } from "../src/pdf/format.js";

describe("format", () => {
  it("formatNombre : separateur de milliers par espace", () => {
    expect(formatNombre(48_000_000)).toBe("48 000 000");
    expect(formatNombre(-3_144_091)).toBe("-3 144 091");
    expect(formatNombre(0)).toBe("0");
    expect(formatNombre(1_497_600)).toBe("1 497 600");
  });

  it("formatFCFA : nombre + suffixe FCFA", () => {
    expect(formatFCFA(1_497_600)).toBe("1 497 600 FCFA");
    expect(formatFCFA(-672_038)).toBe("-672 038 FCFA");
  });

  it("formatPct : pourcentage francais a une decimale", () => {
    expect(formatPct(0.58)).toBe("58,0 %");
    expect(formatPct(-0.0655)).toBe("-6,6 %");
    expect(formatPct(0.150611)).toBe("15,1 %");
  });

  it("echapperHTML : neutralise les caracteres speciaux", () => {
    expect(echapperHTML('<b>"A&B"</b>')).toBe("&lt;b&gt;&quot;A&amp;B&quot;&lt;/b&gt;");
  });
});
