"use client";

/**
 * Primitives de formulaire partagees par les ecrans du module Ventes
 * (facturation, clients, CRM). Uniquement de la presentation — aucun calcul.
 */
import type { ReactNode } from "react";

// Mobile-first : `text-base` (16px) sur mobile empeche le zoom automatique d'iOS
// au focus ; `py-2.5` donne une cible tactile confortable. Retour a la densite
// desktop a partir de `sm`.
export const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base text-slate-800 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 sm:py-2 sm:text-sm";

export function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}

export function Text({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      className={inputCls}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function Num({
  value,
  onChange,
  suffix,
  step,
  min = 0,
}: {
  value: number;
  onChange: (n: number) => void;
  suffix?: string;
  step?: number;
  min?: number;
}) {
  return (
    <div className="relative">
      <input
        type="number"
        className={inputCls}
        value={Number.isFinite(value) ? value : 0}
        min={min}
        step={step}
        onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
      />
      {suffix && (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
          {suffix}
        </span>
      )}
    </div>
  );
}

export function Modal({
  titre,
  onClose,
  children,
  footer,
}: {
  titre: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  // Mobile-first : feuille ancree en bas de l'ecran (bottom sheet), atteignable
  // au pouce, avec entete et pied d'action collants pendant le defilement d'un
  // formulaire long. A partir de `sm` : boite dialogue centree classique.
  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center overflow-y-auto bg-slate-900/40 sm:items-start sm:p-8"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-xl sm:max-h-none sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h3 className="text-sm font-semibold text-slate-800">{titre}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Fermer"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-slate-100 bg-white px-5 pt-3 pb-[calc(0.75rem_+_env(safe-area-inset-bottom))] sm:pb-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function BtnPrimary({
  children,
  onClick,
  disabled,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60 sm:py-2"
    >
      {children}
    </button>
  );
}

export function BtnGhost({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:py-2"
    >
      {children}
    </button>
  );
}
