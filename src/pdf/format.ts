/**
 * Formatage pour le rendu (PDF/HTML). Aucune logique de calcul ici :
 * uniquement de la mise en forme de valeurs deja calculees par le moteur.
 */

/** Nombre entier avec separateur de milliers (espace). Ex. 48000000 -> "48 000 000". */
export function formatNombre(n: number): string {
  const entier = Math.round(n);
  const signe = entier < 0 ? "-" : "";
  const abs = Math.abs(entier).toString();
  return signe + abs.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** Montant en FCFA. Ex. 1497600 -> "1 497 600 FCFA". */
export function formatFCFA(n: number): string {
  return `${formatNombre(n)} FCFA`;
}

/** Pourcentage francais a une decimale. Ex. 0.58 -> "58,0 %". */
export function formatPct(fraction: number, decimales = 1): string {
  return `${(fraction * 100).toFixed(decimales).replace(".", ",")} %`;
}

/** Echappe les caracteres speciaux HTML (anti-injection dans le template). */
export function echapperHTML(valeur: string): string {
  return valeur
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
