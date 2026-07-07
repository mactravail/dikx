/**
 * `npm run dev` : execute le moteur sur le dossier d'exemple et affiche le resultat.
 */

import { genererDossier } from "./index.js";
import { exempleBoulangerie } from "./examples/boulangerie.js";

const dossier = genererDossier(exempleBoulangerie, {
  dateGeneration: new Date("2026-01-01T00:00:00.000Z"),
});

console.log(JSON.stringify(dossier, null, 2));

console.log("\n=== Synthese ===");
console.log("CA 5 ans          :", dossier.t5.chiffreAffaires.join(" | "));
console.log("Resultat net 5 ans:", dossier.t5.resultatNet.join(" | "));
console.log("CAF 5 ans         :", dossier.indicateurs.caf.join(" | "));
console.log(
  "DSCR 5 ans        :",
  dossier.indicateurs.dscr.map((d) => (d == null ? "-" : d.toFixed(2))).join(" | "),
);
console.log("Seuil rentab. A1  :", dossier.indicateurs.seuilRentabilite[0]);
console.log("BFR initial       :", dossier.t7.bfr[0]);
console.log("Equilibre financ. :", dossier.t1.equilibre, "(ecart", dossier.t1.ecart, ")");
console.log("Tresorerie fin A1 :", dossier.t9.soldeCumule[11]);
if (dossier.avertissements.length > 0) {
  console.log("\nAvertissements :");
  for (const a of dossier.avertissements) console.log(" -", a);
}
