"use client";

/**
 * Ecran FACTURATION — devis / factures / avoirs.
 *
 * L'UI COLLECTE les lignes et affiche les totaux, mais ne les calcule jamais :
 * a chaque modification, le document est envoye a la server action qui appelle
 * le MOTEUR teste (`calculerDocument`). Le total affiche et le total sauvegarde
 * sont donc toujours le SNAPSHOT du moteur.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { calculerDocumentAction } from "../../app/(app)/facturation/actions";
import type { DocumentCalc, DocumentInput } from "../../lib/engine";
import {
  store,
  prochainNumero,
  type ClientLocal,
  type DocumentLocal,
  type LigneLocal,
  type StatutDocument,
} from "../../lib/ventes-data";
import { useEntreprise } from "../../lib/entreprise-context";
import { useSession } from "../../lib/session-context";
import { estEnvoye } from "../../lib/transmission";
import { rappelerAction } from "../../app/(app)/transmission/data-actions";
import { BadgeTransmission } from "../BadgeTransmission";
import { Card, PageHeading, StatTile } from "../ui";
import { Icon } from "../icons";
import { Field, Text, Num, inputCls, BtnPrimary, BtnGhost } from "../ventes/form";
import { fcfa, pct, dateCourte } from "../../lib/format";

const TYPES: ReadonlyArray<[DocumentLocal["type"], string]> = [
  ["devis", "Devis"],
  ["facture", "Facture"],
  ["avoir", "Avoir"],
];

const STATUTS: ReadonlyArray<[StatutDocument, string]> = [
  ["brouillon", "Brouillon"],
  ["emis", "Emis"],
  ["partiellement_paye", "Partiellement paye"],
  ["paye", "Paye"],
  ["annule", "Annule"],
];

const STATUT_STYLE: Record<StatutDocument, string> = {
  brouillon: "bg-slate-100 text-slate-600",
  emis: "bg-blue-50 text-blue-700",
  partiellement_paye: "bg-amber-50 text-amber-700",
  paye: "bg-emerald-50 text-emerald-700",
  annule: "bg-red-50 text-red-600",
};

function ligneVide(): LigneLocal {
  return { designation: "", quantite: 1, prixUnitaireHT: 0, tauxTVA: 0.18, remisePct: 0 };
}

function docVide(existants: DocumentLocal[]): DocumentLocal {
  return {
    id: "",
    type: "facture",
    numero: prochainNumero("facture", existants),
    clientId: null,
    clientNom: "",
    dateEmission: new Date().toISOString().slice(0, 10),
    statut: "brouillon",
    assujettiTVA: true,
    remiseGlobalePct: 0,
    lignes: [ligneVide()],
    montantPaye: 0,
    totalHT: 0,
    totalTVA: 0,
    totalTTC: 0,
  };
}

function versInput(d: DocumentLocal): DocumentInput {
  return {
    type: d.type,
    assujettiTVA: d.assujettiTVA,
    remiseGlobalePct: d.remiseGlobalePct,
    montantPaye: d.montantPaye,
    lignes: d.lignes.map((l) => ({
      designation: l.designation,
      quantite: l.quantite,
      prixUnitaireHT: l.prixUnitaireHT,
      tauxTVA: l.tauxTVA,
      remisePct: l.remisePct,
    })),
  };
}

export function FacturationClient() {
  const { active } = useEntreprise();
  const { role } = useSession();
  const estEntreprise = role === "entreprise";
  const entrepriseId = active?.id ?? "";
  const [documents, setDocuments] = useState<DocumentLocal[]>([]);
  const [clients, setClients] = useState<ClientLocal[]>([]);
  const [pret, setPret] = useState(false);
  const [draft, setDraft] = useState<DocumentLocal | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  // Documents + clients de l'entreprise active (Supabase, RLS).
  useEffect(() => {
    let vivant = true;
    setPret(false);
    (async () => {
      if (!entrepriseId) {
        if (vivant) {
          setDocuments([]);
          setClients([]);
          setPret(true);
        }
        return;
      }
      const [docs, clis] = await Promise.all([
        store.chargerDocuments(entrepriseId),
        store.chargerClients(entrepriseId),
      ]);
      if (!vivant) return;
      setDocuments(docs);
      setClients(clis);
      setPret(true);
    })();
    return () => {
      vivant = false;
    };
  }, [entrepriseId]);

  function nouveau() {
    setDraft(docVide(documents));
  }

  async function enregistrer(d: DocumentLocal) {
    if (!entrepriseId) return;
    try {
      // Totaux = snapshot du moteur, calcule cote serveur (data-action).
      const saved = await store.enregistrerDocument(entrepriseId, d);
      setDocuments((prev) => (d.id ? prev.map((x) => (x.id === d.id ? saved : x)) : [saved, ...prev]));
      setDraft(null);
    } catch (e) {
      setErreur((e as Error).message);
    }
  }

  async function supprimer(id: string) {
    try {
      await store.supprimerDocument(id);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    } catch (e) {
      setErreur((e as Error).message);
    }
  }

  // Rappel : un document deja envoye repasse en brouillon pour correction.
  async function rappeler(id: string) {
    try {
      await rappelerAction("documents", id);
      setDocuments((prev) => prev.map((d) => (d.id === id ? { ...d, transmission: "brouillon" } : d)));
    } catch (e) {
      setErreur((e as Error).message);
    }
  }

  if (!entrepriseId) {
    return (
      <div className="mx-auto max-w-5xl">
        <PageHeading titre="Facturation" sousTitre="Devis, factures et avoirs." />
        <Card className="px-4 py-12 text-center text-sm text-slate-500">
          Selectionnez d&apos;abord une entreprise pour saisir sa facturation.
        </Card>
      </div>
    );
  }

  if (draft) {
    return (
      <Editeur
        initial={draft}
        clients={clients}
        onCancel={() => setDraft(null)}
        onSave={enregistrer}
      />
    );
  }

  const caEmis = documents
    .filter((d) => d.type === "facture" && d.statut !== "annule")
    .reduce((s, d) => s + d.totalTTC, 0);
  const impayes = documents
    .filter((d) => d.type === "facture" && (d.statut === "emis" || d.statut === "partiellement_paye"))
    .reduce((s, d) => s + (d.totalTTC - d.montantPaye), 0);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeading
        titre="Facturation"
        sousTitre="Devis, factures et avoirs. Totaux, TVA 18 % et net a payer calcules par le moteur."
        action={
          <BtnPrimary onClick={nouveau}>
            <Icon name="plus" className="h-4 w-4" /> Nouveau document
          </BtnPrimary>
        }
      />

      {erreur && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</div>
      )}
      {!pret && <div className="mb-4 text-sm text-slate-400">Chargement des donnees…</div>}

      <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatTile label="Documents" value={documents.length} icon="invoice" />
        <StatTile label="Factures emises (TTC)" value={fcfa(caEmis)} icon="chart" />
        <StatTile label="Reste a encaisser" value={fcfa(impayes)} hint="Factures ouvertes" icon="charges" />
      </div>

      <Card className="overflow-hidden">
        {documents.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-slate-400">
            Aucun document. Creez un devis ou une facture.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2 font-medium">Numero</th>
                  <th className="px-4 py-2 font-medium">Client</th>
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Statut</th>
                  <th className="px-4 py-2 text-right font-medium">Total TTC</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {documents.map((d) => (
                  <tr key={d.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-slate-800">{d.numero}</div>
                      <div className="text-xs capitalize text-slate-400">{d.type}</div>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{d.clientNom || "—"}</td>
                    <td className="px-4 py-2.5 text-slate-600">{dateCourte(d.dateEmission)}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUT_STYLE[d.statut]}`}>
                        {STATUTS.find(([v]) => v === d.statut)?.[1]}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium text-slate-800">{fcfa(d.totalTTC)}</td>
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
                              onClick={() => setDraft(d)}
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
    </div>
  );
}

/* ------------------------------ editeur ------------------------------ */

function Editeur({
  initial,
  clients,
  onCancel,
  onSave,
}: {
  initial: DocumentLocal;
  clients: ClientLocal[];
  onCancel: () => void;
  onSave: (d: DocumentLocal, calc: DocumentCalc | null) => void;
}) {
  const [d, setD] = useState<DocumentLocal>(initial);
  const [calc, setCalc] = useState<DocumentCalc | null>(null);
  const [calculEnCours, setCalculEnCours] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const up = <K extends keyof DocumentLocal>(k: K, v: DocumentLocal[K]) =>
    setD((prev) => ({ ...prev, [k]: v }));

  // Recalcul (server action) a chaque changement, debounce leger.
  useEffect(() => {
    setCalculEnCours(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const r = await calculerDocumentAction(versInput(d));
      if (r.ok) setCalc(r.calc);
      setCalculEnCours(false);
    }, 250);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.lignes, d.assujettiTVA, d.remiseGlobalePct, d.montantPaye]);

  const majLigne = (i: number, patch: Partial<LigneLocal>) => {
    const arr = [...d.lignes];
    const cur = arr[i];
    if (!cur) return;
    arr[i] = { ...cur, ...patch };
    up("lignes", arr);
  };

  const clientOptions = useMemo(() => clients.filter((c) => c.actif), [clients]);

  function choisirClient(id: string) {
    const c = clients.find((x) => x.id === id);
    setD((prev) => ({ ...prev, clientId: id || null, clientNom: c?.raisonSociale ?? prev.clientNom }));
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-300 bg-white p-2 text-slate-600 hover:bg-slate-50"
            aria-label="Retour"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-semibold text-slate-800">
              {initial.id ? "Modifier" : "Nouveau"} document — {d.numero}
            </h1>
            <p className="text-sm text-slate-500">Les totaux sont calcules par le moteur, jamais dans le navigateur.</p>
          </div>
        </div>
        <BtnPrimary onClick={() => onSave(d, calc)}>
          <Icon name="invoice" className="h-4 w-4" /> Enregistrer
        </BtnPrimary>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          {/* En-tete */}
          <Card className="p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Type de document">
                <select
                  className={inputCls}
                  value={d.type}
                  onChange={(e) => up("type", e.target.value as DocumentLocal["type"])}
                >
                  {TYPES.map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </Field>
              <Field label="Statut">
                <select
                  className={inputCls}
                  value={d.statut}
                  onChange={(e) => up("statut", e.target.value as StatutDocument)}
                >
                  {STATUTS.map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </Field>
              <Field label="Client">
                {clientOptions.length > 0 ? (
                  <select className={inputCls} value={d.clientId ?? ""} onChange={(e) => choisirClient(e.target.value)}>
                    <option value="">— Choisir un client —</option>
                    {clientOptions.map((c) => (
                      <option key={c.id} value={c.id}>{c.raisonSociale}</option>
                    ))}
                  </select>
                ) : (
                  <Text value={d.clientNom} onChange={(v) => up("clientNom", v)} placeholder="Nom du client" />
                )}
              </Field>
              <Field label="Date d'emission">
                <input
                  type="date"
                  className={inputCls}
                  value={d.dateEmission}
                  onChange={(e) => up("dateEmission", e.target.value)}
                />
              </Field>
            </div>
            <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={d.assujettiTVA} onChange={(e) => up("assujettiTVA", e.target.checked)} />
              Assujetti a la TVA (18 %)
            </label>
          </Card>

          {/* Lignes */}
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">Lignes</h3>
            </div>
            <div className="hidden gap-2 px-1 pb-1 text-xs font-medium text-slate-500 sm:grid sm:grid-cols-[1fr_70px_110px_70px_70px_auto]">
              <span>Designation</span>
              <span className="text-right">Qte</span>
              <span className="text-right">P.U. HT</span>
              <span className="text-right">TVA</span>
              <span className="text-right">Remise</span>
              <span />
            </div>
            <div className="space-y-2">
              {d.lignes.map((l, i) => (
                <div key={i} className="grid gap-2 sm:grid-cols-[1fr_70px_110px_70px_70px_auto]">
                  <Text value={l.designation} onChange={(v) => majLigne(i, { designation: v })} placeholder="Designation" />
                  <Num value={l.quantite} step={0.01} onChange={(n) => majLigne(i, { quantite: n })} />
                  <Num value={l.prixUnitaireHT} onChange={(n) => majLigne(i, { prixUnitaireHT: n })} />
                  <select
                    className={inputCls}
                    value={l.tauxTVA}
                    onChange={(e) => majLigne(i, { tauxTVA: Number(e.target.value) })}
                  >
                    <option value={0.18}>18 %</option>
                    <option value={0.1}>10 %</option>
                    <option value={0}>0 %</option>
                  </select>
                  <Num value={Math.round(l.remisePct * 100)} suffix="%" onChange={(n) => majLigne(i, { remisePct: n / 100 })} />
                  <button
                    type="button"
                    className="rounded-lg px-2 text-slate-400 hover:bg-slate-100 hover:text-red-600"
                    onClick={() => up("lignes", d.lignes.filter((_, j) => j !== i))}
                    aria-label="Supprimer la ligne"
                  >
                    <Icon name="close" className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700"
              onClick={() => up("lignes", [...d.lignes, ligneVide()])}
            >
              <Icon name="plus" className="h-4 w-4" /> Ajouter une ligne
            </button>

            <div className="mt-5 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
              <Field label="Remise globale">
                <Num value={Math.round(d.remiseGlobalePct * 100)} suffix="%" onChange={(n) => up("remiseGlobalePct", n / 100)} />
              </Field>
              <Field label="Deja paye (acomptes)">
                <Num value={d.montantPaye} suffix="FCFA" onChange={(n) => up("montantPaye", n)} />
              </Field>
            </div>
          </Card>
        </div>

        {/* Recapitulatif (snapshot moteur) */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <Recap calc={calc} enCours={calculEnCours} />
        </div>
      </div>
    </div>
  );
}

function Recap({ calc, enCours }: { calc: DocumentCalc | null; enCours: boolean }) {
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Recapitulatif</h3>
        {enCours && <span className="text-xs text-slate-400">Calcul…</span>}
      </div>

      <dl className="space-y-2 text-sm">
        <Ligne label="Total brut HT" value={fcfa(calc?.totalBrutHT ?? 0)} />
        {(calc?.remise ?? 0) > 0 && (
          <Ligne label="Remises" value={`− ${fcfa(calc?.remise ?? 0)}`} ton="baisse" />
        )}
        <Ligne label="Total HT" value={fcfa(calc?.totalHT ?? 0)} />
        {(calc?.ventilationTVA ?? []).map((v) => (
          <Ligne key={v.taux} label={`TVA ${pct(v.taux)}`} value={fcfa(v.montantTVA)} discret />
        ))}
        <Ligne label="Total TVA" value={fcfa(calc?.totalTVA ?? 0)} />
        <div className="my-2 border-t border-slate-100" />
        <Ligne label="Total TTC" value={fcfa(calc?.totalTTC ?? 0)} fort />
        {(calc?.montantPaye ?? 0) > 0 && (
          <>
            <Ligne label="Deja paye" value={`− ${fcfa(calc?.montantPaye ?? 0)}`} ton="baisse" />
            <Ligne
              label="Reste a payer"
              value={fcfa(calc?.resteAPayer ?? 0)}
              fort
              ton={(calc?.resteAPayer ?? 0) > 0 ? "alerte" : "ok"}
            />
          </>
        )}
      </dl>

      <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-500">
        Montants produits par le moteur de calcul (serveur), en FCFA entiers.
      </p>
    </Card>
  );
}

function Ligne({
  label,
  value,
  fort,
  discret,
  ton,
}: {
  label: string;
  value: string;
  fort?: boolean;
  discret?: boolean;
  ton?: "baisse" | "alerte" | "ok";
}) {
  const couleur =
    ton === "alerte" ? "text-red-600" : ton === "ok" ? "text-emerald-600" : ton === "baisse" ? "text-slate-500" : "text-slate-800";
  return (
    <div className="flex items-center justify-between">
      <dt className={`${discret ? "pl-3 text-xs text-slate-400" : "text-slate-500"}`}>{label}</dt>
      <dd className={`${fort ? "text-base font-semibold" : "text-sm font-medium"} ${couleur}`}>{value}</dd>
    </div>
  );
}
