"use client";

/**
 * Coque de l'ERP : sidebar (navigation entre tous les modules) + topbar + zone
 * de contenu. Client component car il gere l'etat actif (usePathname) et le
 * tiroir mobile. Les `children` sont des pages rendues cote serveur.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { NAV_GROUPS, navPourRole, navMobileBas, cheminAutorise, findItem, type NavItem } from "../lib/nav";
import { Icon } from "./icons";
import { EntrepriseSelector } from "./EntrepriseSelector";
import { UserMenu } from "./UserMenu";
import { useEntreprise } from "../lib/entreprise-context";
import { useSession, initialesDe } from "../lib/session-context";

function estActif(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function LienModule({
  item,
  actif,
  onClick,
}: {
  item: NavItem;
  actif: boolean;
  onClick: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onClick}
      aria-current={actif ? "page" : undefined}
      className={[
        "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
        actif
          ? "bg-brand-600 text-white shadow-sm"
          : "text-slate-300 hover:bg-[var(--color-sidebar-hover)] hover:text-white",
      ].join(" ")}
    >
      <Icon name={item.icon} className="h-[18px] w-[18px] shrink-0" />
      <span className="flex-1 truncate">{item.label}</span>
      {item.statut === "bientot" && (
        <span
          className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-slate-300"
          title="Bientot disponible"
        >
          bientot
        </span>
      )}
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { active } = useEntreprise();
  const { email, nom, role } = useSession();
  const groupes = role === "comptable" ? NAV_GROUPS : navPourRole(role);
  const courant = findItem(pathname) ?? groupes[0]?.items[0] ?? NAV_GROUPS[0]!.items[0]!;
  const raccourcisBas = navMobileBas(role);
  const fermer = () => setOpen(false);

  // Garde-fou UX : un utilisateur entreprise ne reste pas sur une route reservee
  // au comptable (l'autorite sur les donnees reste la RLS).
  useEffect(() => {
    if (role === "entreprise" && !cheminAutorise(pathname, role)) {
      router.replace("/");
    }
  }, [pathname, role, router]);

  const contenuSidebar = (
    <div className="flex h-full flex-col bg-[var(--color-sidebar)]">
      {/* Marque */}
      <div className="flex items-center gap-2.5 px-5 py-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500 text-lg font-bold text-white">
          r
        </span>
        <div className="leading-tight">
          <div className="text-[15px] font-semibold text-white">raktak</div>
          <div className="text-[11px] text-slate-400">Gestion d'entreprise</div>
        </div>
      </div>

      {/* Groupes de navigation */}
      <nav className="scroll-thin flex-1 space-y-5 overflow-y-auto px-3 pb-6">
        {groupes.map((groupe) => (
          <div key={groupe.titre}>
            <div className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {groupe.titre}
            </div>
            <div className="space-y-0.5">
              {groupe.items.map((item) => (
                <LienModule
                  key={item.href}
                  item={item}
                  actif={estActif(pathname, item.href)}
                  onClick={fermer}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Pied : contexte SYSCOHADA */}
      <div className="border-t border-white/10 px-5 py-3 text-[11px] text-slate-500">
        Senegal · SYSCOHADA · FCFA
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      {/* Sidebar desktop */}
      <aside className="sticky top-0 hidden h-screen lg:block">{contenuSidebar}</aside>

      {/* Tiroir mobile */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={fermer}
            aria-hidden="true"
          />
          <div className="absolute left-0 top-0 h-full w-[260px]">{contenuSidebar}</div>
        </div>
      )}

      {/* Colonne de contenu */}
      <div className="flex min-w-0 flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur sm:px-6">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden"
            aria-label="Ouvrir le menu"
          >
            <Icon name="menu" />
          </button>

          {/* Comptable : selecteur du dossier client. Entreprise : nom fige. */}
          {role === "comptable" ? (
            <EntrepriseSelector />
          ) : (
            active && (
              <div className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600">
                  <Icon name="entreprise" className="h-4 w-4" />
                </span>
                <span className="block max-w-[9rem] truncate text-sm font-medium text-slate-800 sm:max-w-[12rem]">
                  {active.raisonSociale}
                </span>
              </div>
            )
          )}

          <div className="hidden min-w-0 flex-1 sm:block">
            <div className="truncate text-[15px] font-semibold text-slate-800">
              {courant.label}
            </div>
            <div className="truncate text-xs text-slate-500">{courant.description}</div>
          </div>
          <div className="flex-1 sm:hidden" />

          <button
            type="button"
            className="hidden rounded-lg p-2 text-slate-500 hover:bg-slate-100 sm:block"
            aria-label="Notifications"
          >
            <Icon name="bell" />
          </button>
          <UserMenu email={email} initiales={initialesDe(nom, email)} />
        </header>

        {/* key = entreprise active : remonte le contenu au changement d'entreprise
            pour que les modules rechargent leurs donnees scopees.
            pb-24 : reserve la place de la barre d'onglets basse (mobile). */}
        <main
          key={active?.id ?? "aucune"}
          className="flex-1 overflow-x-clip px-4 pt-6 pb-24 sm:px-6 lg:px-8 lg:pb-8"
        >
          {children}
        </main>
      </div>

      {/* Barre d'onglets basse — navigation au pouce (mobile uniquement). Le
          bouton « Menu » ouvre le tiroir complet ci-dessus. */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 flex border-t border-slate-200 bg-white/95 backdrop-blur lg:hidden">
        {raccourcisBas.map((item) => {
          const actif = estActif(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={fermer}
              aria-current={actif ? "page" : undefined}
              className={[
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
                actif ? "text-brand-600" : "text-slate-500 hover:text-slate-700",
              ].join(" ")}
            >
              <Icon name={item.icon} className="h-[22px] w-[22px]" />
              <span className="max-w-full truncate px-0.5">{item.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium text-slate-500 hover:text-slate-700"
          aria-label="Ouvrir le menu complet"
        >
          <Icon name="menu" className="h-[22px] w-[22px]" />
          <span>Menu</span>
        </button>
      </nav>
    </div>
  );
}
