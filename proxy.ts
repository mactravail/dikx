/**
 * Proxy (ex-"middleware", renomme en Next 16) — rafraichit la session Supabase a
 * chaque requete et applique une redirection GROSSIERE :
 *   - non authentifie sur une page de l'ERP -> /login (avec ?next=),
 *   - deja authentifie sur une page d'auth  -> / (tableau de bord).
 *
 * ATTENTION : ce proxy n'est PAS une frontiere de securite. L'autorite reste la
 * RLS Supabase + le getUser() du layout serveur app/(app)/layout.tsx. On le garde
 * LEGER (cf. Vercel Fluid Compute).
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/** Chemins publics accessibles sans session. */
const CHEMINS_PUBLICS = ["/login", "/signup", "/mot-de-passe", "/accepter-invitation", "/landing"];

function estPublic(pathname: string): boolean {
  return CHEMINS_PUBLICS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function estPageAuth(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname.startsWith("/mot-de-passe")
  );
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT : getUser() (et pas getSession()) valide le token cote serveur Auth
  // et declenche le refresh des cookies si necessaire.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !estPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && estPageAuth(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Toutes les routes SAUF : assets Next, favicon, le callback d'echange de code
     * (/auth/callback) et les images statiques.
     */
    "/((?!_next/static|_next/image|favicon.ico|auth/callback|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
