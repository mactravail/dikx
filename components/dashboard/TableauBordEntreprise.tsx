"use client";

/**
 * Tableau de bord de l'utilisateur « entreprise » : accueil simplifie, oriente
 * SAISIE. L'entreprise enregistre ses operations (entrees/sorties, factures,
 * stock, charges, employes) ; le comptable les recoit directement dans son
 * espace. Aucun calcul ici : les modules affichent des totaux issus du moteur.
 */

import Link from "next/link";
import { Card } from "../ui";
import { Icon } from "../icons";
import { navPourRole } from "../../lib/nav";
import { useEntreprise } from "../../lib/entreprise-context";
import { PanneauTransmission } from "./PanneauTransmission";

export function TableauBordEntreprise() {
  const { active } = useEntreprise();
  // Modules de saisie autorises a l'entreprise (hors « Tableau de bord »).
  const modules = navPourRole("entreprise")
    .flatMap((g) => g.items)
    .filter((i) => i.href !== "/");

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-brand-700 to-brand-900 p-6 text-white sm:p-8">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-semibold">Bonjour 👋</h1>
          <p className="mt-1 text-sm font-medium text-brand-100">
            {active ? active.raisonSociale : "Votre entreprise"}
          </p>
          <p className="mt-3 text-sm text-brand-100">
            Enregistrez ici les operations de votre activite : vos{" "}
            <strong>entrees et sorties d'argent</strong>, vos <strong>factures</strong>, votre{" "}
            <strong>stock</strong>, vos <strong>charges</strong> et vos <strong>employes</strong>.
            Votre comptable recoit ces informations directement pour tenir votre comptabilite.
          </p>
          <div className="mt-5">
            <Link
              href="/tresorerie"
              className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50"
            >
              <Icon name="tresorerie" className="h-4 w-4" /> Saisir une entree / sortie
            </Link>
          </div>
        </div>
      </div>

      {/* Ce que le comptable attend : chiffres en brouillon + envoi par lot. */}
      <PanneauTransmission />

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Que souhaitez-vous saisir ?
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((item) => (
            <Link key={item.href} href={item.href} className="group">
              <Card className="h-full p-5 transition-shadow group-hover:shadow-md">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <Icon name={item.icon} className="h-5 w-5" />
                </span>
                <div className="mt-3 font-semibold text-slate-800 group-hover:text-brand-700">
                  {item.label}
                </div>
                <p className="mt-1 text-sm text-slate-500">{item.description}</p>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
