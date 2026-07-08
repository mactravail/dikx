/**
 * Primitives UI partagees (serveur) — un seul style pour tout l'ERP.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "./icons";
import type { ModuleStatut } from "../lib/nav";
import {
  LIBELLE_REGIME_COMPTABLE,
  LIBELLE_REGIME_FISCAL,
  type RegimeComptable,
  type RegimeFiscal,
} from "../lib/engine";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

export function StatTile({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: IconName;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {label}
          </div>
          <div className="mt-1 text-2xl font-semibold text-slate-800">{value}</div>
          {hint && <div className="mt-0.5 text-xs text-slate-400">{hint}</div>}
        </div>
        {icon && (
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <Icon name={icon} className="h-5 w-5" />
          </span>
        )}
      </div>
    </Card>
  );
}

export function StatutBadge({ statut }: { statut: ModuleStatut }) {
  if (statut === "actif") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Actif
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Bientot
    </span>
  );
}

/**
 * Badge de regime d'une entreprise : distingue visuellement le formel (Systeme
 * Normal + reel) de l'informel (tresorerie + CGU). `taille` compacte pour la
 * topbar, normale pour les cartes du portefeuille.
 */
export function RegimeBadge({
  regimeComptable,
  regimeFiscal,
  taille = "normal",
}: {
  regimeComptable: RegimeComptable;
  regimeFiscal: RegimeFiscal;
  taille?: "normal" | "compact";
}) {
  const informel = regimeFiscal === "cgu" || regimeComptable !== "normal";
  const couleurs = informel
    ? "bg-amber-50 text-amber-700 ring-amber-600/20"
    : "bg-brand-50 text-brand-700 ring-brand-600/20";
  const pad = taille === "compact" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ring-1 ring-inset ${couleurs} ${pad}`}
      title={informel ? "Regime informel / allege" : "Regime formel"}
    >
      {informel ? "Informel" : "Formel"}
      <span className="opacity-50">·</span>
      {LIBELLE_REGIME_FISCAL[regimeFiscal]}
      {taille === "normal" && (
        <>
          <span className="opacity-50">·</span>
          {LIBELLE_REGIME_COMPTABLE[regimeComptable]}
        </>
      )}
    </span>
  );
}

export function PageHeading({
  titre,
  sousTitre,
  action,
}: {
  titre: string;
  sousTitre?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">{titre}</h1>
        {sousTitre && <p className="mt-1 text-sm text-slate-500">{sousTitre}</p>}
      </div>
      {action}
    </div>
  );
}

export function BoutonLien({
  href,
  children,
  variante = "primary",
  icon,
}: {
  href: string;
  children: ReactNode;
  variante?: "primary" | "ghost";
  icon?: IconName;
}) {
  const base =
    "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors";
  const styles =
    variante === "primary"
      ? "bg-brand-600 text-white hover:bg-brand-700"
      : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50";
  return (
    <Link href={href} className={`${base} ${styles}`}>
      {icon && <Icon name={icon} className="h-4 w-4" />}
      {children}
    </Link>
  );
}
