/**
 * Helpers d'AFFICHAGE uniquement (aucun calcul metier ici).
 * Formatage des montants FCFA, pourcentages, dates pour l'UI.
 */

/** 1234567 -> "1 234 567 FCFA" (espace insecable fine comme separateur). */
export function fcfa(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  const s = Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${s} FCFA`;
}

/** Version compacte : 1 234 567 -> "1,2 M", 12 500 -> "12,5 k". */
export function fcfaCompact(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1).replace(".", ",")} Md`;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".", ",")} M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1).replace(".", ",")} k`;
  return String(Math.round(n));
}

/** 0.18 -> "18 %". */
export function pct(fraction: number | null | undefined, decimals = 0): string {
  if (fraction == null || Number.isNaN(fraction)) return "—";
  return `${(fraction * 100).toFixed(decimals).replace(".", ",")} %`;
}

/** Date ISO -> "JJ/MM/AAAA". */
export function dateCourte(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const p = (x: number) => String(x).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}
