"use client";

/**
 * Bloc « donner un acces » d'une carte entreprise (cote comptable) : inviter
 * l'utilisateur de l'entreprise par email + liste des invitations en cours.
 */

import { useState } from "react";
import { Icon } from "../icons";
import {
  inviterEntrepriseAction,
  listerInvitationsAction,
  revoquerInvitationAction,
  type InvitationVue,
} from "@/app/(app)/entreprises/invitations-actions";

const LIBELLE_STATUT: Record<string, string> = {
  en_attente: "En attente",
  acceptee: "Acceptee",
  revoquee: "Revoquee",
  expiree: "Expiree",
};

export function InvitationEntreprise({ entrepriseId }: { entrepriseId: string }) {
  const [ouvert, setOuvert] = useState(false);
  const [email, setEmail] = useState("");
  const [invitations, setInvitations] = useState<InvitationVue[]>([]);
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);

  const charger = async () => {
    setInvitations(await listerInvitationsAction(entrepriseId));
  };

  const basculer = async () => {
    const prochain = !ouvert;
    setOuvert(prochain);
    if (prochain) await charger();
  };

  const inviter = async () => {
    if (!email.trim() || enCours) return;
    setEnCours(true);
    setMessage(null);
    try {
      const r = await inviterEntrepriseAction(entrepriseId, email);
      if (r.ok) {
        setMessage({ ok: true, texte: r.message });
        setEmail("");
        await charger();
      } else {
        setMessage({ ok: false, texte: r.erreur });
      }
    } finally {
      setEnCours(false);
    }
  };

  const revoquer = async (id: string) => {
    await revoquerInvitationAction(id);
    await charger();
  };

  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      <button
        type="button"
        onClick={basculer}
        className="inline-flex items-center gap-2 text-sm font-medium text-brand-700 hover:text-brand-800"
      >
        <Icon name="clients" className="h-4 w-4" />
        Donner un acces a l&apos;entreprise
        <svg viewBox="0 0 20 20" className={`h-4 w-4 transition-transform ${ouvert ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={1.7}>
          <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {ouvert && (
        <div className="mt-3 space-y-3">
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@entreprise.sn"
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
            <button
              type="button"
              onClick={inviter}
              disabled={enCours}
              className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {enCours ? "…" : "Inviter"}
            </button>
          </div>

          {message && (
            <p className={`text-xs ${message.ok ? "text-emerald-700" : "text-red-600"}`}>
              {message.texte}
            </p>
          )}

          {invitations.length > 0 && (
            <ul className="space-y-1">
              {invitations.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="min-w-0 truncate text-slate-600">{inv.email}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                      {LIBELLE_STATUT[inv.statut] ?? inv.statut}
                    </span>
                    {inv.statut === "en_attente" && (
                      <button
                        type="button"
                        onClick={() => revoquer(inv.id)}
                        className="text-slate-400 hover:text-red-600"
                        aria-label="Revoquer"
                      >
                        <Icon name="close" className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
