"use client";

/**
 * Menu utilisateur (topbar) : avatar cliquable ouvrant un petit menu avec
 * l'email du compte et l'action « Se deconnecter » (signOut Supabase reel).
 */

import { useEffect, useRef, useState } from "react";
import { Icon } from "./icons";
import { seDeconnecter } from "@/app/(auth)/actions";

export function UserMenu({
  email,
  initiales,
}: {
  email: string;
  initiales: string;
}) {
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

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOuvert((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={ouvert}
        aria-label="Menu du compte"
        title={email}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-200"
      >
        {initiales}
      </button>

      {ouvert && (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-1.5 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
        >
          <div className="border-b border-slate-100 px-3 py-3">
            <div className="text-sm font-semibold text-slate-800">Mon compte</div>
            <div className="truncate text-xs text-slate-500">{email}</div>
          </div>
          <form action={seDeconnecter}>
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Icon name="logout" className="h-[18px] w-[18px] text-slate-500" />
              Se déconnecter
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
