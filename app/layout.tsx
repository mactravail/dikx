import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "raktak — Gestion d'entreprise",
  description:
    "ERP raktak pour entrepreneurs au Senegal : previsionnel financier, facturation, stocks, comptabilite, RH. Referentiel SYSCOHADA, FCFA.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
