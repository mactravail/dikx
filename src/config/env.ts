/**
 * Chargeur `.env` minimal (sans dependance). Lit `.env.local` puis `.env` a la
 * racine s'ils existent et injecte les cles ABSENTES de process.env (les
 * variables deja definies dans l'environnement restent prioritaires). Comme les
 * cles deja presentes ne sont pas ecrasees, `.env.local` (charge en premier)
 * surcharge `.env`, suivant la convention habituelle.
 *
 * Volontairement simple : `CLE=valeur`, lignes vides et `#` ignorees, guillemets
 * optionnels retires. Suffisant pour le dev local ; en prod, utiliser de vraies
 * variables d'environnement.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

let charge = false;

// `.env.local` d'abord (priorite), puis `.env` en repli.
const FICHIERS_PAR_DEFAUT = [".env.local", ".env"];

export function chargerEnvLocal(fichiers: string | string[] = FICHIERS_PAR_DEFAUT): void {
  if (charge) return;
  charge = true;

  const liste = Array.isArray(fichiers) ? fichiers : [fichiers];
  for (const fichier of liste) {
    chargerFichier(fichier);
  }
}

function chargerFichier(fichier: string): void {
  const chemin = resolve(process.cwd(), fichier);
  if (!existsSync(chemin)) return;

  const contenu = readFileSync(chemin, "utf8");
  for (const ligne of contenu.split(/\r?\n/)) {
    const t = ligne.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const cle = t.slice(0, eq).trim();
    if (!cle || cle in process.env) continue;
    let valeur = t.slice(eq + 1).trim();
    if (
      (valeur.startsWith('"') && valeur.endsWith('"')) ||
      (valeur.startsWith("'") && valeur.endsWith("'"))
    ) {
      valeur = valeur.slice(1, -1);
    }
    process.env[cle] = valeur;
  }
}
