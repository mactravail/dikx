import { AppShell } from "../../components/AppShell";
import { EntrepriseProvider } from "../../lib/entreprise-context";

/** Layout partage par toutes les pages de l'ERP (sidebar + topbar + entreprise active). */
export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <EntrepriseProvider>
      <AppShell>{children}</AppShell>
    </EntrepriseProvider>
  );
}
