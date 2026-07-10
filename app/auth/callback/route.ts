/**
 * Echange le `code` OAuth/OTP (confirmation email, reinitialisation, invitation)
 * contre une session, puis redirige vers `?next=`. Exclu du matcher middleware.
 */
import { NextResponse } from "next/server";
import { creerClientServeur } from "@/lib/supabase/server";

function cheminSur(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = cheminSur(url.searchParams.get("next"));

  if (code) {
    const supabase = await creerClientServeur();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }
  return NextResponse.redirect(new URL("/login?erreur=lien", url.origin));
}
