/**
 * Client Supabase NAVIGATEUR (composants client "use client").
 *
 * Utilise la cle PUBLISHABLE (publique par nature). La session de l'utilisateur
 * est portee par des cookies geres par @supabase/ssr : ce client agit donc sous
 * l'identite de l'utilisateur connecte et RESPECTE la RLS.
 *
 * Ne jamais importer ici la cle service_role (cf. lib/supabase/admin.ts).
 */
import { createBrowserClient } from "@supabase/ssr";

export function creerClientNavigateur() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
