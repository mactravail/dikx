"use client";

/**
 * Contexte de SESSION applicative : identite + role de l'utilisateur connecte.
 * Alimente cote serveur par app/(app)/layout.tsx (a partir de getUser() + profil)
 * et consomme par la coque (AppShell, UserMenu, navigation par role).
 */
import { createContext, useContext } from "react";

export type AppRole = "comptable" | "entreprise";

export interface SessionValeur {
  userId: string;
  email: string;
  role: AppRole;
  nom: string | null;
}

const SessionContext = createContext<SessionValeur | null>(null);

export function SessionProvider({
  valeur,
  children,
}: {
  valeur: SessionValeur;
  children: React.ReactNode;
}) {
  return <SessionContext.Provider value={valeur}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValeur {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession doit etre utilise dans <SessionProvider>");
  }
  return ctx;
}

/** Initiales d'affichage (avatar) a partir du nom, sinon de l'email. */
export function initialesDe(nom: string | null, email: string): string {
  const source = (nom && nom.trim()) || email.split("@")[0] || "?";
  const mots = source.trim().split(/[\s._-]+/).filter(Boolean);
  const lettres = mots.length >= 2 ? mots[0]![0]! + mots[1]![0]! : source.slice(0, 2);
  return lettres.toUpperCase();
}
