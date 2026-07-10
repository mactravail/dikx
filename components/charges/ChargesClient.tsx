"use client";

/**
 * Ecran CHARGES & DEPENSES — saisie des depenses de l'entreprise.
 *
 * L'UI COLLECTE les depenses et affiche des totaux, mais ne les calcule jamais :
 * a chaque changement la liste est envoyee a la server action qui appelle le
 * MOTEUR teste (`calculerDepenses`). Le TTC de chaque ligne, la TVA deductible,
 * la repartition par categorie et le cout annuel affiches sont le SNAPSHOT du
 * moteur, cote serveur.
 */
import { useEffect, useRef, useState } from "react";
import { calculerDepensesAction } from "../../app/(app)/charges/actions";
import type {
  CategorieDepense,
  DepenseInput,
  Recurrence,
  ResultatDepenses,
} from "../../lib/engine";
import {
  store,
  CATEGORIES_DEPENSE,
  RECURRENCES,
  libelleCategorie,
  type DepenseLocal,
} from "../../lib/finance-data";
import { useEntreprise } from "../../lib/entreprise-context";
import { useSession } from "../../lib/session-context";
import { estEnvoye } from "../../lib/transmission";
import { rappelerAction } from "../../app/(app)/transmission/data-actions";
import { BadgeTransmission } from "../BadgeTransmission";
import { Card, PageHeading, StatTile } from "../ui";
import { Icon } from "../icons";
import { Field, Text, Num, Modal, BtnPrimary, BtnGhost, inputCls } from "../ventes/form";
import { fcfa, pct, dateCourte } from "../../lib/format";

const RECURRENCE_LABEL: Record<Recurrence, string> = Object.fromEntries(
  RECURRENCES,
) as Record<Recurrence, string>;

function toInput(d: DepenseLocal): DepenseInput {
  return {
    categorie: d.categorie,
    montantHT: d.montantHT,
    tauxTVA: d.tauxTVA,
    recurrence: d.recurrence,
  };
}

function depenseVide(): DepenseLocal {
  return {
    id: "",
    date: new Date().toISOString().slice(0, 10),
    libelle: "",
    categorie: "loyer",
    montantHT: 0,
    tauxTVA: 0,
    recurrence: "mensuelle",
    fournisseur: "",
    montantTTC: 0,
  };
}

export function ChargesClient() {
  const { active } = useEntreprise();
  const { role } = useSession();
  const estEntreprise = role === "entreprise";
  const entrepriseId = active?.id ?? "";
  const [depenses, setDepenses] = useState<DepenseLocal[]>([]);
  const [pret, setPret] = useState(false);
  const [resultat, setResultat] = useState<ResultatDepenses | null>(null);
  const [edition, setEdition] = useState<DepenseLocal | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Chargement des depenses de l'entreprise active (Supabase, RLS).
  useEffect(() => {
    let vivant = true;
    setPret(false);
    (async () => {
      const liste = entrepriseId ? await store.chargerDepenses(entrepriseId) : [];
      if (!vivant) return;
      setDepenses(liste);
      setPret(true);
    })();
    return () => {
      vivant = false;
    };
  }, [entrepriseId]);

  // Agregation d'affichage par le moteur (server action), debounce leger.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const r = await calculerDepensesAction(depenses.map(toInput));
      if (r.ok) setResultat(r.resultat);
    }, 200);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [depenses]);

  async function enregistrer(d: DepenseLocal) {
    if (!d.libelle.trim() || !entrepriseId) return;
    try {
      // Le snapshot (TTC, TVA) est calcule par le moteur cote serveur (data-action).
      const saved = await store.enregistrerDepense(entrepriseId, d);
      setDepenses((prev) => (d.id ? prev.map((x) => (x.id === d.id ? saved : x)) : [saved, ...prev]));
      setEdition(null);
    } catch (e) {
      setErreur((e as Error).message);
    }
  }

  async function supprimer(id: string) {
    try {
      await store.supprimerDepense(id);
      setDepenses((prev) => prev.filter((d) => d.id !== id));
    } catch (e) {
      setErreur((e as Error).message);
    }
  }

  // Rappel : une depense deja envoyee repasse en brouillon pour correction.
  async function rappeler(id: string) {
    try {
      await rappelerAction("depenses", id);
      setDepenses((prev) => prev.map((d) => (d.id === id ? { ...d, transmission: "brouillon" } : d)));
    } catch (e) {
      setErreur((e as Error).message);
    }
  }

  if (!entrepriseId) {
    return (
      <div className="mx-auto max-w-5xl">
        <PageHeading titre="Charges & Depenses" sousTitre="Saisie des depenses de l'entreprise." />
        <Card className="px-4 py-12 text-center text-sm text-slate-500">
          Selectionnez d&apos;abord une entreprise pour saisir ses charges.
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeading
        titre="Charges & Depenses"
        sousTitre="Saisie des depenses. TVA deductible, repartition et cout annuel calcules par le moteur."
        action={
          <BtnPrimary onClick={() => setEdition(depenseVide())}>
            <Icon name="plus" className="h-4 w-4" /> Nouvelle depense
          </BtnPrimary>
        }
      />

      {erreur && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</div>
      )}
      {!pret && <div className="mb-4 text-sm text-slate-400">Chargement des donnees…</div>}

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Depenses (TTC)" value={fcfa(resultat?.totalTTC ?? 0)} icon="charges" />
        <StatTile label="TVA deductible" value={fcfa(resultat?.totalTVA ?? 0)} hint="Recuperable" icon="invoice" />
        <StatTile label="Cout annuel recurrent" value={fcfa(resultat?.totalAnnualiseTTC ?? 0)} hint="Charges recurrentes projetees" icon="chart" />
        <StatTile label="Depenses saisies" value={depenses.length} icon="comptabilite" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        {/* Liste des depenses */}
        <Card className="overflow-hidden">
          {depenses.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-slate-400">
              Aucune depense. Ajoutez votre premiere charge.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-2 font-medium">Depense</th>
                    <th className="px-4 py-2 font-medium">Categorie</th>
                    <th className="px-4 py-2 font-medium">Recurrence</th>
                    <th className="px-4 py-2 text-right font-medium">TTC</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {depenses.map((d) => (
                    <tr key={d.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-slate-800">{d.libelle}</div>
                        <div className="text-xs text-slate-400">
                          {dateCourte(d.date)}
                          {d.fournisseur ? ` · ${d.fournisseur}` : ""}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                          {libelleCategorie(d.categorie)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">{RECURRENCE_LABEL[d.recurrence]}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-slate-800">{fcfa(d.montantTTC)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {estEntreprise && <BadgeTransmission etat={d.transmission} />}
                          {estEntreprise && estEnvoye(d.transmission) ? (
                            <button
                              type="button"
                              onClick={() => rappeler(d.id)}
                              className="rounded-lg px-2 py-1 text-xs font-medium text-amber-600 hover:bg-amber-50"
                              title="Repasser en brouillon pour corriger"
                            >
                              Rappeler
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => setEdition(d)}
                                className="rounded-lg px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50"
                              >
                                Ouvrir
                              </button>
                              <button
                                type="button"
                                onClick={() => supprimer(d.id)}
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600"
                                aria-label="Supprimer"
                              >
                                <Icon name="close" className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Repartition par categorie (snapshot moteur) */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <Card className="p-5">
            <h3 className="mb-4 text-sm font-semibold text-slate-700">Repartition par poste</h3>
            {!resultat || resultat.repartition.length === 0 ? (
              <p className="text-sm text-slate-400">Aucune donnee.</p>
            ) : (
              <div className="space-y-3">
                {resultat.repartition.map((r) => (
                  <div key={r.categorie}>
                    <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                      <span className="truncate text-slate-600">{libelleCategorie(r.categorie)}</span>
                      <span className="shrink-0 font-medium text-slate-500">{pct(r.part)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-brand-500"
                        style={{ width: `${Math.round(r.part * 100)}%` }}
                      />
                    </div>
                    <div className="mt-0.5 text-right text-[11px] text-slate-400">{fcfa(r.totalTTC)}</div>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-500">
              Montants produits par le moteur de calcul (serveur), en FCFA entiers.
            </p>
          </Card>
        </div>
      </div>

      {edition && (
        <DepenseForm
          initial={edition}
          onClose={() => setEdition(null)}
          onSave={enregistrer}
        />
      )}
    </div>
  );
}

function DepenseForm({
  initial,
  onClose,
  onSave,
}: {
  initial: DepenseLocal;
  onClose: () => void;
  onSave: (d: DepenseLocal) => void;
}) {
  const [d, setD] = useState<DepenseLocal>(initial);
  const up = <K extends keyof DepenseLocal>(k: K, v: DepenseLocal[K]) =>
    setD((prev) => ({ ...prev, [k]: v }));

  return (
    <Modal
      titre={initial.id ? "Modifier la depense" : "Nouvelle depense"}
      onClose={onClose}
      footer={
        <>
          <BtnGhost onClick={onClose}>Annuler</BtnGhost>
          <BtnPrimary onClick={() => onSave(d)} disabled={!d.libelle.trim()}>
            Enregistrer
          </BtnPrimary>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Libelle *" className="sm:col-span-2">
          <Text value={d.libelle} onChange={(v) => up("libelle", v)} placeholder="Ex. Facture SENELEC janvier" />
        </Field>
        <Field label="Categorie">
          <select
            className={inputCls}
            value={d.categorie}
            onChange={(e) => up("categorie", e.target.value as CategorieDepense)}
          >
            {CATEGORIES_DEPENSE.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </Field>
        <Field label="Recurrence">
          <select
            className={inputCls}
            value={d.recurrence}
            onChange={(e) => up("recurrence", e.target.value as Recurrence)}
          >
            {RECURRENCES.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </Field>
        <Field label="Date">
          <input
            type="date"
            className={inputCls}
            value={d.date}
            onChange={(e) => up("date", e.target.value)}
          />
        </Field>
        <Field label="Fournisseur">
          <Text value={d.fournisseur ?? ""} onChange={(v) => up("fournisseur", v)} placeholder="Optionnel" />
        </Field>
        <Field label="Montant HT">
          <Num value={d.montantHT} suffix="FCFA" onChange={(n) => up("montantHT", n)} />
        </Field>
        <Field label="TVA deductible">
          <select
            className={inputCls}
            value={d.tauxTVA}
            onChange={(e) => up("tauxTVA", Number(e.target.value))}
          >
            <option value={0}>0 % (non deductible)</option>
            <option value={0.1}>10 %</option>
            <option value={0.18}>18 %</option>
          </select>
        </Field>
      </div>
      <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-500">
        Le TTC et la TVA deductible seront calcules par le moteur a l'enregistrement.
      </p>
    </Modal>
  );
}
