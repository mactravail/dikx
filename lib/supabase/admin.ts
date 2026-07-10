/**
 * Client Supabase ADMIN (service_role) — CONTOURNE la RLS.
 *
 * Reserve aux operations transverses cote SERVEUR uniquement :
 *   - inviter l'utilisateur d'une entreprise (auth.admin.inviteUserByEmail),
 *   - creer le profil/le rattachement lors de l'acceptation d'invitation,
 *   - seed de demonstration idempotent.
 *
 * NE JAMAIS utiliser ce client pour lire/ecrire des saisies (celles-ci passent
 * par lib/supabase/server.ts, sous RLS). `import "server-only"` interdit tout
 * import depuis un composant client.
 */
import "server-only";
import { createClient } from "@supabase/supabase-js";

export function creerClientAdmin() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error("SUPABASE_URL manquant.");
  }
  if (!serviceRole) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY manquant : requis pour les operations admin (invitations, seed). " +
        "Renseigne-la dans .env.local (Supabase > Project Settings > API > service_role).",
    );
  }

  return createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
