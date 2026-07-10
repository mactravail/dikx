"use client";

/**
 * Bandeau du tableau de bord : rappelle sur QUELLE entreprise cliente le
 * comptable travaille (et son regime), ou l'invite a en choisir une.
 */

import Link from "next/link";
import { Icon } from "./icons";
import { RegimeBadge } from "./ui";
import { useEntreprise } from "../lib/entreprise-context";

export function EntrepriseHomeBanner() {
  const { pretes, active, entreprises } = useEntreprise();

  if (!pretes) {
    return <div className="h-16 animate-pulse rounded-xl bg-slate-100" aria-hidden />;
  }

  // Aucune entreprise selectionnee (ou portefeuille vide) : on oriente.
  if (!active) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
            <Icon name="entreprise" className="h-5 w-5" />
          </span>
          <div>
            <div className="text-sm font-medium text-amber-900">
              Aucune entreprise selectionnee
            </div>
            <div className="text-xs text-amber-700">
              {entreprises.length > 0
                ? "Choisissez le dossier client sur lequel travailler."
                : "Creez votre premiere entreprise cliente."}
            </div>
          </div>
        </div>
        <Link
          href="/entreprises"
          className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700"
        >
          <Icon name="entreprise" className="h-4 w-4" />
          Ouvrir le portefeuille
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
          <Icon name="entreprise" className="h-5 w-5" />
        </span>
        <div>
          <div className="text-[11px] uppercase tracking-wide text-slate-400">
            Entreprise active
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-slate-800">
              {active.raisonSociale}
            </span>
            <RegimeBadge
              regimeComptable={active.regimeComptable}
              regimeFiscal={active.regimeFiscal}
            />
          </div>
        </div>
      </div>
      <Link
        href="/entreprises"
        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        Changer d'entreprise
      </Link>
    </div>
  );
}
