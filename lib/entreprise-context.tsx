"use client";

/**
 * Contexte React de l'entreprise active. Fournit a toute l'app :
 *   - la liste des entreprises du cabinet (portefeuille),
 *   - l'entreprise active (celle sur laquelle on travaille),
 *   - les actions pour changer d'entreprise / creer / modifier / supprimer.
 *
 * Changer d'entreprise met a jour l'id scope (localStorage) : l'AppShell
 * remonte alors la zone de contenu (via une `key`) pour que les modules
 * rechargent leurs donnees scopees par la nouvelle entreprise.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Entreprise } from "./engine";
import {
  portefeuille,
  type EntrepriseBrouillon,
} from "./entreprise-store";

interface EntrepriseContextValue {
  /** true tant que l'etat n'est pas hydrate depuis le localStorage (SSR). */
  pretes: boolean;
  entreprises: Entreprise[];
  active: Entreprise | null;
  changerActive: (id: string | null) => void;
  creer: (b: EntrepriseBrouillon) => Entreprise;
  modifier: (id: string, patch: Partial<Entreprise>) => void;
  supprimer: (id: string) => void;
}

const EntrepriseContext = createContext<EntrepriseContextValue | null>(null);

export function EntrepriseProvider({ children }: { children: React.ReactNode }) {
  const [pretes, setPretes] = useState(false);
  const [entreprises, setEntreprises] = useState<Entreprise[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Hydratation cote client uniquement (localStorage indisponible en SSR).
  useEffect(() => {
    const liste = portefeuille.liste();
    setEntreprises(liste);
    const idCourant = portefeuille.getActiveId();
    // Si aucune entreprise active valide, on selectionne la premiere.
    const valide = idCourant && liste.some((e) => e.id === idCourant);
    const id = valide ? idCourant : (liste[0]?.id ?? null);
    portefeuille.setActiveId(id);
    setActiveId(id);
    setPretes(true);
  }, []);

  const changerActive = useCallback((id: string | null) => {
    portefeuille.setActiveId(id);
    setActiveId(id);
  }, []);

  const creer = useCallback((b: EntrepriseBrouillon): Entreprise => {
    const e = portefeuille.creer(b);
    setEntreprises(portefeuille.liste());
    return e;
  }, []);

  const modifier = useCallback((id: string, patch: Partial<Entreprise>) => {
    setEntreprises(portefeuille.modifier(id, patch));
  }, []);

  const supprimer = useCallback((id: string) => {
    const restantes = portefeuille.supprimer(id);
    setEntreprises(restantes);
    setActiveId(portefeuille.getActiveId());
  }, []);

  const active = useMemo(
    () => entreprises.find((e) => e.id === activeId) ?? null,
    [entreprises, activeId],
  );

  const value = useMemo<EntrepriseContextValue>(
    () => ({ pretes, entreprises, active, changerActive, creer, modifier, supprimer }),
    [pretes, entreprises, active, changerActive, creer, modifier, supprimer],
  );

  return (
    <EntrepriseContext.Provider value={value}>
      {children}
    </EntrepriseContext.Provider>
  );
}

export function useEntreprise(): EntrepriseContextValue {
  const ctx = useContext(EntrepriseContext);
  if (!ctx) {
    throw new Error("useEntreprise doit etre utilise dans <EntrepriseProvider>");
  }
  return ctx;
}
