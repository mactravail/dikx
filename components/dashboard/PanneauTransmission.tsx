"use client";

/**
 * Panneau « A transmettre au comptable » du tableau de bord ENTREPRISE.
 *
 * L'entreprise saisit ses chiffres (entrees/sorties, factures, depenses,
 * employes) : ils restent en BROUILLON, prives, tant qu'elle ne les ENVOIE pas.
 * Ce panneau compte les brouillons et declenche l'ENVOI PAR LOT : un seul geste
 * transmet tout au comptable (server action ; aucun calcul ici).
 */
import { useCallback, useEffect, useState, useTransition } from "react";
import { Icon, type IconName } from "../icons";
import { useEntreprise } from "../../lib/entreprise-context";
import {
  compterBrouillonsAction,
  envoyerAuComptableAction,
  type CompteursBrouillon,
} from "../../app/(app)/transmission/data-actions";

type CleModule = "tresorerie" | "factures" | "charges" | "employes";

const MODULES: { cle: CleModule; label: string; icon: IconName }[] = [
  { cle: "tresorerie", label: "entrees / sorties", icon: "tresorerie" },
  { cle: "factures", label: "factures", icon: "invoice" },
  { cle: "charges", label: "depenses", icon: "charges" },
  { cle: "employes", label: "employes", icon: "rh" },
];

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function PanneauTransmission() {
  const { active } = useEntreprise();
  const entrepriseId = active?.id ?? "";
  const [compteurs, setCompteurs] = useState<CompteursBrouillon | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [envoiEnCours, demarrerEnvoi] = useTransition();

  const recharger = useCallback(async () => {
    if (!entrepriseId) {
      setCompteurs(null);
      return;
    }
    setCompteurs(await compterBrouillonsAction(entrepriseId));
  }, [entrepriseId]);

  useEffect(() => {
    void recharger();
  }, [recharger]);

  const envoyer = () => {
    setMessage(null);
    demarrerEnvoi(async () => {
      const n = await envoyerAuComptableAction(entrepriseId);
      setMessage(
        n > 0
          ? `${n} element${n > 1 ? "s" : ""} transmis a votre comptable.`
          : "Rien a transmettre pour le moment.",
      );
      await recharger();
    });
  };

  if (!entrepriseId || !compteurs) return null;

  const { total } = compteurs;

  // Tout est a jour : rien en brouillon.
  if (total === 0) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-lg text-emerald-700">
            ✓
          </span>
          <div>
            <p className="font-semibold text-emerald-900">Tout est transmis</p>
            <p className="text-sm text-emerald-700">
              {compteurs.dernierEnvoi
                ? `Dernier envoi le ${formatDate(compteurs.dernierEnvoi)}.`
                : "Aucun chiffre en attente. Saisissez vos operations ci-dessous."}
            </p>
          </div>
        </div>
        {message && <p className="mt-3 text-sm font-medium text-emerald-800">{message}</p>}
      </div>
    );
  }

  // Des brouillons attendent d'etre transmis.
  const details = MODULES.filter((m) => compteurs[m.cle] > 0);

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-semibold text-amber-900">
            {total} element{total > 1 ? "s" : ""} a transmettre
          </p>
          <p className="mt-0.5 text-sm text-amber-800">
            Ces chiffres sont encore en <strong>brouillon</strong> : votre comptable ne les voit pas
            encore. Envoyez-les quand vous etes pret.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {details.map((m) => (
              <span
                key={m.cle}
                className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-200"
              >
                <Icon name={m.icon} className="h-3.5 w-3.5" />
                {compteurs[m.cle]} {m.label}
              </span>
            ))}
          </div>
          {compteurs.dernierEnvoi && (
            <p className="mt-2 text-xs text-amber-700">
              Dernier envoi le {formatDate(compteurs.dernierEnvoi)}.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={envoyer}
          disabled={envoiEnCours}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {envoiEnCours ? "Envoi..." : "Envoyer au comptable"}
        </button>
      </div>
      {message && <p className="mt-3 text-sm font-medium text-amber-900">{message}</p>}
    </div>
  );
}
