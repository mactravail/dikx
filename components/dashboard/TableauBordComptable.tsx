"use client";

/**
 * TABLEAU DE BORD DU COMPTABLE — indicateurs de performance (KPI) + rapport de
 * tresorerie, sur l'entreprise active.
 *
 * Regle raktak : aucun chiffre n'est calcule ici. Le composant CHARGE les
 * saisies locales (ecritures, mouvements de tresorerie), les envoie aux server
 * actions qui appellent les MOTEURS testes, et AFFICHE le snapshot renvoye :
 *  - compte de resultat (produits, charges, resultat, marge) -> moteur compta ;
 *  - creances / dettes -> lues dans la balance (snapshot moteur) ;
 *  - disponible et repartition de tresorerie -> moteur tresorerie.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { calculerComptabiliteAction } from "../../app/(app)/comptabilite/actions";
import { calculerTresorerieAction } from "../../app/(app)/tresorerie/actions";
import type { EtatsFinanciers, ResultatComptabilite, ResultatTresorerie } from "../../lib/engine";
import { store as financeStore } from "../../lib/finance-data";
import {
  store as tresoStore,
  libelleTypeCompte,
} from "../../lib/tresorerie-data";
import { Card, StatTile } from "../ui";
import { Icon } from "../icons";
import { fcfa, pct } from "../../lib/format";

interface Donnees {
  compta: ResultatComptabilite;
  etats: EtatsFinanciers;
  treso: ResultatTresorerie;
}

/** Solde d'un compte de la balance (lecture d'un snapshot, pas un calcul). */
function soldeDebiteur(compta: ResultatComptabilite, numero: string): number {
  return compta.balance.find((b) => b.compte === numero)?.soldeDebiteur ?? 0;
}
function soldeCrediteur(compta: ResultatComptabilite, numero: string): number {
  return compta.balance.find((b) => b.compte === numero)?.soldeCrediteur ?? 0;
}

export function TableauBordComptable() {
  const [data, setData] = useState<Donnees | null>(null);

  useEffect(() => {
    let vivant = true;
    (async () => {
      // Ecritures comptables -> compte de resultat + bilan + balance.
      const ecritures = financeStore.chargerEcritures().map((e) => ({
        date: e.date,
        journal: e.journal,
        libelle: e.libelle,
        lignes: e.lignes.map((l) => ({
          compte: l.compte,
          libelle: l.libelle,
          debit: l.debit,
          credit: l.credit,
        })),
      }));
      // Tresorerie -> disponible + repartition.
      const comptes = tresoStore.chargerComptes().map((c) => ({
        id: c.id,
        nom: c.nom,
        type: c.type,
        operateur: c.operateur,
        soldeInitial: c.soldeInitial,
      }));
      const mouvements = tresoStore.chargerMouvements().map((m) => ({
        compteId: m.compteId,
        sens: m.sens,
        montant: m.montant,
        categorie: m.categorie,
      }));

      const [rc, rt] = await Promise.all([
        calculerComptabiliteAction(ecritures),
        calculerTresorerieAction(comptes, mouvements),
      ]);
      if (!vivant || !rc.ok || !rt.ok) return;
      setData({ compta: rc.resultat, etats: rc.etats, treso: rt.resultat });
    })();
    return () => {
      vivant = false;
    };
  }, []);

  const cr = data?.etats.compteResultat;
  const treso = data?.treso;
  const creancesClients = data ? soldeDebiteur(data.compta, "411") : 0;
  const dettesFournisseurs = data ? soldeCrediteur(data.compta, "401") : 0;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Indicateurs de performance
        </h2>
        <Link href="/comptabilite" className="text-xs font-medium text-brand-600 hover:text-brand-700">
          Voir la comptabilite →
        </Link>
      </div>

      {/* KPI — issus des moteurs (compta + tresorerie) */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Chiffre d'affaires & produits" value={fcfa(cr?.totalProduits ?? 0)} hint="Classe 7" icon="chart" />
        <StatTile label="Charges" value={fcfa(cr?.totalCharges ?? 0)} hint="Classe 6" icon="charges" />
        <StatTile
          label={cr && !cr.beneficiaire ? "Resultat net (perte)" : "Resultat net"}
          value={fcfa(cr?.resultatNet ?? 0)}
          hint={cr ? `Marge nette ${pct(cr.margeNette, 1)}` : "Produits − charges"}
          icon="comptabilite"
        />
        <StatTile label="Tresorerie disponible" value={fcfa(treso?.totalDisponible ?? 0)} hint="Tous comptes" icon="tresorerie" />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Creances clients" value={fcfa(creancesClients)} hint="A encaisser (411)" icon="clients" />
        <StatTile label="Dettes fournisseurs" value={fcfa(dettesFournisseurs)} hint="A payer (401)" icon="fournisseurs" />
        <StatTile label="Encaissements" value={fcfa(treso?.totalEntrees ?? 0)} hint="Entrees tresorerie" icon="invoice" />
        <StatTile
          label="Flux net tresorerie"
          value={fcfa(treso?.fluxNet ?? 0)}
          hint={(treso?.fluxNet ?? 0) >= 0 ? "En hausse" : "En baisse"}
          icon="production"
        />
      </div>

      {/* Rapport de tresorerie */}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
            <h3 className="text-sm font-semibold text-slate-700">Rapport de tresorerie</h3>
            <Link href="/tresorerie" className="text-xs font-medium text-brand-600 hover:text-brand-700">
              Ouvrir →
            </Link>
          </div>
          {!treso || treso.comptes.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-slate-400">
              Aucun compte de tresorerie. Ajoutez vos banques, caisses et comptes mobile money.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2 font-medium">Compte</th>
                  <th className="px-4 py-2 text-right font-medium">Entrees</th>
                  <th className="px-4 py-2 text-right font-medium">Sorties</th>
                  <th className="px-4 py-2 text-right font-medium">Solde</th>
                </tr>
              </thead>
              <tbody>
                {treso.comptes.map((c) => (
                  <tr key={c.compteId} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-slate-800">{c.nom}</div>
                      <div className="text-xs text-slate-400">
                        {libelleTypeCompte(c.type)}
                        {c.operateur ? ` · ${c.operateur}` : ""}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right text-emerald-600">{fcfa(c.totalEntrees)}</td>
                    <td className="px-4 py-2.5 text-right text-rose-600">{fcfa(c.totalSorties)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-slate-900">{fcfa(c.soldeCourant)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50 text-sm font-semibold text-slate-800">
                  <td className="px-4 py-2.5">Disponible total</td>
                  <td className="px-4 py-2.5 text-right text-emerald-600">{fcfa(treso.totalEntrees)}</td>
                  <td className="px-4 py-2.5 text-right text-rose-600">{fcfa(treso.totalSorties)}</td>
                  <td className="px-4 py-2.5 text-right">{fcfa(treso.totalDisponible)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </Card>

        {/* Ou est l'argent (par nature de compte) */}
        <Card className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-700">Ou est l'argent</h3>
          {!treso || treso.parType.length === 0 ? (
            <p className="text-sm text-slate-400">Aucune donnee.</p>
          ) : (
            <div className="space-y-3">
              {treso.parType.map((t) => (
                <div key={t.type}>
                  <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                    <span className="truncate text-slate-600">{libelleTypeCompte(t.type)}</span>
                    <span className="shrink-0 font-medium text-slate-500">{pct(t.part)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-brand-500"
                      style={{ width: `${Math.round(Math.max(0, Math.min(1, t.part)) * 100)}%` }}
                    />
                  </div>
                  <div className="mt-0.5 text-right text-[11px] text-slate-400">{fcfa(t.soldeCourant)}</div>
                </div>
              ))}
            </div>
          )}
          <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-500">
            <Icon name="comptabilite" className="mr-1 inline h-3.5 w-3.5 align-text-bottom" />
            Chiffres produits par les moteurs (serveur), en FCFA entiers.
          </p>
        </Card>
      </div>
    </section>
  );
}
