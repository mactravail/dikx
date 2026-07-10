"use client";

/**
 * Pastille d'etat de transmission d'une ligne de saisie (brouillon / envoye).
 * Utilisee dans les listes des modules cote ENTREPRISE pour signaler ce qui a
 * deja ete transmis au comptable (verrouille) vs. ce qui reste en brouillon.
 */
import type { EtatTransmission } from "../lib/transmission";

export function BadgeTransmission({ etat }: { etat: EtatTransmission | undefined }) {
  if (etat === "envoye") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Envoye
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 ring-1 ring-inset ring-slate-500/20">
      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" /> Brouillon
    </span>
  );
}
