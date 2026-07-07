/**
 * `npm run pdf` : genere le dossier d'exemple en HTML (toujours) et en PDF
 * (si Puppeteer est installe), dans le dossier ./out.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { genererDossier } from "./index.js";
import { exempleBoulangerie } from "./examples/boulangerie.js";
import { genererHTML, genererPDF } from "./pdf/index.js";

const dossier = genererDossier(exempleBoulangerie, {
  dateGeneration: new Date("2026-01-01T00:00:00.000Z"),
});

const dossierSortie = resolve("out");
mkdirSync(dossierSortie, { recursive: true });

const cheminHTML = resolve(dossierSortie, "dossier-exemple.html");
writeFileSync(cheminHTML, genererHTML(dossier), "utf8");
console.log("HTML ecrit :", cheminHTML);

try {
  const pdf = await genererPDF(dossier);
  const cheminPDF = resolve(dossierSortie, "dossier-exemple.pdf");
  writeFileSync(cheminPDF, pdf);
  console.log("PDF  ecrit :", cheminPDF, `(${(pdf.length / 1024).toFixed(0)} Ko)`);
} catch (e) {
  console.warn("PDF non genere :", (e as Error).message);
  console.warn("=> Le HTML reste exploitable (ouvrir dans un navigateur, Imprimer > PDF).");
}
