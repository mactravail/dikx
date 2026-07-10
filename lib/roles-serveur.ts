"use server";

/**
 * Role applicatif de l'utilisateur courant, cote serveur (lecture de `profil`).
 * Sert aux data-actions de SAISIE a decider l'etat de transmission a l'insert :
 * une saisie faite par le comptable est taguee `envoye` (sinon la RLS
 * comptable-ne-voit-que-l'envoye la rendrait invisible pour lui) ; une saisie
 * faite par l'entreprise reste `brouillon` jusqu'a l'envoi explicite.
 */
import { creerClientServeur } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/session-context";

/** Role du profil de l'utilisateur connecte ; `entreprise` par defaut (le plus restreint). */
export async function roleCourantServeur(): Promise<AppRole> {
  const s = await creerClientServeur();
  const {
    data: { user },
  } = await s.auth.getUser();
  if (!user) return "entreprise";
  const { data } = await s.from("profil").select("role").eq("id", user.id).maybeSingle();
  return (data?.role as AppRole) ?? "entreprise";
}
