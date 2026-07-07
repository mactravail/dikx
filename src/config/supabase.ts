/**
 * Acces Supabase via l'API REST (PostgREST), sans dependance ajoutee :
 * on utilise le `fetch` global de Node LTS. Lecture seule cote tableau de bord.
 *
 * Cle utilisee : SUPABASE_SERVICE_ROLE_KEY (contourne la RLS). Ce module ne doit
 * donc tourner QUE cote serveur, jamais expose au navigateur.
 */

export interface SupabaseConfig {
  url: string;
  serviceRoleKey: string;
}

/** Lit la config depuis l'environnement. `null` si non configuree (UI le signale). */
export function lireConfigSupabase(): SupabaseConfig | null {
  const url = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ??
    process.env.SUPABASE_KEY?.trim();
  if (!url || !serviceRoleKey) return null;
  return { url: url.replace(/\/+$/, ""), serviceRoleKey };
}

/** Erreur explicite si la config manque (utilisee par les routes qui en ont besoin). */
export function exigerConfigSupabase(): SupabaseConfig {
  const cfg = lireConfigSupabase();
  if (!cfg) {
    throw new Error(
      "Supabase non configure : definir SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY (voir .env.example).",
    );
  }
  return cfg;
}

/**
 * GET sur une ressource PostgREST. `query` est le chemin apres `/rest/v1/`,
 * ex. `dossiers?select=id,nom_projet&order=created_at.desc`.
 */
export async function restGet<T>(query: string): Promise<T> {
  const { url, serviceRoleKey } = exigerConfigSupabase();
  const res = await fetch(`${url}/rest/v1/${query}`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    const corps = await res.text().catch(() => "");
    throw new Error(`Supabase ${res.status} ${res.statusText} sur ${query} ${corps}`.trim());
  }
  return (await res.json()) as T;
}
