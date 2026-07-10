import { findItem } from "../lib/nav";
import { Icon } from "./icons";
import { Card, PageHeading, StatutBadge, BoutonLien } from "./ui";

/**
 * Page de presentation d'un module encore en construction : titre, description,
 * feuille de route (fonctionnalites prevues) et rappel de la regle non
 * negociable (les montants viennent d'un moteur teste, jamais du navigateur).
 */
export function ModulePlaceholder({ href }: { href: string }) {
  const item = findItem(href);
  if (!item) {
    return <PageHeading titre="Module introuvable" sousTitre={href} />;
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeading
        titre={item.label}
        sousTitre={item.description}
        action={<StatutBadge statut={item.statut} />}
      />

      <Card className="p-6">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <Icon name={item.icon} className="h-6 w-6" />
          </span>
          <div>
            <div className="font-semibold text-slate-800">Module en preparation</div>
            <p className="text-sm text-slate-500">
              L'interface et le modele de donnees de ce module sont en cours de
              construction dans le nouveau socle raktak.
            </p>
          </div>
        </div>

        {item.fonctionnalites && item.fonctionnalites.length > 0 && (
          <div className="mt-6">
            <div className="mb-3 text-sm font-semibold text-slate-700">
              Fonctionnalites prevues
            </div>
            <ul className="grid gap-2 sm:grid-cols-2">
              {item.fonctionnalites.map((f) => (
                <li
                  key={f}
                  className="flex items-start gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-600"
                >
                  <span className="mt-0.5 text-brand-500">
                    <Icon name="projets" className="h-4 w-4" />
                  </span>
                  {f}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <strong>Regle raktak :</strong> tous les montants de ce module
          (facturation, valorisation de stock, ecritures, paie…) seront produits
          par un <strong>moteur de calcul deterministe et teste</strong>, cote
          serveur — jamais calcules dans le navigateur.
        </div>
      </Card>

      <div className="mt-6">
        <BoutonLien href="/" variante="ghost">
          ← Retour au tableau de bord
        </BoutonLien>
      </div>
    </div>
  );
}
