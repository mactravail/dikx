/**
 * Authentification via Supabase Auth (GoTrue), sans dependance ajoutee :
 * on utilise le `fetch` global de Node LTS. Ce module tourne cote SERVEUR ;
 * le navigateur n'appelle jamais Supabase directement et ne voit aucune cle.
 *
 * Cle utilisee : SUPABASE_ANON_KEY (cle publiable, prevue pour l'auth cote
 * client — ici on la garde cote serveur et on expose des routes /api/auth/*).
 */

export interface AuthConfig {
  url: string;
  anonKey: string;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  email: string | null;
}

export interface SignUpResult {
  /** true si Supabase exige une confirmation par email (pas de session immediate). */
  confirmationRequise: boolean;
  session: Session | null;
}

/** Lit la config d'auth depuis l'environnement. `null` si non configuree. */
export function lireConfigAuth(): AuthConfig | null {
  const url = process.env.SUPABASE_URL?.trim();
  const anonKey =
    process.env.SUPABASE_ANON_KEY?.trim() ?? process.env.SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !anonKey) return null;
  return { url: url.replace(/\/+$/, ""), anonKey };
}

function exigerConfigAuth(): AuthConfig {
  const cfg = lireConfigAuth();
  if (!cfg) {
    throw new Error(
      "Auth non configuree : definir SUPABASE_URL et SUPABASE_ANON_KEY (voir .env.example).",
    );
  }
  return cfg;
}

/** Extrait un message d'erreur lisible d'une reponse GoTrue. */
function messageErreur(corps: unknown, statut: number): string {
  const o = (corps ?? {}) as Record<string, unknown>;
  const msg =
    (o.error_description as string) ??
    (o.msg as string) ??
    (o.message as string) ??
    (typeof o.error === "string" ? o.error : undefined);
  return msg || `Erreur d'authentification (${statut}).`;
}

async function postGoTrue(
  chemin: string,
  corps: Record<string, unknown>,
): Promise<{ ok: boolean; statut: number; data: any }> {
  const { url, anonKey } = exigerConfigAuth();
  const res = await fetch(`${url}/auth/v1/${chemin}`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "content-type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(corps),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, statut: res.status, data };
}

function extraireSession(data: any): Session | null {
  if (!data?.access_token) return null;
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? "",
    email: data.user?.email ?? data.email ?? null,
  };
}

/** Connexion par email + mot de passe. Leve une Error avec un message clair si echec. */
export async function connexion(email: string, password: string): Promise<Session> {
  const { ok, statut, data } = await postGoTrue("token?grant_type=password", {
    email,
    password,
  });
  if (!ok) throw new Error(messageErreur(data, statut));
  const session = extraireSession(data);
  if (!session) throw new Error("Reponse d'authentification inattendue.");
  return session;
}

/** Creation de compte. `confirmationRequise` = true si aucune session n'est renvoyee. */
export async function inscription(
  email: string,
  password: string,
  nom?: string,
): Promise<SignUpResult> {
  const corps: Record<string, unknown> = { email, password };
  if (nom) corps.data = { nom };
  const { ok, statut, data } = await postGoTrue("signup", corps);
  if (!ok) throw new Error(messageErreur(data, statut));
  const session = extraireSession(data);
  return { confirmationRequise: session === null, session };
}

/** Demande de reinitialisation du mot de passe (envoi d'un email). */
export async function reinitialisation(email: string): Promise<void> {
  const { ok, statut, data } = await postGoTrue("recover", { email });
  // On ne divulgue pas si l'email existe : seule une vraie erreur serveur remonte.
  if (!ok && statut >= 500) throw new Error(messageErreur(data, statut));
}
