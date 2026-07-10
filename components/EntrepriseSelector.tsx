"use client";

/**
 * Selecteur d'entreprise (topbar). Affiche l'entreprise active et permet au
 * comptable de basculer d'un dossier client a l'autre, ou d'aller gerer son
 * portefeuille. Changer d'entreprise met a jour le scope des donnees (via le
 * contexte) et l'AppShell remonte la zone de contenu.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "./icons";
import { RegimeBadge } from "./ui";
import { useEntreprise } from "../lib/entreprise-context";

export function EntrepriseSelector() {
  const { pretes, entreprises, active, changerActive } = useEntreprise();
  const [ouvert, setOuvert] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ouvert) return;
    const surClic = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOuvert(false);
    };
    document.addEventListener("mousedown", surClic);
    return () => document.removeEventListener("mousedown", surClic);
  }, [ouvert]);

  // Evite un flash pendant l'hydratation (localStorage indisponible en SSR).
  if (!pretes) {
    return <div className="h-9 w-40 animate-pulse rounded-lg bg-slate-100" aria-hidden />;
  }

  return (
    <div ref={ref} className="relative min-w-0">
      <button
        type="button"
        onClick={() => setOuvert((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={ouvert}
        className="flex w-full max-w-[11rem] items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-left hover:bg-slate-50 sm:max-w-[15rem]"
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600">
          <Icon name="entreprise" className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-slate-800">
            {active ? active.raisonSociale : "Choisir une entreprise"}
          </span>
          {active && (
            <span className="block text-[11px] text-slate-500">
              {active.formeJuridique}
              {active.ninea ? ` · NINEA ${active.ninea}` : ""}
            </span>
          )}
        </span>
        <svg
          viewBox="0 0 20 20"
          className="ml-auto h-4 w-4 shrink-0 text-slate-400"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.7}
        >
          <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {ouvert && (
        <div
          role="listbox"
          className="absolute left-0 z-40 mt-1.5 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
        >
          <div className="max-h-72 overflow-y-auto py-1">
            {entreprises.length === 0 && (
              <div className="px-3 py-4 text-center text-sm text-slate-500">
                Aucune entreprise dans le portefeuille.
              </div>
            )}
            {entreprises.map((e) => {
              const actif = e.id === active?.id;
              return (
                <button
                  key={e.id}
                  type="button"
                  role="option"
                  aria-selected={actif}
                  onClick={() => {
                    void changerActive(e.id);
                    setOuvert(false);
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 ${
                    actif ? "bg-brand-50/50" : ""
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-800">
                      {e.raisonSociale}
                    </span>
                    <span className="mt-0.5 block">
                      <RegimeBadge
                        regimeComptable={e.regimeComptable}
                        regimeFiscal={e.regimeFiscal}
                        taille="compact"
                      />
                    </span>
                  </span>
                  {actif && (
                    <svg
                      viewBox="0 0 20 20"
                      className="h-4 w-4 shrink-0 text-brand-600"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path d="M5 10l3.5 3.5L15 6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
          <div className="border-t border-slate-100">
            <Link
              href="/entreprises"
              onClick={() => setOuvert(false)}
              className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-brand-700 hover:bg-slate-50"
            >
              <Icon name="entreprise" className="h-4 w-4" />
              Gerer le portefeuille
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
