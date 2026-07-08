/**
 * Jeu d'icones inline (SVG, style « stroke »), zero dependance.
 * Une seule source pour toute l'app : <Icon name="..." />.
 */
import type { JSX } from "react";

export type IconName =
  | "dashboard"
  | "entreprise"
  | "chart"
  | "invoice"
  | "clients"
  | "crm"
  | "stocks"
  | "achats"
  | "fournisseurs"
  | "production"
  | "comptabilite"
  | "tresorerie"
  | "charges"
  | "rapports"
  | "rh"
  | "projets"
  | "menu"
  | "close"
  | "logout"
  | "plus"
  | "search"
  | "bell";

const PATHS: Record<IconName, JSX.Element> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </>
  ),
  entreprise: (
    <>
      <path d="M3 21h18" />
      <path d="M5 21V5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v16" />
      <path d="M14 21V9h4a1 1 0 0 1 1 1v11" />
      <path d="M8 8h3M8 12h3M8 16h3" />
    </>
  ),
  chart: (
    <>
      <path d="M3 3v18h18" />
      <path d="M7 14l4-4 3 3 5-6" />
    </>
  ),
  invoice: (
    <>
      <path d="M6 2h9l4 4v16l-2.5-1.5L14 22l-2.5-1.5L9 22l-2.5-1.5L4 22V4a2 2 0 0 1 2-2z" />
      <path d="M8 8h7M8 12h7M8 16h4" />
    </>
  ),
  clients: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
      <path d="M16 8.5a3 3 0 0 1 0 5" />
      <path d="M17.5 20a5 5 0 0 0-3-4.6" />
    </>
  ),
  crm: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.4" />
    </>
  ),
  stocks: (
    <>
      <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" />
      <path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" />
    </>
  ),
  achats: (
    <>
      <circle cx="9" cy="20" r="1.4" />
      <circle cx="17" cy="20" r="1.4" />
      <path d="M2 3h2.2l2.3 12.2a1.5 1.5 0 0 0 1.5 1.2h8.4a1.5 1.5 0 0 0 1.5-1.2L21 7H5.2" />
    </>
  ),
  fournisseurs: (
    <>
      <path d="M2 6h11v10H2z" />
      <path d="M13 9h4.5l3.5 3.5V16H13z" />
      <circle cx="7" cy="18" r="1.6" />
      <circle cx="17" cy="18" r="1.6" />
    </>
  ),
  production: (
    <>
      <path d="M3 21V9l6 3V9l6 3V6l6 3v12H3z" />
      <path d="M7 17h.01M12 17h.01M17 17h.01" />
    </>
  ),
  comptabilite: (
    <>
      <path d="M5 3h11l3 3v15H5z" />
      <path d="M9 3v6h6" />
      <path d="M9 13h6M9 17h4" />
    </>
  ),
  tresorerie: (
    <>
      <path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M16 12h3v-2h-3a1 1 0 0 0 0 2z" />
      <path d="M3 9h11" />
    </>
  ),
  charges: (
    <>
      <path d="M5 2l1.5 1.5L8 2l1.5 1.5L11 2l1.5 1.5L14 2v20l-1.5-1.5L11 22l-1.5-1.5L8 22l-1.5-1.5L5 22z" />
      <path d="M8 8h6M8 12h6" />
    </>
  ),
  rapports: (
    <>
      <path d="M7 3h7l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M13 3v5h5" />
      <path d="M9 17v-3M12 17v-5M15 17v-2" />
    </>
  ),
  rh: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="2.2" />
      <path d="M5.5 16a3.5 3.5 0 0 1 7 0" />
      <path d="M15 9h4M15 13h4" />
    </>
  ),
  projets: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M8 11l2 2 4-4" />
      <path d="M8 16h8" />
    </>
  ),
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  logout: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5M21 12H9" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </>
  ),
};

export function Icon({
  name,
  className = "w-5 h-5",
}: {
  name: IconName;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
