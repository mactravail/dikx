/**
 * Couche Rendu : DossierOutput -> PDF.
 *
 * Le coeur (genererHTML) est pur et testable. La conversion HTML -> PDF utilise
 * Puppeteer (Chromium headless), charge DYNAMIQUEMENT pour que le paquet reste
 * utilisable sans cette dependance lourde (ex. tests, ou rendu delegue a n8n).
 * Si Puppeteer n'est pas installe, genererPDF leve une erreur explicite.
 */

import type { DossierOutput } from "../types/dossier-output.js";
import { genererHTML } from "./template.js";

export { genererHTML } from "./template.js";
export * from "./format.js";

export interface OptionsPDF {
  format?: "A4" | "Letter";
  printBackground?: boolean;
}

/** DossierOutput -> PDF (octets). Necessite Puppeteer installe. */
export async function genererPDF(
  dossier: DossierOutput,
  options: OptionsPDF = {},
): Promise<Uint8Array> {
  return htmlVersPDF(genererHTML(dossier), options);
}

/** HTML -> PDF (octets) via Puppeteer. */
export async function htmlVersPDF(html: string, options: OptionsPDF = {}): Promise<Uint8Array> {
  const puppeteer = await chargerPuppeteer();
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({
      format: options.format ?? "A4",
      printBackground: options.printBackground ?? true,
      margin: { top: "14mm", bottom: "14mm", left: "14mm", right: "14mm" },
    });
    return pdf as Uint8Array;
  } finally {
    await browser.close();
  }
}

async function chargerPuppeteer(): Promise<any> {
  // Specifier non litteral => non resolu par tsc : la dependance reste optionnelle.
  const specifier = "puppeteer";
  try {
    const mod: any = await import(specifier);
    return mod.default ?? mod;
  } catch {
    throw new Error(
      "Puppeteer n'est pas installe. Installez-le pour generer le PDF : npm i -D puppeteer",
    );
  }
}
