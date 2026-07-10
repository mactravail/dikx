"use client";

/** Petits blocs de formulaire partages par les pages d'auth. */
import type { EtatAuth } from "@/app/(auth)/etat";

export function ChampTexte({
  label,
  name,
  type = "text",
  autoComplete,
  required = true,
  placeholder,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <input
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
      />
    </label>
  );
}

export function MessageAuth({ etat }: { etat: EtatAuth }) {
  if (!etat?.erreur && !etat?.info) return null;
  const erreur = Boolean(etat?.erreur);
  return (
    <div
      role="alert"
      className={[
        "rounded-lg border px-3 py-2 text-sm",
        erreur
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700",
      ].join(" ")}
    >
      {etat?.erreur ?? etat?.info}
    </div>
  );
}

export function BoutonSoumettre({ enCours, children }: { enCours: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={enCours}
      className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {enCours ? "Un instant…" : children}
    </button>
  );
}
