import Link from "next/link";
import { NAV_GROUPS, ALL_ITEMS } from "../../lib/nav";
import { Icon } from "../../components/icons";
import { Card, StatTile, StatutBadge, BoutonLien } from "../../components/ui";
import { EntrepriseHomeBanner } from "../../components/EntrepriseHomeBanner";
import { TableauBordComptable } from "../../components/dashboard/TableauBordComptable";

export default function DashboardHome() {
  const modules = ALL_ITEMS.filter((i) => i.href !== "/");
  const actifs = modules.filter((m) => m.statut === "actif").length;
  const bientot = modules.filter((m) => m.statut === "bientot").length;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* Entreprise active : contexte de travail du comptable */}
      <EntrepriseHomeBanner />

      {/* Hero */}
      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-brand-700 to-brand-900 p-6 text-white sm:p-8">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-semibold">Bonjour 👋</h1>
          <p className="mt-2 text-sm text-brand-100">
            Bienvenue sur <strong>raktak</strong>, votre plateforme de gestion
            d'entreprise pour le Senegal. Le previsionnel financier est
            operationnel ; les modules de gestion (facturation, stocks,
            comptabilite, RH…) arrivent progressivement.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/previsionnel"
              className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50"
            >
              <Icon name="chart" className="h-4 w-4" /> Ouvrir le previsionnel 5 ans
            </Link>
            <Link
              href="/facturation"
              className="inline-flex items-center gap-2 rounded-lg border border-white/30 px-4 py-2 text-sm font-medium text-white hover:bg-white/10"
            >
              <Icon name="invoice" className="h-4 w-4" /> Ouvrir la facturation
            </Link>
          </div>
        </div>
      </div>

      {/* Tableau de bord du comptable : KPI + rapport de tresorerie (moteurs) */}
      <TableauBordComptable />

      {/* Statistiques */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Modules actifs" value={actifs} hint="Operationnels" icon="dashboard" />
        <StatTile label="En preparation" value={bientot} hint="Feuille de route" icon="production" />
        <StatTile label="Referentiel" value="SYSCOHADA" hint="OHADA revise" icon="comptabilite" />
        <StatTile label="Devise" value="FCFA" hint="XOF · TVA 18 %" icon="charges" />
      </div>

      {/* Modules par groupe */}
      <div className="space-y-6">
        {NAV_GROUPS.map((groupe) => {
          const items = groupe.items.filter((i) => i.href !== "/");
          if (items.length === 0) return null;
          return (
            <section key={groupe.titre}>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                {groupe.titre}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((item) => (
                  <Link key={item.href} href={item.href} className="group">
                    <Card className="h-full p-5 transition-shadow group-hover:shadow-md">
                      <div className="flex items-start justify-between">
                        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                          <Icon name={item.icon} className="h-5 w-5" />
                        </span>
                        <StatutBadge statut={item.statut} />
                      </div>
                      <div className="mt-3 font-semibold text-slate-800 group-hover:text-brand-700">
                        {item.label}
                      </div>
                      <p className="mt-1 text-sm text-slate-500">{item.description}</p>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
