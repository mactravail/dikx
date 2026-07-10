"use client";

/**
 * PORTEFEUILLE DU COMPTABLE — vue d'ensemble agregee de TOUTES les entreprises
 * du cabinet (les chiffres que chaque entreprise saisit, consolides).
 *
 * Regle raktak : aucun calcul ici. Le composant appelle `chargerPortefeuilleAction`
 * (serveur : moteur tresorerie + somme des snapshots) et AFFICHE le resultat.
 * Un clic sur une ligne bascule l'entreprise active (pont vers le detail par
 * entreprise du tableau de bord ci-dessous).
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  chargerPortefeuilleAction,
  type Portefeuille,
} from "../../app/(app)/portefeuille/data-actions";
import { useEntreprise } from "../../lib/entreprise-context";
import { Card, StatTile, RegimeBadge } from "../ui";
import { Icon } from "../icons";
import { fcfa, fcfaCompact } from "../../lib/format";

export function PortefeuilleComptable() {
  const { entreprises, active, changerActive } = useEntreprise();
  const [pf, setPf] = useState<Portefeuille | null>(null);
  const [chargement, setChargement] = useState(true);

  // Recharge a l'ouverture et quand le portefeuille change (ajout/retrait).
  const signature = entreprises.map((e) => e.id).join(",");
  useEffect(() => {
    let vivant = true;
    setChargement(true);
    (async () => {
      try {
        const r = await chargerPortefeuilleAction();
        if (vivant) setPf(r);
      } finally {
        if (vivant) setChargement(false);
      }
    })();
    return () => {
      vivant = false;
    };
  }, [signature]);

  const totaux = pf?.totaux;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Portefeuille — vue d&apos;ensemble
          {pf ? <span className="ml-2 text-slate-400">({pf.nombreEntreprises})</span> : null}
        </h2>
        <Link href="/entreprises" className="text-xs font-medium text-brand-600 hover:text-brand-700">
          Gerer le portefeuille →
        </Link>
      </div>

      {/* Totaux consolides (tous dossiers) — snapshots renvoyes par le serveur */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Tresorerie consolidee" value={fcfa(totaux?.tresorerie ?? 0)} hint="Tous dossiers" icon="tresorerie" />
        <StatTile label="CA facture" value={fcfa(totaux?.caFacture ?? 0)} hint="Factures emises" icon="invoice" />
        <StatTile label="Charges" value={fcfa(totaux?.charges ?? 0)} hint="Depenses TTC" icon="charges" />
        <StatTile label="Effectif total" value={totaux?.effectif ?? 0} hint="Employes actifs" icon="rh" />
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
          <h3 className="text-sm font-semibold text-slate-700">Detail par entreprise</h3>
          <span className="text-xs text-slate-400">Cliquez une ligne pour la rendre active</span>
        </div>

        {chargement && !pf ? (
          <div className="px-4 py-10 text-center text-sm text-slate-400">Chargement du portefeuille…</div>
        ) : !pf || pf.lignes.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-slate-400">
            Aucune entreprise. Creez un dossier client depuis le portefeuille.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2 font-medium">Entreprise</th>
                  <th className="px-4 py-2 text-right font-medium">Tresorerie</th>
                  <th className="px-4 py-2 text-right font-medium">Effectif</th>
                  <th className="px-4 py-2 text-right font-medium">Masse sal.</th>
                  <th className="px-4 py-2 text-right font-medium">Charges</th>
                  <th className="px-4 py-2 text-right font-medium">Stock</th>
                  <th className="px-4 py-2 text-right font-medium">CA facture</th>
                </tr>
              </thead>
              <tbody>
                {pf.lignes.map((l) => {
                  const estActive = active?.id === l.entrepriseId;
                  return (
                    <tr
                      key={l.entrepriseId}
                      onClick={() => changerActive(l.entrepriseId)}
                      className={`cursor-pointer border-b border-slate-50 last:border-0 hover:bg-slate-50/60 ${
                        estActive ? "bg-brand-50/50" : ""
                      }`}
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-slate-800">{l.raisonSociale}</span>
                          {estActive && (
                            <span className="rounded-full bg-brand-100 px-1.5 py-0.5 text-[10px] font-medium text-brand-700">
                              Active
                            </span>
                          )}
                          <RegimeBadge regimeComptable={l.regimeComptable} regimeFiscal={l.regimeFiscal} />
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-slate-900">{fcfaCompact(l.tresorerie)}</td>
                      <td className="px-4 py-2.5 text-right text-slate-600">{l.effectif}</td>
                      <td className="px-4 py-2.5 text-right text-slate-600">{fcfaCompact(l.masseSalariale)}</td>
                      <td className="px-4 py-2.5 text-right text-rose-600">{fcfaCompact(l.charges)}</td>
                      <td className="px-4 py-2.5 text-right text-slate-600">{fcfaCompact(l.valeurStock)}</td>
                      <td className="px-4 py-2.5 text-right text-emerald-600">{fcfaCompact(l.caFacture)}</td>
                    </tr>
                  );
                })}
              </tbody>
              {totaux && (
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-50 text-sm font-semibold text-slate-800">
                    <td className="px-4 py-2.5">Total portefeuille</td>
                    <td className="px-4 py-2.5 text-right">{fcfaCompact(totaux.tresorerie)}</td>
                    <td className="px-4 py-2.5 text-right">{totaux.effectif}</td>
                    <td className="px-4 py-2.5 text-right">{fcfaCompact(totaux.masseSalariale)}</td>
                    <td className="px-4 py-2.5 text-right text-rose-600">{fcfaCompact(totaux.charges)}</td>
                    <td className="px-4 py-2.5 text-right">{fcfaCompact(totaux.valeurStock)}</td>
                    <td className="px-4 py-2.5 text-right text-emerald-600">{fcfaCompact(totaux.caFacture)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
        <p className="border-t border-slate-100 px-4 py-2 text-[11px] leading-relaxed text-slate-500">
          <Icon name="comptabilite" className="mr-1 inline h-3.5 w-3.5 align-text-bottom" />
          Chiffres saisis par chaque entreprise, consolides par les moteurs (serveur), en FCFA entiers.
        </p>
      </Card>
    </section>
  );
}
