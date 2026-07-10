"use client";

/**
 * Contexte React de l'entreprise active. Les donnees viennent desormais du
 * SERVEUR (Supabase, RLS) : le layout (app)/layout.tsx charge le portefeuille et
 * l'id actif (cookie) et les passe en props initiales. Les mutations passent par
 * les server actions de app/(app)/entreprises/data-actions.ts.
 *
 * L'id actif est aussi mirroir dans le localStorage (setActiveEntrepriseId) tant
 * que certains modules stockent encore leurs SAISIES en localStorage scope par
 * `scopedKey` : ils continuent ainsi de cloisonner leurs donnees par entreprise.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import type { Entreprise } from "./engine";
import type { EntrepriseBrouillon } from "./entreprise-store";
import { setActiveEntrepriseId } from "./entreprise-active";
import {
  creerEntrepriseAction,
  modifierEntrepriseAction,
  supprimerEntrepriseAction,
  definirEntrepriseActiveAction,
} from "@/app/(app)/entreprises/data-actions";

interface EntrepriseContextValue {
  /** Conserve pour compatibilite : true (donnees fournies par le serveur). */
  pretes: boolean;
  entreprises: Entreprise[];
  active: Entreprise | null;
  /** true pour un utilisateur « entreprise » : active figee, pas de changement. */
  verrouille: boolean;
  changerActive: (id: string | null) => Promise<void>;
  creer: (b: EntrepriseBrouillon) => Promise<Entreprise>;
  modifier: (id: string, patch: Partial<Entreprise>) => Promise<void>;
  supprimer: (id: string) => Promise<void>;
}

const EntrepriseContext = createContext<EntrepriseContextValue | null>(null);

export function EntrepriseProvider({
  initialEntreprises,
  initialActiveId,
  verrouille = false,
  children,
}: {
  initialEntreprises: Entreprise[];
  initialActiveId: string | null;
  verrouille?: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [entreprises, setEntreprises] = useState<Entreprise[]>(initialEntreprises);
  const [activeId, setActiveId] = useState<string | null>(initialActiveId);

  // Resynchronise si le serveur renvoie de nouvelles props (apres router.refresh).
  useEffect(() => setEntreprises(initialEntreprises), [initialEntreprises]);
  useEffect(() => setActiveId(initialActiveId), [initialActiveId]);

  // Miroir localStorage de l'id actif (scopedKey des modules encore locaux).
  useEffect(() => {
    setActiveEntrepriseId(activeId);
  }, [activeId]);

  const changerActive = useCallback(
    async (id: string | null) => {
      if (verrouille) return;
      setActiveId(id);
      setActiveEntrepriseId(id);
      await definirEntrepriseActiveAction(id);
      router.refresh();
    },
    [verrouille, router],
  );

  const creer = useCallback(async (b: EntrepriseBrouillon): Promise<Entreprise> => {
    const e = await creerEntrepriseAction(b);
    setEntreprises((prev) => [...prev, e]);
    return e;
  }, []);

  const modifier = useCallback(async (id: string, patch: Partial<Entreprise>) => {
    const e = await modifierEntrepriseAction(id, patch);
    setEntreprises((prev) => prev.map((x) => (x.id === id ? e : x)));
  }, []);

  const supprimer = useCallback(async (id: string) => {
    await supprimerEntrepriseAction(id);
    setEntreprises((prev) => prev.filter((x) => x.id !== id));
    setActiveId((cur) => (cur === id ? null : cur));
  }, []);

  const active = useMemo(
    () => entreprises.find((e) => e.id === activeId) ?? null,
    [entreprises, activeId],
  );

  const value = useMemo<EntrepriseContextValue>(
    () => ({ pretes: true, entreprises, active, verrouille, changerActive, creer, modifier, supprimer }),
    [entreprises, active, verrouille, changerActive, creer, modifier, supprimer],
  );

  return <EntrepriseContext.Provider value={value}>{children}</EntrepriseContext.Provider>;
}

export function useEntreprise(): EntrepriseContextValue {
  const ctx = useContext(EntrepriseContext);
  if (!ctx) {
    throw new Error("useEntreprise doit etre utilise dans <EntrepriseProvider>");
  }
  return ctx;
}
