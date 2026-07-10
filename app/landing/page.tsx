import type { Metadata } from "next";
import Link from "next/link";

/**
 * Landing page (vitrine) de raktak — hors du groupe (app), donc rendue sans la
 * sidebar/topbar de l'ERP. C'est la destination de « Se deconnecter ».
 * Contenu statique : composant serveur, aucun calcul.
 */

export const metadata: Metadata = {
  title: "raktak — L'ERP des entrepreneurs au Sénégal (SYSCOHADA · FCFA)",
  description:
    "raktak est l'application de gestion tout-en-un pour PME au Sénégal : prévisionnel financier 5 ans, facturation, stocks, comptabilité SYSCOHADA, RH. En FCFA, conforme au référentiel révisé.",
};

const MODULES = [
  { titre: "Ventes", desc: "Devis, factures, avoirs, clients & CRM." },
  { titre: "Achats & Stock", desc: "Fournisseurs, stocks (CUMP), production / MRP." },
  { titre: "Finance", desc: "Comptabilité SYSCOHADA, charges, trésorerie." },
  { titre: "Organisation", desc: "Paie & ressources humaines, projets & tâches." },
  { titre: "Prévisionnel 5 ans", desc: "Les 9 tableaux + DSCR, prêt pour la banque." },
  { titre: "Pilotage", desc: "Tableau de bord, ratios et rapport d'exercice." },
];

const ETAPES = [
  {
    n: "1",
    titre: "Vous saisissez",
    desc: "Ventes, achats, dépenses, paie… Une interface guidée, sur ordinateur comme sur téléphone.",
  },
  {
    n: "2",
    titre: "Le moteur calcule",
    desc: "Un moteur déterministe et testé produit chaque montant : TVA, écritures, valorisation de stock, indicateurs.",
  },
  {
    n: "3",
    titre: "Vous pilotez",
    desc: "États financiers, tableau de bord et rapports conformes SYSCOHADA — en FCFA, prêts à présenter.",
  },
];

const ATOUTS = [
  {
    ico: "🔒",
    titre: "Moteur déterministe & testé",
    desc: "Aucun chiffre n'est calculé dans votre navigateur : tout vient d'un moteur couvert par des tests unitaires.",
  },
  {
    ico: "🏛️",
    titre: "Conforme SYSCOHADA",
    desc: "Référentiel SYSCOHADA révisé, devise FCFA (XOF), TVA à 18 %. Montants en FCFA entiers, arrondis de façon centralisée.",
  },
  {
    ico: "🏢",
    titre: "Multi-entreprises",
    desc: "Pensé pour le cabinet comptable : gérez le portefeuille de vos clients, formels comme informels, chacun avec son régime.",
  },
  {
    ico: "⚙️",
    titre: "Taux paramétrables",
    desc: "TVA, IS, charges sociales, durées d'amortissement : aucun taux codé en dur. Tout reste ajustable et validable par un expert.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-slate-800">
      {/* ============ En-tete ============ */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
          <Link href="/landing" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500 text-lg font-bold text-white">
              r
            </span>
            <span className="leading-tight">
              <span className="block text-[15px] font-semibold text-slate-900">raktak</span>
              <span className="block text-[11px] text-slate-500">Gestion d'entreprise · Sénégal</span>
            </span>
          </Link>
          <nav className="ml-4 hidden items-center gap-6 text-sm text-slate-600 md:flex" aria-label="Navigation principale">
            <a href="#modules" className="hover:text-slate-900">Modules</a>
            <a href="#etapes" className="hover:text-slate-900">Comment ça marche</a>
            <a href="#atouts" className="hover:text-slate-900">Pourquoi raktak</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/"
              className="hidden rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 sm:block"
            >
              Se connecter
            </Link>
            <Link
              href="/"
              className="rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
            >
              Ouvrir l'application
            </Link>
          </div>
        </div>
      </header>

      {/* ============ Hero ============ */}
      <section className="relative overflow-hidden bg-[var(--color-sidebar)] text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
          <div>
            <span className="inline-block rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-brand-100">
              Sénégal · SYSCOHADA révisé · FCFA (XOF)
            </span>
            <h1 className="mt-5 text-4xl font-bold leading-tight sm:text-5xl">
              Gérez toute votre entreprise,
              <br />
              <span className="text-brand-300">sans jamais faire un calcul.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-slate-300">
              raktak réunit facturation, stocks, comptabilité, paie et prévisionnel financier dans une
              seule application. Vous saisissez, un <strong className="text-white">moteur déterministe et
              testé</strong> calcule chaque montant — en FCFA, conforme SYSCOHADA.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/"
                className="rounded-lg bg-brand-500 px-5 py-3 text-base font-semibold text-white shadow-sm hover:bg-brand-400"
              >
                Ouvrir l'application
              </Link>
              <a
                href="#modules"
                className="rounded-lg border border-white/20 px-5 py-3 text-base font-semibold text-white hover:bg-white/10"
              >
                Voir les modules →
              </a>
            </div>
            <p className="mt-6 flex items-center gap-2 text-sm text-slate-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Aucun montant calculé dans votre navigateur : tout vient du moteur serveur.
            </p>
          </div>

          {/* Apercu produit (maquette illustrative) */}
          <div className="relative" aria-hidden="true">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur">
              <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-3">
                <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
                <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
                <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
                <span className="ml-3 text-xs text-slate-400">raktak · Tableau de bord</span>
              </div>
              <div className="p-5">
                <div className="text-sm font-semibold text-white">Boulangerie La Teranga</div>
                <div className="mt-4 grid grid-cols-3 gap-3">
                  {[
                    { l: "DSCR moyen", v: "1,42", s: "≥ 1,20 attendu", ok: true },
                    { l: "Seuil de rentabilité", v: "18,4 M", s: "FCFA / an" },
                    { l: "CAF année 1", v: "6,1 M", s: "FCFA" },
                  ].map((k) => (
                    <div key={k.l} className="rounded-lg bg-white/5 p-3">
                      <div className="text-[10px] uppercase tracking-wide text-slate-400">{k.l}</div>
                      <div className={`mt-1 text-lg font-bold ${k.ok ? "text-emerald-400" : "text-white"}`}>
                        {k.v}
                      </div>
                      <div className="text-[10px] text-slate-500">{k.s}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-5 text-[11px] text-slate-400">Chiffre d'affaires prévisionnel — 5 ans</div>
                <div className="mt-2 flex h-28 items-end gap-2">
                  {[38, 54, 68, 82, 100].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t bg-brand-400/80"
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ Modules ============ */}
      <section id="modules" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
        <div className="max-w-2xl">
          <span className="text-sm font-semibold text-brand-600">Un ERP modulaire</span>
          <h2 className="mt-2 text-3xl font-bold text-slate-900">Tous vos métiers, une seule application.</h2>
          <p className="mt-3 text-slate-600">
            Chaque module partage le même tableau de bord, le même portefeuille d'entreprises et le même
            moteur de calcul.
          </p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((m) => (
            <div
              key={m.titre}
              className="rounded-xl border border-slate-200 bg-white p-5 transition-shadow hover:shadow-md"
            >
              <div className="text-base font-semibold text-slate-900">{m.titre}</div>
              <div className="mt-1 text-sm text-slate-600">{m.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ============ Comment ca marche ============ */}
      <section id="etapes" className="bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
          <div className="max-w-2xl">
            <span className="text-sm font-semibold text-brand-600">Comment ça marche</span>
            <h2 className="mt-2 text-3xl font-bold text-slate-900">De la saisie au pilotage, en trois temps.</h2>
          </div>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {ETAPES.map((e) => (
              <li key={e.n} className="rounded-xl border border-slate-200 bg-white p-6">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
                  {e.n}
                </span>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">{e.titre}</h3>
                <p className="mt-2 text-sm text-slate-600">{e.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ============ Pourquoi raktak ============ */}
      <section id="atouts" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
        <div className="max-w-2xl">
          <span className="text-sm font-semibold text-brand-600">Pensé pour convaincre</span>
          <h2 className="mt-2 text-3xl font-bold text-slate-900">Des chiffres solides, pas des approximations.</h2>
        </div>
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {ATOUTS.map((a) => (
            <div key={a.titre} className="flex gap-4 rounded-xl border border-slate-200 bg-white p-6">
              <div className="text-2xl">{a.ico}</div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{a.titre}</h3>
                <p className="mt-1 text-sm text-slate-600">{a.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ============ CTA final ============ */}
      <section className="bg-[var(--color-sidebar)]">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6">
          <h2 className="text-3xl font-bold text-white">Prêt à piloter votre entreprise ?</h2>
          <p className="mt-3 text-slate-300">
            Ouvrez raktak et commencez à gérer vos ventes, vos stocks et vos comptes dès aujourd'hui.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/"
              className="rounded-lg bg-brand-500 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-brand-400"
            >
              Ouvrir l'application
            </Link>
          </div>
        </div>
      </section>

      {/* ============ Pied de page ============ */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-500 text-sm font-bold text-white">
              r
            </span>
            <span className="font-semibold text-slate-700">raktak</span>
          </div>
          <p>© 2026 raktak · SYSCOHADA révisé · FCFA (XOF)</p>
        </div>
      </footer>
    </div>
  );
}
