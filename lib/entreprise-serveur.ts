/**
 * Acces SERVEUR au portefeuille d'entreprises (table `entreprise`, RLS 0006).
 * Utilise le client Supabase lie a la session -> isolation garantie par la RLS
 * (un comptable ne voit que ses entreprises ; un membre, la sienne).
 *
 * `import "server-only"` : jamais importe cote client. Les composants passent par
 * les server actions de app/(app)/entreprises/data-actions.ts, et le layout
 * serveur appelle directement `chargerEntreprises()` / `lireEntrepriseActiveId()`.
 */
import "server-only";
import { cookies } from "next/headers";
import { creerClientServeur } from "./supabase/server";
import type { Entreprise } from "./engine";
import type { EntrepriseBrouillon } from "./entreprise-store";
import {
  COLONNES_ENTREPRISE,
  rowVersEntreprise,
  brouillonVersInsert,
  patchVersUpdate,
  type EntrepriseRow,
} from "./entreprise-mapper";

/** Cookie portant l'id de l'entreprise active (persistance entre rechargements). */
export const CLE_COOKIE_ENTREPRISE_ACTIVE = "raktak.entrepriseActive";

/** Entreprises accessibles a l'utilisateur courant (RLS). Vide si table absente. */
export async function chargerEntreprises(): Promise<Entreprise[]> {
  const supabase = await creerClientServeur();
  const { data, error } = await supabase
    .from("entreprise")
    .select(COLONNES_ENTREPRISE)
    .eq("actif", true)
    .order("raison_sociale");
  if (error || !data) return [];
  return (data as unknown as EntrepriseRow[]).map(rowVersEntreprise);
}

export async function creerEntreprise(b: EntrepriseBrouillon): Promise<Entreprise> {
  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Non authentifie.");

  const { data, error } = await supabase
    .from("entreprise")
    .insert(brouillonVersInsert(b, user.id))
    .select(COLONNES_ENTREPRISE)
    .single();
  if (error || !data) throw new Error(error?.message ?? "Creation de l'entreprise impossible.");
  return rowVersEntreprise(data as unknown as EntrepriseRow);
}

export async function modifierEntreprise(id: string, patch: Partial<Entreprise>): Promise<Entreprise> {
  const supabase = await creerClientServeur();
  const { data, error } = await supabase
    .from("entreprise")
    .update(patchVersUpdate(patch))
    .eq("id", id)
    .select(COLONNES_ENTREPRISE)
    .single();
  if (error || !data) throw new Error(error?.message ?? "Mise a jour impossible.");
  return rowVersEntreprise(data as unknown as EntrepriseRow);
}

export async function supprimerEntreprise(id: string): Promise<void> {
  const supabase = await creerClientServeur();
  const { error } = await supabase.from("entreprise").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/* --------------------------- entreprise active --------------------------- */

/** Lisible depuis un Server Component (lecture cookie). */
export async function lireEntrepriseActiveId(): Promise<string | null> {
  const c = await cookies();
  return c.get(CLE_COOKIE_ENTREPRISE_ACTIVE)?.value ?? null;
}

/** A n'appeler QUE depuis une server action / route handler (ecriture cookie). */
export async function ecrireEntrepriseActiveId(id: string | null): Promise<void> {
  const c = await cookies();
  if (id) {
    c.set(CLE_COOKIE_ENTREPRISE_ACTIVE, id, {
      path: "/",
      httpOnly: false,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    });
  } else {
    c.delete(CLE_COOKIE_ENTREPRISE_ACTIVE);
  }
}

/** Resout l'id actif : cookie s'il est valide, sinon la premiere entreprise. */
export function resoudreEntrepriseActive(
  entreprises: Entreprise[],
  cookieId: string | null,
): string | null {
  if (cookieId && entreprises.some((e) => e.id === cookieId)) return cookieId;
  return entreprises[0]?.id ?? null;
}
