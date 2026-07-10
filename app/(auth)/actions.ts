"use server";

/**
 * Server actions d'authentification (groupe (auth)).
 * Utilisent le client Supabase lie a la session (lib/supabase/server.ts).
 *
 * Le profil applicatif (role) est cree paresseusement au 1er acces authentifie
 * dans app/(app)/layout.tsx, a partir des metadonnees d'inscription. Cela couvre
 * le cas ou la confirmation par email est activee (pas de session immediate).
 */
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { creerClientServeur } from "@/lib/supabase/server";
import type { EtatAuth } from "./etat";

/** Empeche les redirections ouvertes : seuls les chemins internes sont permis. */
function cheminSur(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}

async function origine(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

export async function seConnecter(_prev: EtatAuth, formData: FormData): Promise<EtatAuth> {
  const email = String(formData.get("email") ?? "").trim();
  const motDePasse = String(formData.get("motDePasse") ?? "");
  const next = cheminSur(String(formData.get("next") ?? "/"));

  const supabase = await creerClientServeur();
  const { error } = await supabase.auth.signInWithPassword({ email, password: motDePasse });
  if (error) {
    return { erreur: "Email ou mot de passe incorrect." };
  }
  redirect(next);
}

export async function sInscrireComptable(_prev: EtatAuth, formData: FormData): Promise<EtatAuth> {
  const nom = String(formData.get("nom") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const motDePasse = String(formData.get("motDePasse") ?? "");

  if (motDePasse.length < 8) {
    return { erreur: "Le mot de passe doit contenir au moins 8 caracteres." };
  }

  const supabase = await creerClientServeur();
  const { data, error } = await supabase.auth.signUp({
    email,
    password: motDePasse,
    options: {
      data: { nom, role: "comptable" },
      emailRedirectTo: `${await origine()}/auth/callback?next=/`,
    },
  });
  if (error) {
    return { erreur: error.message };
  }

  // Confirmation email desactivee : session immediate -> on entre directement.
  if (data.session) {
    redirect("/");
  }
  // Confirmation email activee : pas encore de session.
  return {
    info: "Compte cree. Verifie ta boite mail pour confirmer ton adresse, puis connecte-toi.",
  };
}

export async function demanderReinitialisation(_prev: EtatAuth, formData: FormData): Promise<EtatAuth> {
  const email = String(formData.get("email") ?? "").trim();
  const supabase = await creerClientServeur();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await origine()}/auth/callback?next=/`,
  });
  if (error) {
    return { erreur: error.message };
  }
  return { info: "Si un compte existe pour cette adresse, un email de reinitialisation a ete envoye." };
}

export async function seDeconnecter(): Promise<void> {
  const supabase = await creerClientServeur();
  await supabase.auth.signOut();
  redirect("/login");
}
