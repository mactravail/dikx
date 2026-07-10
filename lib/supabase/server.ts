/**
 * Client Supabase SERVEUR lie a la session (Server Components, Server Actions,
 * Route Handlers). Lit/ecrit les cookies de session via @supabase/ssr, donc il
 * agit sous l'identite de l'utilisateur connecte et RESPECTE la RLS.
 *
 * C'est ce client que doivent utiliser TOUTES les data-actions des modules :
 * l'isolation par entreprise est garantie par les policies RLS (peut_acceder()).
 *
 * `cookies()` est asynchrone en Next 16 -> la fabrique est `async`.
 */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function creerClientServeur() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Appele depuis un Server Component (cookies en lecture seule) :
            // sans importance, le middleware rafraichit la session.
          }
        },
      },
    },
  );
}
