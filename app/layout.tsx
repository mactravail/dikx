import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "raktak — Gestion d'entreprise",
  description:
    "ERP raktak pour entrepreneurs au Senegal : previsionnel financier, facturation, stocks, comptabilite, RH. Referentiel SYSCOHADA, FCFA.",
};

// Mobile-first : public majoritairement sur telephone (Senegal). `viewport-fit=cover`
// + zones sures (env(safe-area-*)) pour les encoches et la barre d'accueil iOS.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0f2340",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
