"use client";

/**
 * Acceptation d'invitation. L'invite arrive ici via le lien email (deja
 * authentifie par /auth/callback). Il choisit son mot de passe : on le rattache
 * alors a son entreprise (role « entreprise ») et on l'envoie sur son tableau
 * de bord.
 */

import { Suspense, useActionState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { accepterInvitationAction } from "@/app/(app)/entreprises/invitations-actions";
import { ChampTexte, BoutonSoumettre } from "@/components/auth/champs";

type Etat = { erreur?: string } | undefined;

function FormulaireAcceptation() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";

  const [etat, action, enCours] = useActionState<Etat, FormData>(async (_prev, formData) => {
    const mdp = String(formData.get("motDePasse") ?? "");
    const r = await accepterInvitationAction(token, mdp);
    if (r.ok) {
      router.push("/");
      return undefined;
    }
    return { erreur: r.erreur };
  }, undefined);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500 text-xl font-bold text-white">
            r
          </span>
          <div className="leading-tight">
            <div className="text-lg font-semibold text-slate-800">raktak</div>
            <div className="text-xs text-slate-500">Acces entreprise</div>
          </div>
        </div>

        <form
          action={action}
          className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
        >
          <div>
            <h1 className="text-xl font-semibold text-slate-800">Configurer votre acces</h1>
            <p className="mt-1 text-sm text-slate-500">
              Choisissez un mot de passe pour acceder a l&apos;espace de votre entreprise.
            </p>
          </div>

          {!token && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              Lien d&apos;invitation invalide (jeton manquant).
            </p>
          )}
          {etat?.erreur && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {etat.erreur}
            </p>
          )}

          <ChampTexte
            label="Mot de passe"
            name="motDePasse"
            type="password"
            autoComplete="new-password"
            placeholder="8 caracteres minimum"
          />

          <BoutonSoumettre enCours={enCours}>Activer mon acces</BoutonSoumettre>
        </form>
      </div>
    </div>
  );
}

export default function AccepterInvitationPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <FormulaireAcceptation />
    </Suspense>
  );
}
