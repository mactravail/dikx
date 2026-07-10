"use client";

import { Suspense } from "react";
import { useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { seConnecter } from "../actions";
import type { EtatAuth } from "../etat";
import { ChampTexte, MessageAuth, BoutonSoumettre } from "@/components/auth/champs";

function FormulaireConnexion() {
  const params = useSearchParams();
  const next = params.get("next") ?? "/";
  const [etat, action, enCours] = useActionState<EtatAuth, FormData>(seConnecter, undefined);

  return (
    <form action={action} className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Se connecter</h1>
        <p className="mt-1 text-sm text-slate-500">Acces a votre espace raktak.</p>
      </div>

      <input type="hidden" name="next" value={next} />
      <MessageAuth etat={etat} />
      <ChampTexte label="Email" name="email" type="email" autoComplete="email" />
      <ChampTexte label="Mot de passe" name="motDePasse" type="password" autoComplete="current-password" />

      <div className="text-right text-xs">
        <Link href="/mot-de-passe" className="font-medium text-brand-600 hover:text-brand-700">
          Mot de passe oublie ?
        </Link>
      </div>

      <BoutonSoumettre enCours={enCours}>Se connecter</BoutonSoumettre>

      <p className="text-center text-sm text-slate-500">
        Pas encore de compte cabinet ?{" "}
        <Link href="/signup" className="font-medium text-brand-600 hover:text-brand-700">
          Creer un compte
        </Link>
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="h-64" />}>
      <FormulaireConnexion />
    </Suspense>
  );
}
