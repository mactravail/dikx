"use client";

/**
 * Ecran COMPTABILITE (SYSCOHADA) — journal en partie double + balance.
 *
 * L'UI COLLECTE les ecritures et affiche des cumuls, mais ne les calcule jamais :
 * a chaque changement les ecritures sont envoyees a la server action qui appelle
 * le MOTEUR teste (`calculerComptabilite`). Le controle d'equilibre de chaque
 * ecriture, la balance des comptes et les totaux affiches sont le SNAPSHOT du
 * moteur, cote serveur. Sommer des mouvements EST un calcul.
 */
import { useEffect, useRef, useState } from "react";
import { calculerComptabiliteAction } from "../../app/(app)/comptabilite/actions";
import type {
  EcritureInput,
  ResultatComptabilite,
  EtatsFinanciers,
  CompteResultat,
  Bilan,
  PosteEtat,
} from "../../lib/engine";
import {
  store,
  JOURNAUX,
  CLASSES_COMPTABLES,
  PLAN_COMPTABLE,
  libelleCompte,
  type EcritureLocal,
  type LigneEcritureLocal,
} from "../../lib/finance-data";
import { useEntreprise } from "../../lib/entreprise-context";
import { Card, PageHeading, StatTile } from "../ui";
import { Icon } from "../icons";
import { Field, Text, Num, BtnPrimary, inputCls } from "../ventes/form";
import { fcfa, dateCourte } from "../../lib/format";

const JOURNAL_LABEL: Record<string, string> = Object.fromEntries(JOURNAUX);

const COMPTES_PAR_CLASSE = CLASSES_COMPTABLES.map(([classe, titre]) => ({
  classe,
  titre,
  comptes: PLAN_COMPTABLE.filter((c) => c.classe === classe),
})).filter((g) => g.comptes.length > 0);

function toInput(e: EcritureLocal): EcritureInput {
  return {
    date: e.date,
    journal: e.journal,
    libelle: e.libelle,
    lignes: e.lignes.map((l) => ({
      compte: l.compte,
      libelle: l.libelle,
      debit: l.debit,
      credit: l.credit,
    })),
  };
}

type Onglet = "journal" | "balance" | "resultat" | "bilan";

const ONGLETS: ReadonlyArray<[Onglet, string]> = [
  ["journal", "Journal"],
  ["balance", "Balance"],
  ["resultat", "Compte de resultat"],
  ["bilan", "Bilan (Actif / Passif)"],
];

function ligneVide(): LigneEcritureLocal {
  return { compte: "", libelle: "", debit: 0, credit: 0 };
}

function ecritureVide(): EcritureLocal {
  return {
    id: "",
    date: new Date().toISOString().slice(0, 10),
    journal: "OD",
    libelle: "",
    reference: "",
    lignes: [ligneVide(), ligneVide()],
  };
}

export function ComptabiliteClient() {
  const { active } = useEntreprise();
  const entrepriseId = active?.id ?? "";
  const [ecritures, setEcritures] = useState<EcritureLocal[]>([]);
  const [pret, setPret] = useState(false);
  const [resultat, setResultat] = useState<ResultatComptabilite | null>(null);
  const [etats, setEtats] = useState<EtatsFinanciers | null>(null);
  const [onglet, setOnglet] = useState<Onglet>("journal");
  const [edition, setEdition] = useState<EcritureLocal | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Chargement des ecritures de l'entreprise active (Supabase, RLS).
  useEffect(() => {
    let vivant = true;
    setPret(false);
    (async () => {
      const liste = entrepriseId ? await store.chargerEcritures(entrepriseId) : [];
      if (!vivant) return;
      setEcritures(liste);
      setPret(true);
    })();
    return () => {
      vivant = false;
    };
  }, [entrepriseId]);

  // Agregation (balance + controle) par le moteur, debounce leger.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const r = await calculerComptabiliteAction(ecritures.map(toInput));
      if (r.ok) {
        setResultat(r.resultat);
        setEtats(r.etats);
      }
    }, 200);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [ecritures]);

  async function enregistrer(e: EcritureLocal) {
    if (!entrepriseId) return;
    try {
      const saved = await store.enregistrerEcriture(entrepriseId, e);
      setEcritures((prev) => (e.id ? prev.map((x) => (x.id === e.id ? saved : x)) : [saved, ...prev]));
      setEdition(null);
    } catch (err) {
      setErreur((err as Error).message);
    }
  }

  async function supprimer(id: string) {
    try {
      await store.supprimerEcriture(id);
      setEcritures((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      setErreur((err as Error).message);
    }
  }

  if (edition) {
    return (
      <EcritureEditor
        initial={edition}
        onCancel={() => setEdition(null)}
        onSave={enregistrer}
      />
    );
  }

  const equilibre = resultat?.equilibre ?? true;

  if (!entrepriseId) {
    return (
      <div className="mx-auto max-w-5xl">
        <PageHeading titre="Comptabilite" sousTitre="Journal, grand livre et balance SYSCOHADA." />
        <Card className="px-4 py-12 text-center text-sm text-slate-500">
          Selectionnez d&apos;abord une entreprise pour tenir sa comptabilite.
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeading
        titre="Comptabilite"
        sousTitre="Journal, grand livre et balance SYSCOHADA. Cumuls et equilibre calcules par le moteur."
        action={
          <BtnPrimary onClick={() => setEdition(ecritureVide())}>
            <Icon name="plus" className="h-4 w-4" /> Nouvelle ecriture
          </BtnPrimary>
        }
      />

      {erreur && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</div>
      )}
      {!pret && <div className="mb-4 text-sm text-slate-400">Chargement des donnees…</div>}

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Ecritures" value={ecritures.length} icon="comptabilite" />
        <StatTile label="Total mouvements" value={fcfa(resultat?.totalDebit ?? 0)} hint="Debit = credit" icon="chart" />
        <StatTile label="Comptes mouvementes" value={resultat?.balance.length ?? 0} icon="invoice" />
        <StatTile
          label="Equilibre"
          value={equilibre ? "Equilibre" : "Desequilibre"}
          hint={
            equilibre
              ? "Partie double respectee"
              : `Ecart ${fcfa(Math.abs((resultat?.totalDebit ?? 0) - (resultat?.totalCredit ?? 0)))}`
          }
          icon="charges"
        />
      </div>

      {/* Onglets */}
      <div className="mb-4 inline-flex flex-wrap rounded-lg border border-slate-200 bg-white p-1 text-sm">
        {ONGLETS.map(([cle, libelle]) => (
          <button
            key={cle}
            type="button"
            onClick={() => setOnglet(cle)}
            className={`rounded-md px-3 py-1.5 font-medium ${onglet === cle ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
          >
            {libelle}
          </button>
        ))}
      </div>

      {onglet === "journal" && (
        <JournalTable
          ecritures={ecritures}
          resultat={resultat}
          onOpen={setEdition}
          onDelete={supprimer}
        />
      )}
      {onglet === "balance" && <BalanceTable resultat={resultat} />}
      {onglet === "resultat" && <CompteResultatView cr={etats?.compteResultat ?? null} />}
      {onglet === "bilan" && <BilanView bilan={etats?.bilan ?? null} />}
    </div>
  );
}

/* ------------------------------ journal ------------------------------ */

function JournalTable({
  ecritures,
  resultat,
  onOpen,
  onDelete,
}: {
  ecritures: EcritureLocal[];
  resultat: ResultatComptabilite | null;
  onOpen: (e: EcritureLocal) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Card className="overflow-hidden">
      {ecritures.length === 0 ? (
        <div className="px-4 py-12 text-center text-sm text-slate-400">
          Aucune ecriture. Enregistrez votre premiere operation.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Journal</th>
                <th className="px-4 py-2 font-medium">Libelle</th>
                <th className="px-4 py-2 text-right font-medium">Debit</th>
                <th className="px-4 py-2 text-right font-medium">Credit</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {ecritures.map((e, i) => {
                const calc = resultat?.ecritures[i];
                const desequilibree = calc ? !calc.equilibree : false;
                return (
                  <tr key={e.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                    <td className="px-4 py-2.5 whitespace-nowrap text-slate-600">{dateCourte(e.date)}</td>
                    <td className="px-4 py-2.5">
                      <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                        {JOURNAL_LABEL[e.journal] ?? e.journal}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-slate-800">{e.libelle || "—"}</div>
                      <div className="text-xs text-slate-400">
                        {e.reference ? `${e.reference} · ` : ""}
                        {e.lignes.length} ligne{e.lignes.length > 1 ? "s" : ""}
                        {desequilibree && (
                          <span className="ml-1 font-medium text-red-500">· desequilibree</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium text-slate-800">{fcfa(calc?.totalDebit ?? 0)}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-slate-800">{fcfa(calc?.totalCredit ?? 0)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => onOpen(e)}
                          className="rounded-lg px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50"
                        >
                          Ouvrir
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(e.id)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600"
                          aria-label="Supprimer"
                        >
                          <Icon name="close" className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/* ------------------------------ balance ------------------------------ */

function BalanceTable({ resultat }: { resultat: ResultatComptabilite | null }) {
  const balance = resultat?.balance ?? [];
  return (
    <Card className="overflow-hidden">
      {balance.length === 0 ? (
        <div className="px-4 py-12 text-center text-sm text-slate-400">
          Aucun compte mouvemente.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2 font-medium">Compte</th>
                <th className="px-4 py-2 font-medium">Libelle</th>
                <th className="px-4 py-2 text-right font-medium">Debit</th>
                <th className="px-4 py-2 text-right font-medium">Credit</th>
                <th className="px-4 py-2 text-right font-medium">Solde debiteur</th>
                <th className="px-4 py-2 text-right font-medium">Solde crediteur</th>
              </tr>
            </thead>
            <tbody>
              {balance.map((b) => (
                <tr key={b.compte} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                  <td className="px-4 py-2.5 font-mono text-slate-700">{b.compte}</td>
                  <td className="px-4 py-2.5 text-slate-600">{b.libelle}</td>
                  <td className="px-4 py-2.5 text-right text-slate-600">{fcfa(b.totalDebit)}</td>
                  <td className="px-4 py-2.5 text-right text-slate-600">{fcfa(b.totalCredit)}</td>
                  <td className="px-4 py-2.5 text-right font-medium text-slate-800">{b.soldeDebiteur ? fcfa(b.soldeDebiteur) : "—"}</td>
                  <td className="px-4 py-2.5 text-right font-medium text-slate-800">{b.soldeCrediteur ? fcfa(b.soldeCrediteur) : "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 text-sm font-semibold text-slate-800">
                <td className="px-4 py-2.5" colSpan={2}>Totaux</td>
                <td className="px-4 py-2.5 text-right">{fcfa(resultat?.totalDebit ?? 0)}</td>
                <td className="px-4 py-2.5 text-right">{fcfa(resultat?.totalCredit ?? 0)}</td>
                <td className="px-4 py-2.5 text-right">{fcfa(resultat?.totalSoldeDebiteur ?? 0)}</td>
                <td className="px-4 py-2.5 text-right">{fcfa(resultat?.totalSoldeCrediteur ?? 0)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      {!resultat?.equilibre && balance.length > 0 && (
        <div className="border-t border-red-100 bg-red-50 px-4 py-2 text-xs font-medium text-red-600">
          Balance desequilibree : le total debit ne correspond pas au total credit.
        </div>
      )}
    </Card>
  );
}

/* --------------------- compte de resultat (economique) --------------------- */

function CompteResultatView({ cr }: { cr: CompteResultat | null }) {
  if (!cr || (cr.produits.length === 0 && cr.charges.length === 0)) {
    return (
      <Card className="px-4 py-12 text-center text-sm text-slate-400">
        Aucun produit ni charge enregistre. Le compte de resultat se remplit a partir
        des ecritures des classes 6 (charges) et 7 (produits).
      </Card>
    );
  }
  const benefice = cr.resultatNet;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Produits (classe 7)" value={fcfa(cr.totalProduits)} icon="chart" />
        <StatTile label="Charges (classe 6)" value={fcfa(cr.totalCharges)} icon="charges" />
        <StatTile
          label={cr.beneficiaire ? "Resultat net (benefice)" : "Resultat net (perte)"}
          value={fcfa(benefice)}
          hint="Produits − charges"
          icon="comptabilite"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <PostesCard titre="Produits" postes={cr.produits} total={cr.totalProduits} accent="emerald" />
        <PostesCard titre="Charges" postes={cr.charges} total={cr.totalCharges} accent="rose" />
      </div>

      <Card
        className={`flex items-center justify-between px-4 py-3 text-sm font-semibold ${
          cr.beneficiaire ? "text-emerald-700" : "text-rose-700"
        }`}
      >
        <span>{cr.beneficiaire ? "Benefice net de l'exercice" : "Perte nette de l'exercice"}</span>
        <span>{fcfa(benefice)}</span>
      </Card>
    </div>
  );
}

/* ------------------------------ bilan actif/passif ------------------------------ */

function BilanView({ bilan }: { bilan: Bilan | null }) {
  if (!bilan || (bilan.actif.length === 0 && bilan.passif.length === 0)) {
    return (
      <Card className="px-4 py-12 text-center text-sm text-slate-400">
        Aucun compte de bilan mouvemente. Le bilan se construit a partir des comptes
        des classes 1 a 5.
      </Card>
    );
  }
  // Le resultat net est presente comme une ressource (passif).
  const resultatPoste: PosteEtat = {
    compte: "13",
    libelle:
      bilan.resultatNet >= 0
        ? "Resultat net de l'exercice (benefice)"
        : "Resultat net de l'exercice (perte)",
    classe: 1,
    montant: bilan.resultatNet,
  };
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Total actif" value={fcfa(bilan.totalActif)} hint="Emplois" icon="chart" />
        <StatTile label="Total passif" value={fcfa(bilan.totalPassif)} hint="Ressources" icon="comptabilite" />
        <StatTile
          label="Equilibre"
          value={bilan.equilibre ? "Equilibre" : "Desequilibre"}
          hint={bilan.equilibre ? "Actif = Passif" : `Ecart ${fcfa(Math.abs(bilan.ecart))}`}
          icon="charges"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <PostesCard titre="ACTIF (emplois)" postes={bilan.actif} total={bilan.totalActif} accent="brand" />
        <PostesCard
          titre="PASSIF (ressources)"
          postes={[...bilan.passif, resultatPoste]}
          total={bilan.totalPassif}
          accent="slate"
        />
      </div>

      {!bilan.equilibre && (
        <div className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-700">
          Bilan desequilibre : verifiez que toutes les ecritures sont equilibrees (balance).
        </div>
      )}
    </div>
  );
}

/** Carte generique listant des postes d'etat financier avec un total. */
function PostesCard({
  titre,
  postes,
  total,
  accent,
}: {
  titre: string;
  postes: PosteEtat[];
  total: number;
  accent: "emerald" | "rose" | "brand" | "slate";
}) {
  const couleurTotal: Record<typeof accent, string> = {
    emerald: "text-emerald-700",
    rose: "text-rose-700",
    brand: "text-brand-700",
    slate: "text-slate-800",
  };
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-slate-100 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {titre}
      </div>
      {postes.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-slate-400">Aucun poste.</div>
      ) : (
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <tbody>
            {postes.map((p) => (
              <tr key={p.compte} className="border-b border-slate-50 last:border-0">
                <td className="px-4 py-2 font-mono text-xs text-slate-500">{p.compte}</td>
                <td className="px-4 py-2 text-slate-700">{p.libelle}</td>
                <td className="px-4 py-2 text-right font-medium text-slate-800">{fcfa(p.montant)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-200 bg-slate-50 text-sm font-semibold">
              <td className="px-4 py-2.5" colSpan={2}>
                Total
              </td>
              <td className={`px-4 py-2.5 text-right ${couleurTotal[accent]}`}>{fcfa(total)}</td>
            </tr>
          </tfoot>
        </table>
        </div>
      )}
    </Card>
  );
}

/* --------------------------- editeur d'ecriture --------------------------- */

function EcritureEditor({
  initial,
  onCancel,
  onSave,
}: {
  initial: EcritureLocal;
  onCancel: () => void;
  onSave: (e: EcritureLocal) => void;
}) {
  const [e, setE] = useState<EcritureLocal>(initial);
  const [totaux, setTotaux] = useState<{ debit: number; credit: number; equilibree: boolean }>({
    debit: 0,
    credit: 0,
    equilibree: true,
  });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const up = <K extends keyof EcritureLocal>(k: K, v: EcritureLocal[K]) =>
    setE((prev) => ({ ...prev, [k]: v }));

  // Controle d'equilibre de CETTE ecriture par le moteur (server action).
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const r = await calculerComptabiliteAction([toInput(e)]);
      if (r.ok) {
        const c = r.resultat.ecritures[0];
        setTotaux({
          debit: c?.totalDebit ?? 0,
          credit: c?.totalCredit ?? 0,
          equilibree: c?.equilibree ?? true,
        });
      }
    }, 200);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [e.lignes]);

  const majLigne = (i: number, patch: Partial<LigneEcritureLocal>) => {
    const arr = [...e.lignes];
    const cur = arr[i];
    if (!cur) return;
    arr[i] = { ...cur, ...patch };
    up("lignes", arr);
  };

  function choisirCompte(i: number, numero: string) {
    majLigne(i, { compte: numero, libelle: numero ? libelleCompte(numero) : "" });
  }

  const ecart = totaux.debit - totaux.credit;
  const valide =
    e.libelle.trim().length > 0 && totaux.debit > 0 && totaux.equilibree;

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
              {initial.id ? "Modifier" : "Nouvelle"} ecriture
            </h1>
            <p className="text-sm text-slate-500">L'equilibre est controle par le moteur, jamais dans le navigateur.</p>
          </div>
        </div>
        <BtnPrimary onClick={() => onSave(e)} disabled={!valide}>
          <Icon name="comptabilite" className="h-4 w-4" /> Enregistrer
        </BtnPrimary>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <div className="space-y-5">
          {/* En-tete */}
          <Card className="p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Date">
                <input
                  type="date"
                  className={inputCls}
                  value={e.date}
                  onChange={(ev) => up("date", ev.target.value)}
                />
              </Field>
              <Field label="Journal">
                <select className={inputCls} value={e.journal} onChange={(ev) => up("journal", ev.target.value)}>
                  {JOURNAUX.map(([code, l]) => (
                    <option key={code} value={code}>{code} — {l}</option>
                  ))}
                </select>
              </Field>
              <Field label="Libelle *">
                <Text value={e.libelle} onChange={(v) => up("libelle", v)} placeholder="Ex. Facture fournisseur SENELEC" />
              </Field>
              <Field label="Reference / piece">
                <Text value={e.reference ?? ""} onChange={(v) => up("reference", v)} placeholder="Ex. FAC-2026-0001" />
              </Field>
            </div>
          </Card>

          {/* Lignes */}
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">Lignes d'ecriture</h3>
            </div>
            <div className="hidden gap-2 px-1 pb-1 text-xs font-medium text-slate-500 sm:grid sm:grid-cols-[1fr_120px_120px_auto]">
              <span>Compte</span>
              <span className="text-right">Debit</span>
              <span className="text-right">Credit</span>
              <span />
            </div>
            <div className="space-y-2">
              {e.lignes.map((l, i) => (
                <div key={i} className="grid gap-2 sm:grid-cols-[1fr_120px_120px_auto]">
                  <select
                    className={inputCls}
                    value={l.compte}
                    onChange={(ev) => choisirCompte(i, ev.target.value)}
                  >
                    <option value="">— Choisir un compte —</option>
                    {COMPTES_PAR_CLASSE.map((g) => (
                      <optgroup key={g.classe} label={`Classe ${g.classe} — ${g.titre}`}>
                        {g.comptes.map((c) => (
                          <option key={c.numero} value={c.numero}>
                            {c.numero} · {c.libelle}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <Num value={l.debit} onChange={(n) => majLigne(i, { debit: n, credit: n > 0 ? 0 : l.credit })} />
                  <Num value={l.credit} onChange={(n) => majLigne(i, { credit: n, debit: n > 0 ? 0 : l.debit })} />
                  <button
                    type="button"
                    className="rounded-lg px-2 text-slate-400 hover:bg-slate-100 hover:text-red-600 disabled:opacity-30"
                    disabled={e.lignes.length <= 2}
                    onClick={() => up("lignes", e.lignes.filter((_, j) => j !== i))}
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
              onClick={() => up("lignes", [...e.lignes, ligneVide()])}
            >
              <Icon name="plus" className="h-4 w-4" /> Ajouter une ligne
            </button>
          </Card>
        </div>

        {/* Controle (snapshot moteur) */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <Card className="p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">Controle</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Total debit</dt>
                <dd className="font-medium text-slate-800">{fcfa(totaux.debit)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Total credit</dt>
                <dd className="font-medium text-slate-800">{fcfa(totaux.credit)}</dd>
              </div>
              <div className="my-2 border-t border-slate-100" />
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Ecart</dt>
                <dd className={`font-semibold ${ecart === 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {fcfa(ecart)}
                </dd>
              </div>
            </dl>
            <div
              className={`mt-4 rounded-lg px-3 py-2 text-xs font-medium ${
                totaux.equilibree && totaux.debit > 0
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-amber-50 text-amber-700"
              }`}
            >
              {totaux.debit === 0
                ? "Saisissez au moins un debit et un credit."
                : totaux.equilibree
                  ? "Ecriture equilibree ✓"
                  : "Ecriture desequilibree — debit ≠ credit."}
            </div>
            <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-500">
              Cumuls produits par le moteur de calcul (serveur), en FCFA entiers.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
