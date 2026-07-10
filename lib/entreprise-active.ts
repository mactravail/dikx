/**
 * ENTREPRISE ACTIVE — l'entreprise cliente sur laquelle le comptable travaille.
 *
 * Point unique qui porte l'id de l'entreprise selectionnee et sert a SCOPER
 * toutes les donnees des modules (ventes, finance, RH, stock...) : chaque cle
 * de stockage est prefixee par l'id de l'entreprise, de sorte que les donnees
 * d'un client ne se melangent jamais avec celles d'un autre.
 *
 * Module volontairement SANS React ni dependance moteur : importable partout
 * (stores, contexte, composants). Persistance localStorage (temporaire, avant
 * le branchement Supabase ou le scope sera porte par entreprise_id + RLS).
 */

/** Cle localStorage de l'id de l'entreprise active (niveau cabinet). */
export const CLE_ENTREPRISE_ACTIVE = "raktak.cabinet.entrepriseActive";

/** Bucket de repli tant qu'aucune entreprise n'est selectionnee. */
const BUCKET_DEFAUT = "_sans-entreprise";

export function getActiveEntrepriseId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(CLE_ENTREPRISE_ACTIVE);
  } catch {
    return null;
  }
}

export function setActiveEntrepriseId(id: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (id) window.localStorage.setItem(CLE_ENTREPRISE_ACTIVE, id);
    else window.localStorage.removeItem(CLE_ENTREPRISE_ACTIVE);
  } catch {
    /* quota / mode prive : on ignore */
  }
}

/**
 * Construit une cle de stockage SCOPEE par l'entreprise active.
 *   scopedKey("ventes.clients") -> "raktak.e.<idEntreprise>.ventes.clients"
 * Les stores de modules doivent utiliser CETTE fonction (jamais une cle brute)
 * pour que les donnees restent cloisonnees par entreprise.
 */
export function scopedKey(suffixe: string): string {
  const id = getActiveEntrepriseId() ?? BUCKET_DEFAUT;
  return `raktak.e.${id}.${suffixe}`;
}
