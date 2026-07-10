"use client";

/**
 * Ecran PRODUCTION / MRP — nomenclatures (BOM), ordres de fabrication et calcul
 * des besoins matiere.
 *
 * L'UI COLLECTE les nomenclatures et les ordres de fabrication ; le calcul des
 * besoins (bruts / nets) et le cout matiere viennent de la server action ->
 * moteur teste (`calculerProduction`). Le stock disponible des composants est lu
 * dans le module Stocks (snapshot du moteur). Le navigateur ne calcule aucun
 * besoin ni cout. Etat persiste dans Supabase (RLS, scope par entreprise active).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { calculerProductionAction } from "../../app/(app)/production/actions";
import type {
  NomenclatureInput,
  OrdreFabricationInput,
  StockComposant,
  ResultatProduction,
} from "../../lib/engine";
import {
  store,
  STATUTS_ORDRE,
  libelleStatutOrdre,
  type NomenclatureLocal,
  type OrdreLocal,
  type ComposantLocal,
  type StatutOrdre,
} from "../../lib/achats-stock-data";
import { useEntreprise } from "../../lib/entreprise-context";
import { Card, PageHeading, StatTile } from "../ui";
import { Icon } from "../icons";
import { Field, Text, Num, Modal, BtnPrimary, BtnGhost, inputCls } from "../ventes/form";
import { fcfa, dateCourte } from "../../lib/format";

function nomToInput(n: NomenclatureLocal): NomenclatureInput {
  return {
    produit: n.produit,
    composants: n.composants.map((c) => ({
      ref: c.ref,
      quantite: c.quantite,
      coutUnitaire: c.coutUnitaire,
    })),
  };
}
function ofToInput(o: OrdreLocal): OrdreFabricationInput {
  return { produit: o.produit, quantite: o.quantite };
}

function num(n: number): string {
  return Number.isFinite(n) ? String(Math.round(n * 1000) / 1000) : "0";
}

function ordreVide(nomenclatures: NomenclatureLocal[]): OrdreLocal {
  return {
    id: "",
    produit: nomenclatures[0]?.produit ?? "",
    quantite: 100,
    statut: "planifie",
    echeance: "",
  };
}
function nomenclatureVide(): NomenclatureLocal {
  return {
    id: "",
    produit: "",
    designation: "",
    composants: [{ ref: "", quantite: 1, coutUnitaire: 0 }],
  };
}

export function ProductionClient() {
  const { active } = useEntreprise();
  const entrepriseId = active?.id ?? "";
  const [nomenclatures, setNomenclatures] = useState<NomenclatureLocal[]>([]);
  const [ordres, setOrdres] = useState<OrdreLocal[]>([]);
  const [stock, setStock] = useState<StockComposant[]>([]);
  const [pret, setPret] = useState(false);
  const [resultat, setResultat] = useState<ResultatProduction | null>(null);
  const [editionOrdre, setEditionOrdre] = useState<OrdreLocal | null>(null);
  const [editionNom, setEditionNom] = useState<NomenclatureLocal | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Chargement des nomenclatures, ordres et stock de l'entreprise active (Supabase, RLS).
  useEffect(() => {
    let vivant = true;
    setPret(false);
    (async () => {
      const [noms, ords, arts] = entrepriseId
        ? await Promise.all([
            store.chargerNomenclatures(entrepriseId),
            store.chargerOrdres(entrepriseId),
            store.chargerArticles(entrepriseId),
          ])
        : [[], [], []];
      if (!vivant) return;
      setNomenclatures(noms);
      setOrdres(ords);
      // Stock disponible des composants = snapshot du module Stocks (Supabase).
      setStock(arts.map((a) => ({ ref: a.ref, quantite: a.quantite })));
      setPret(true);
    })();
    return () => {
      vivant = false;
    };
  }, [entrepriseId]);

  // Calcul des besoins (MRP) par le moteur (server action), debounce leger.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const r = await calculerProductionAction(
        nomenclatures.map(nomToInput),
        ordres.map(ofToInput),
        stock,
      );
      if (r.ok) setResultat(r.resultat);
    }, 200);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [nomenclatures, ordres, stock]);

  const designationProduit = useMemo(() => {
    const m = new Map<string, string>();
    for (const n of nomenclatures) m.set(n.produit, n.designation || n.produit);
    return m;
  }, [nomenclatures]);

  const coutOrdreParIndex = resultat?.ordres ?? [];

  async function enregistrerOrdre(o: OrdreLocal) {
    if (!o.produit.trim() || o.quantite <= 0 || !entrepriseId) return;
    try {
      const saved = await store.enregistrerOrdre(entrepriseId, o);
      setOrdres((prev) => (o.id ? prev.map((x) => (x.id === o.id ? saved : x)) : [saved, ...prev]));
      setEditionOrdre(null);
    } catch (e) {
      setErreur((e as Error).message);
    }
  }
  async function supprimerOrdre(id: string) {
    try {
      await store.supprimerOrdre(id);
      setOrdres((prev) => prev.filter((o) => o.id !== id));
    } catch (e) {
      setErreur((e as Error).message);
    }
  }

  async function enregistrerNom(n: NomenclatureLocal) {
    if (!n.produit.trim() || !entrepriseId) return;
    const nette = { ...n, composants: n.composants.filter((c) => c.ref.trim()) };
    try {
      const saved = await store.enregistrerNomenclature(entrepriseId, nette);
      setNomenclatures((prev) => (nette.id ? prev.map((x) => (x.id === nette.id ? saved : x)) : [...prev, saved]));
      setEditionNom(null);
    } catch (e) {
      setErreur((e as Error).message);
    }
  }
  async function supprimerNom(id: string) {
    try {
      await store.supprimerNomenclature(id);
      setNomenclatures((prev) => prev.filter((n) => n.id !== id));
    } catch (e) {
      setErreur((e as Error).message);
    }
  }

  if (!entrepriseId) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeading titre="Production / MRP" sousTitre="Nomenclatures, ordres de fabrication et besoins matiere." />
        <Card className="px-4 py-12 text-center text-sm text-slate-500">
          Selectionnez d&apos;abord une entreprise pour planifier sa production.
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeading
        titre="Production / MRP"
        sousTitre="Nomenclatures, ordres de fabrication et calcul des besoins matiere par le moteur."
        action={
          <div className="flex gap-2">
            <BtnGhost onClick={() => setEditionNom(nomenclatureVide())}>
              <Icon name="plus" className="h-4 w-4" /> Nomenclature
            </BtnGhost>
            <BtnPrimary onClick={() => setEditionOrdre(ordreVide(nomenclatures))}>
              <Icon name="plus" className="h-4 w-4" /> Ordre de fabrication
            </BtnPrimary>
          </div>
        }
      />

      {erreur && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</div>
      )}
      {!pret && <div className="mb-4 text-sm text-slate-400">Chargement des donnees…</div>}

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Ordres" value={ordres.length} icon="production" />
        <StatTile label="Cout matiere" value={fcfa(resultat?.coutMatiereTotal ?? 0)} hint="Tous ordres" icon="charges" />
        <StatTile label="A acheter" value={fcfa(resultat?.valeurAAcheterTotale ?? 0)} hint="Approvisionnements" icon="achats" />
        <StatTile label="Composants a approvisionner" value={resultat?.besoins.filter((b) => b.besoinNet > 0).length ?? 0} icon="stocks" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-5">
          {/* Ordres de fabrication */}
          <Card className="overflow-hidden">
            <div className="border-b border-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700">
              Ordres de fabrication
            </div>
            {ordres.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-slate-400">
                Aucun ordre. Creez une nomenclature, puis un ordre de fabrication.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-2 font-medium">Produit</th>
                      <th className="px-4 py-2 text-right font-medium">Quantite</th>
                      <th className="px-4 py-2 font-medium">Statut</th>
                      <th className="px-4 py-2 text-right font-medium">Cout matiere</th>
                      <th className="px-4 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {ordres.map((o, i) => {
                      const snap = coutOrdreParIndex[i];
                      return (
                        <tr key={o.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                          <td className="px-4 py-2.5">
                            <button
                              type="button"
                              onClick={() => setEditionOrdre(o)}
                              className="text-left font-medium text-slate-800 hover:text-brand-700"
                            >
                              {designationProduit.get(o.produit) ?? o.produit}
                            </button>
                            <div className="text-xs text-slate-400">
                              {o.produit}
                              {o.echeance ? ` · ${dateCourte(o.echeance)}` : ""}
                              {snap?.sansNomenclature ? " · sans nomenclature" : ""}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-right text-slate-700">{num(o.quantite)}</td>
                          <td className="px-4 py-2.5">
                            <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                              {libelleStatutOrdre(o.statut)}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right font-medium text-slate-800">{fcfa(snap?.coutMatiere ?? 0)}</td>
                          <td className="px-4 py-2.5 text-right">
                            <button
                              type="button"
                              onClick={() => supprimerOrdre(o.id)}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600"
                              aria-label="Supprimer"
                            >
                              <Icon name="close" className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Besoins nets (MRP) */}
          <Card className="overflow-hidden">
            <div className="border-b border-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700">
              Besoins matiere (MRP)
            </div>
            {!resultat || resultat.besoins.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-slate-400">
                Aucun besoin : ajoutez des ordres de fabrication avec une nomenclature.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-2 font-medium">Composant</th>
                      <th className="px-4 py-2 text-right font-medium">Besoin brut</th>
                      <th className="px-4 py-2 text-right font-medium">Dispo.</th>
                      <th className="px-4 py-2 text-right font-medium">Besoin net</th>
                      <th className="px-4 py-2 text-right font-medium">A acheter</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultat.besoins.map((b) => (
                      <tr key={b.ref} className="border-b border-slate-50 last:border-0">
                        <td className="px-4 py-2.5 font-medium text-slate-700">{b.ref}</td>
                        <td className="px-4 py-2.5 text-right text-slate-600">{num(b.besoinBrut)}</td>
                        <td className="px-4 py-2.5 text-right text-slate-600">{num(b.disponible)}</td>
                        <td className="px-4 py-2.5 text-right font-medium text-slate-800">{num(b.besoinNet)}</td>
                        <td className={`px-4 py-2.5 text-right ${b.valeurAAcheter > 0 ? "font-medium text-amber-700" : "text-slate-400"}`}>
                          {b.valeurAAcheter > 0 ? fcfa(b.valeurAAcheter) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* Nomenclatures */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <Card className="p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">Nomenclatures (BOM)</h3>
            {nomenclatures.length === 0 ? (
              <p className="text-sm text-slate-400">Aucune nomenclature.</p>
            ) : (
              <ul className="space-y-2">
                {nomenclatures.map((n) => (
                  <li key={n.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setEditionNom(n)}
                        className="text-left text-sm font-medium text-slate-800 hover:text-brand-700"
                      >
                        {n.designation || n.produit}
                      </button>
                      <button
                        type="button"
                        onClick={() => supprimerNom(n.id)}
                        className="shrink-0 rounded p-0.5 text-slate-300 hover:text-red-600"
                        aria-label="Supprimer la nomenclature"
                      >
                        <Icon name="close" className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="mt-0.5 text-xs text-slate-400">
                      {n.produit} · {n.composants.length} composant(s)
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-500">
              Le besoin net = besoin brut − stock disponible (lu dans le module Stocks).
              Cout matiere et valeur a acheter produits par le moteur (serveur).
            </p>
          </Card>
        </div>
      </div>

      {editionOrdre && (
        <OrdreForm
          initial={editionOrdre}
          nomenclatures={nomenclatures}
          onClose={() => setEditionOrdre(null)}
          onSave={enregistrerOrdre}
        />
      )}
      {editionNom && (
        <NomenclatureForm
          initial={editionNom}
          onClose={() => setEditionNom(null)}
          onSave={enregistrerNom}
        />
      )}
    </div>
  );
}

function OrdreForm({
  initial,
  nomenclatures,
  onClose,
  onSave,
}: {
  initial: OrdreLocal;
  nomenclatures: NomenclatureLocal[];
  onClose: () => void;
  onSave: (o: OrdreLocal) => void;
}) {
  const [o, setO] = useState<OrdreLocal>(initial);
  const up = <K extends keyof OrdreLocal>(k: K, v: OrdreLocal[K]) =>
    setO((prev) => ({ ...prev, [k]: v }));

  return (
    <Modal
      titre={initial.id ? "Modifier l'ordre" : "Nouvel ordre de fabrication"}
      onClose={onClose}
      footer={
        <>
          <BtnGhost onClick={onClose}>Annuler</BtnGhost>
          <BtnPrimary onClick={() => onSave(o)} disabled={!o.produit.trim() || o.quantite <= 0}>
            Enregistrer
          </BtnPrimary>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Produit a fabriquer *" className="sm:col-span-2">
          {nomenclatures.length > 0 ? (
            <select
              className={inputCls}
              value={o.produit}
              onChange={(e) => up("produit", e.target.value)}
            >
              <option value="">— Choisir —</option>
              {nomenclatures.map((n) => (
                <option key={n.id} value={n.produit}>
                  {n.designation || n.produit} ({n.produit})
                </option>
              ))}
            </select>
          ) : (
            <Text value={o.produit} onChange={(v) => up("produit", v)} placeholder="Reference du produit" />
          )}
        </Field>
        <Field label="Quantite a produire">
          <Num value={o.quantite} onChange={(n) => up("quantite", n)} />
        </Field>
        <Field label="Statut">
          <select
            className={inputCls}
            value={o.statut}
            onChange={(e) => up("statut", e.target.value as StatutOrdre)}
          >
            {STATUTS_ORDRE.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </Field>
        <Field label="Echeance" className="sm:col-span-2">
          <input
            type="date"
            className={inputCls}
            value={o.echeance ?? ""}
            onChange={(e) => up("echeance", e.target.value)}
          />
        </Field>
      </div>
    </Modal>
  );
}

function NomenclatureForm({
  initial,
  onClose,
  onSave,
}: {
  initial: NomenclatureLocal;
  onClose: () => void;
  onSave: (n: NomenclatureLocal) => void;
}) {
  const [n, setN] = useState<NomenclatureLocal>(initial);
  const up = <K extends keyof NomenclatureLocal>(k: K, v: NomenclatureLocal[K]) =>
    setN((prev) => ({ ...prev, [k]: v }));

  function majComposant(idx: number, patch: Partial<ComposantLocal>) {
    setN((prev) => ({
      ...prev,
      composants: prev.composants.map((c, i) => (i === idx ? { ...c, ...patch } : c)),
    }));
  }
  function ajouterComposant() {
    setN((prev) => ({
      ...prev,
      composants: [...prev.composants, { ref: "", quantite: 1, coutUnitaire: 0 }],
    }));
  }
  function supprimerComposant(idx: number) {
    setN((prev) => ({ ...prev, composants: prev.composants.filter((_, i) => i !== idx) }));
  }

  return (
    <Modal
      titre={initial.id ? "Modifier la nomenclature" : "Nouvelle nomenclature"}
      onClose={onClose}
      footer={
        <>
          <BtnGhost onClick={onClose}>Annuler</BtnGhost>
          <BtnPrimary onClick={() => onSave(n)} disabled={!n.produit.trim()}>
            Enregistrer
          </BtnPrimary>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Reference produit fini *">
          <Text value={n.produit} onChange={(v) => up("produit", v)} placeholder="Ex. PAIN-MIE" />
        </Field>
        <Field label="Designation">
          <Text value={n.designation} onChange={(v) => up("designation", v)} placeholder="Ex. Pain de mie" />
        </Field>
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Composants (par unite produite)
          </h4>
          <button
            type="button"
            onClick={ajouterComposant}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50"
          >
            <Icon name="plus" className="h-3.5 w-3.5" /> Composant
          </button>
        </div>
        <div className="mb-1 grid grid-cols-12 px-1 text-[10px] uppercase tracking-wide text-slate-400">
          <span className="col-span-5">Ref composant</span>
          <span className="col-span-3">Qte / unite</span>
          <span className="col-span-4">Cout unitaire</span>
        </div>
        <div className="space-y-2">
          {n.composants.map((c, i) => (
            <div key={i} className="grid grid-cols-12 items-center gap-2">
              <div className="col-span-5">
                <input
                  className={inputCls}
                  value={c.ref}
                  placeholder="FAR-T55"
                  onChange={(e) => majComposant(i, { ref: e.target.value })}
                />
              </div>
              <div className="col-span-3">
                <input
                  type="number"
                  className={inputCls}
                  value={c.quantite}
                  min={0}
                  step={0.001}
                  onChange={(e) => majComposant(i, { quantite: Number(e.target.value) || 0 })}
                />
              </div>
              <div className="col-span-4 flex items-center gap-1">
                <input
                  type="number"
                  className={inputCls}
                  value={c.coutUnitaire}
                  min={0}
                  onChange={(e) => majComposant(i, { coutUnitaire: Number(e.target.value) || 0 })}
                />
                <button
                  type="button"
                  onClick={() => supprimerComposant(i)}
                  className="shrink-0 rounded p-1 text-slate-300 hover:text-red-600"
                  aria-label="Supprimer le composant"
                >
                  <Icon name="close" className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
