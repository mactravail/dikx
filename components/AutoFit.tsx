"use client";

/**
 * Force son contenu (un montant FCFA, un nombre) a tenir sur UNE SEULE LIGNE :
 * reduit automatiquement la taille de police jusqu'a ce qu'il rentre dans la
 * largeur du conteneur. Robuste a n'importe quelle magnitude — « 0 FCFA » comme
 * « 100 000 000 FCFA » restent sur une ligne, sans jamais deborder ni provoquer
 * de scroll horizontal.
 *
 * Purement de l'AFFICHAGE : aucun calcul metier ici.
 */
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

export function AutoFit({
  children,
  className = "",
  max = 20,
  min = 11,
}: {
  children: ReactNode;
  /** Classes appliquees au cadre (couleur, graisse, marges…). */
  className?: string;
  /** Taille de police maximale, en px (montant court). */
  max?: number;
  /** Plancher, en px (montant tres long). */
  min?: number;
}) {
  const boite = useRef<HTMLDivElement>(null);
  const texte = useRef<HTMLSpanElement>(null);
  const [px, setPx] = useState(max);

  const ajuster = useCallback(() => {
    const b = boite.current;
    const t = texte.current;
    if (!b || !t) return;
    let taille = max;
    t.style.fontSize = `${taille}px`;
    // Reduit tant que le texte deborde la largeur disponible (pas plus bas que `min`).
    while (taille > min && t.scrollWidth > b.clientWidth) {
      taille -= 0.5;
      t.style.fontSize = `${taille}px`;
    }
    setPx(taille);
  }, [max, min]);

  // Re-mesure a chaque rendu (le montant a pu changer) — operation peu couteuse.
  useLayoutEffect(() => {
    ajuster();
  });

  // Re-mesure quand la tuile est redimensionnee (rotation, changement de layout).
  useLayoutEffect(() => {
    const b = boite.current;
    if (!b || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => ajuster());
    ro.observe(b);
    return () => ro.disconnect();
  }, [ajuster]);

  return (
    <div ref={boite} className={`overflow-hidden ${className}`}>
      <span
        ref={texte}
        className="inline-block whitespace-nowrap"
        style={{ fontSize: `${px}px` }}
      >
        {children}
      </span>
    </div>
  );
}
