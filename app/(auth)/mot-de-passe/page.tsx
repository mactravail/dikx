"use client";

import { useActionState } from "react";
import Link from "next/link";
import { demanderReinitialisation } from "../actions";
import type { EtatAuth } from "../etat";
import { ChampTexte, MessageAuth, BoutonSoumettre } from "@/components/auth/champs";

export default function MotDePassePage() {
  const [etat, action, enCours] = useActionState<EtatAuth, FormData>(demanderReinitialisation, undefined);

  return (
    <form action={action} className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Mot de passe oublie</h1>
        <p className="mt-1 text-sm text-slate-500">
          Entrez votre email : vous recevrez un lien de reinitialisation.
        </p>
      </div>

      <MessageAuth etat={etat} />
      <ChampTexte label="Email" name="email" type="email" autoComplete="email" />

      <BoutonSoumettre enCours={enCours}>Envoyer le lien</BoutonSoumettre>

      <p className="text-center text-sm text-slate-500">
        <Link href="/login" className="font-medium text-brand-600 hover:text-brand-700">
          Retour a la connexion
        </Link>
      </p>
    </form>
  );
}
