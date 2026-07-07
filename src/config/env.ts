/**
 * Chargeur `.env` minimal (sans dependance). Lit le fichier `.env` a la racine
 * s'il existe et injecte les cles ABSENTES de process.env (les variables deja
 * definies dans l'environnement restent prioritaires).
 *
 * Volontairement simple : `CLE=valeur`, lignes vides et `#` ignorees, guillemets
 * optionnels retires. Suffisant pour le dev local ; en prod, utiliser de vraies
 * variables d'environnement.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

let charge = false;

export function chargerEnvLocal(fichier = ".env"): void {
  if (charge) return;
  charge = true;

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
