"use client";

import { useActionState } from "react";
import Link from "next/link";
import { sInscrireComptable } from "../actions";
import type { EtatAuth } from "../etat";
import { ChampTexte, MessageAuth, BoutonSoumettre } from "@/components/auth/champs";

export default function SignupPage() {
  const [etat, action, enCours] = useActionState<EtatAuth, FormData>(sInscrireComptable, undefined);

  return (
    <form action={action} className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Creer un compte cabinet</h1>
        <p className="mt-1 text-sm text-slate-500">
          Pour le comptable / cabinet. Vous inviterez ensuite vos entreprises clientes.
        </p>
      </div>

      <MessageAuth etat={etat} />
      <ChampTexte label="Nom du cabinet ou du comptable" name="nom" autoComplete="name" />
      <ChampTexte label="Email" name="email" type="email" autoComplete="email" />
      <ChampTexte
        label="Mot de passe"
        name="motDePasse"
        type="password"
        autoComplete="new-password"
        placeholder="8 caracteres minimum"
      />

      <BoutonSoumettre enCours={enCours}>Creer le compte</BoutonSoumettre>

      <p className="text-center text-sm text-slate-500">
        Deja un compte ?{" "}
        <Link href="/login" className="font-medium text-brand-600 hover:text-brand-700">
          Se connecter
        </Link>
      </p>
    </form>
  );
}
