"use client";

/**
 * Ecran STOCKS — matieres premieres, produits finis et valorisation CUMP.
 *
 * L'UI COLLECTE les articles et leurs mouvements (entrees / sorties /
 * inventaires) ; la quantite en stock, le CUMP et la valeur du stock viennent de
 * la server action -> moteur teste (`calculerStock`). Le navigateur ne valorise
 * rien lui-meme. L'etat est persiste localement (localStorage) en attendant Supabase.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { calculerStockAction } from "../../app/(app)/stocks/actions";
import type { ArticleStockInput, ResultatStock, TypeMouvement } from "../../lib/engine";
import {
  store,
  genId,
  TYPES_ARTICLE,
  TYPES_MOUVEMENT,
  libelleTypeArticle,
  libelleMouvement,
  type ArticleLocal,
  type MouvementLocal,
} from "../../lib/achats-stock-data";
import type { TypeArticle } from "../../lib/engine";
import { Card, PageHeading, StatTile } from "../ui";
import { Icon } from "../icons";
import { Field, Text, Num, Modal, BtnPrimary, BtnGhost, inputCls } from "../ventes/form";
import { fcfa, dateCourte } from "../../lib/format";

function toInput(a: ArticleLocal): ArticleStockInput {
  return {
    ref: a.ref,
    designation: a.designation,
    type: a.type,
    unite: a.unite,
    seuilAlerte: a.seuilAlerte,
    mouvements: a.mouvements.map((m) => ({
      type: m.type,
      quantite: m.quantite,
      coutUnitaire: m.coutUnitaire,
    })),
  };
}

function qte(n: number, unite: string): string {
  const v = Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
  return `${v} ${unite}`;
}

function articleVide(): ArticleLocal {
  return {
    id: "",
    ref: "",
    designation: "",
    type: "matiere_premiere",
    unite: "kg",
    seuilAlerte: 0,
    mouvements: [],
    quantite: 0,
    cump: 0,
    valeurStock: 0,
  };
}

export function StocksClient() {
  const [articles, setArticles] = useState<ArticleLocal[]>([]);
  const [pret, setPret] = useState(false);
  const [resultat, setResultat] = useState<ResultatStock | null>(null);
  const [edition, setEdition] = useState<ArticleLocal | null>(null);
  const [mouvementsDe, setMouvementsDe] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setArticles(store.chargerArticles());
    setPret(true);
  }, []);

  useEffect(() => {
    if (pret) store.sauverArticles(articles);
  }, [articles, pret]);

  // Valorisation par le moteur (server action), debounce leger. On fusionne le
  // snapshot (quantite / CUMP / valeur) dans chaque article, par position.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const r = await calculerStockAction(articles.map(toInput));
      if (r.ok) setResultat(r.resultat);
    }, 200);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [articles]);

  const snapParRef = useMemo(() => {
    const m = new Map<string, ResultatStock["articles"][number]>();
    for (const a of resultat?.articles ?? []) m.set(a.ref, a);
    return m;
  }, [resultat]);

  const articleCourant = useMemo(
    () => articles.find((a) => a.id === mouvementsDe) ?? null,
    [articles, mouvementsDe],
  );

  function enregistrerArticle(a: ArticleLocal) {
    if (!a.ref.trim() || !a.designation.trim()) return;
    setArticles((prev) => {
      if (a.id) return prev.map((x) => (x.id === a.id ? a : x));
      return [...prev, { ...a, id: genId() }];
    });
    setEdition(null);
  }

  function supprimerArticle(id: string) {
    setArticles((prev) => prev.filter((a) => a.id !== id));
    if (mouvementsDe === id) setMouvementsDe(null);
  }

  function ajouterMouvement(articleId: string, m: MouvementLocal) {
    setArticles((prev) =>
      prev.map((a) =>
        a.id === articleId ? { ...a, mouvements: [...a.mouvements, m] } : a,
      ),
    );
  }

  function supprimerMouvement(articleId: string, mouvementId: string) {
    setArticles((prev) =>
      prev.map((a) =>
        a.id === articleId
          ? { ...a, mouvements: a.mouvements.filter((m) => m.id !== mouvementId) }
          : a,
      ),
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeading
        titre="Stocks"
        sousTitre="Matieres premieres et produits finis. Valorisation CUMP calculee par le moteur."
        action={
          <BtnPrimary onClick={() => setEdition(articleVide())}>
            <Icon name="plus" className="h-4 w-4" /> Nouvel article
          </BtnPrimary>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Articles" value={articles.length} icon="stocks" />
        <StatTile label="Valeur du stock" value={fcfa(resultat?.valeurTotale ?? 0)} hint="Au CUMP" icon="charges" />
        <StatTile label="Sous seuil" value={resultat?.nbSousSeuil ?? 0} hint="A reapprovisionner" icon="achats" />
        <StatTile label="Ruptures" value={resultat?.nbRuptures ?? 0} hint="Stock epuise" icon="production" />
      </div>

      <Card className="overflow-hidden">
        {articles.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-slate-400">
            Aucun article. Ajoutez votre premier article, puis ses mouvements.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2 font-medium">Article</th>
                  <th className="px-4 py-2 font-medium">Type</th>
                  <th className="px-4 py-2 text-right font-medium">Stock</th>
                  <th className="px-4 py-2 text-right font-medium">CUMP</th>
                  <th className="px-4 py-2 text-right font-medium">Valeur</th>
                  <th className="px-4 py-2 font-medium">Etat</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {articles.map((a) => {
                  const s = snapParRef.get(a.ref);
                  const quantite = s?.quantite ?? a.quantite;
                  return (
                    <tr key={a.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                      <td className="px-4 py-2.5">
                        <button
                          type="button"
                          onClick={() => setMouvementsDe(a.id)}
                          className="text-left font-medium text-slate-800 hover:text-brand-700"
                        >
                          {a.designation}
                        </button>
                        <div className="text-xs text-slate-400">{a.ref}</div>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                          {libelleTypeArticle(a.type)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-700">{qte(quantite, a.unite)}</td>
                      <td className="px-4 py-2.5 text-right text-slate-600">{fcfa(s?.cump ?? a.cump)}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-slate-800">{fcfa(s?.valeurStock ?? a.valeurStock)}</td>
                      <td className="px-4 py-2.5">
                        {s?.enRupture ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">
                            Rupture
                          </span>
                        ) : s?.sousSeuil ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                            Sous seuil
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                            OK
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setMouvementsDe(a.id)}
                            className="rounded-lg px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50"
                          >
                            Mouvements
                          </button>
                          <button
                            type="button"
                            onClick={() => setEdition(a)}
                            className="rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100"
                          >
                            Fiche
                          </button>
                          <button
                            type="button"
                            onClick={() => supprimerArticle(a.id)}
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

      <p className="mt-4 text-xs text-slate-400">
        Le CUMP (cout unitaire moyen pondere) et la valeur du stock sont calcules par le
        moteur en rejouant les mouvements de chaque article (serveur).
      </p>

      {edition && (
        <ArticleForm
          initial={edition}
          onClose={() => setEdition(null)}
          onSave={enregistrerArticle}
        />
      )}
      {articleCourant && (
        <MouvementsModal
          article={articleCourant}
          onClose={() => setMouvementsDe(null)}
          onAdd={(m) => ajouterMouvement(articleCourant.id, m)}
          onDelete={(mid) => supprimerMouvement(articleCourant.id, mid)}
        />
      )}
    </div>
  );
}

function ArticleForm({
  initial,
  onClose,
  onSave,
}: {
  initial: ArticleLocal;
  onClose: () => void;
  onSave: (a: ArticleLocal) => void;
}) {
  const [a, setA] = useState<ArticleLocal>(initial);
  const up = <K extends keyof ArticleLocal>(k: K, v: ArticleLocal[K]) =>
    setA((prev) => ({ ...prev, [k]: v }));

  return (
    <Modal
      titre={initial.id ? "Fiche article" : "Nouvel article"}
      onClose={onClose}
      footer={
        <>
          <BtnGhost onClick={onClose}>Annuler</BtnGhost>
          <BtnPrimary onClick={() => onSave(a)} disabled={!a.ref.trim() || !a.designation.trim()}>
            Enregistrer
          </BtnPrimary>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Reference (SKU) *">
          <Text value={a.ref} onChange={(v) => up("ref", v)} placeholder="Ex. FAR-T55" />
        </Field>
        <Field label="Unite">
          <Text value={a.unite} onChange={(v) => up("unite", v)} placeholder="kg, unite, L…" />
        </Field>
        <Field label="Designation *" className="sm:col-span-2">
          <Text value={a.designation} onChange={(v) => up("designation", v)} placeholder="Ex. Farine de ble T55" />
        </Field>
        <Field label="Type">
          <select
            className={inputCls}
            value={a.type}
            onChange={(e) => up("type", e.target.value as TypeArticle)}
          >
            {TYPES_ARTICLE.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </Field>
        <Field label="Seuil de reappro">
          <Num value={a.seuilAlerte} suffix={a.unite} onChange={(n) => up("seuilAlerte", n)} />
        </Field>
      </div>
      <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-500">
        La quantite et la valeur ne se saisissent pas ici : elles decoulent des
        mouvements (entrees / sorties / inventaires) valorises par le moteur.
      </p>
    </Modal>
  );
}

function MouvementsModal({
  article,
  onClose,
  onAdd,
  onDelete,
}: {
  article: ArticleLocal;
  onClose: () => void;
  onAdd: (m: MouvementLocal) => void;
  onDelete: (id: string) => void;
}) {
  const [type, setType] = useState<TypeMouvement>("entree");
  const [quantite, setQuantite] = useState(0);
  const [coutUnitaire, setCoutUnitaire] = useState(0);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  function ajouter() {
    if (quantite <= 0) return;
    onAdd({
      id: genId(),
      type,
      quantite,
      coutUnitaire: type === "entree" ? coutUnitaire : undefined,
      date,
    });
    setQuantite(0);
    setCoutUnitaire(0);
  }

  return (
    <Modal titre={`Mouvements — ${article.designation}`} onClose={onClose}>
      <div className="rounded-lg border border-slate-200 p-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Type de mouvement">
            <select
              className={inputCls}
              value={type}
              onChange={(e) => setType(e.target.value as TypeMouvement)}
            >
              {TYPES_MOUVEMENT.map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </Field>
          <Field label={type === "inventaire" ? "Quantite constatee" : "Quantite"}>
            <Num value={quantite} suffix={article.unite} step={0.01} onChange={setQuantite} />
          </Field>
          {type === "entree" && (
            <Field label="Cout unitaire HT">
              <Num value={coutUnitaire} suffix="FCFA" onChange={setCoutUnitaire} />
            </Field>
          )}
          <Field label="Date">
            <input
              type="date"
              className={inputCls}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
        </div>
        <div className="mt-3 flex justify-end">
          <BtnPrimary onClick={ajouter} disabled={quantite <= 0}>
            <Icon name="plus" className="h-4 w-4" /> Ajouter le mouvement
          </BtnPrimary>
        </div>
      </div>

      <div className="mt-4">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Historique
        </h4>
        {article.mouvements.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-400">Aucun mouvement.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {article.mouvements.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <div>
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      m.type === "entree"
                        ? "bg-emerald-50 text-emerald-700"
                        : m.type === "sortie"
                          ? "bg-red-50 text-red-700"
                          : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {libelleMouvement(m.type)}
                  </span>
                  <span className="ml-2 text-slate-700">
                    {m.quantite} {article.unite}
                    {m.coutUnitaire ? ` @ ${fcfa(m.coutUnitaire)}` : ""}
                  </span>
                  {m.date && <span className="ml-2 text-xs text-slate-400">{dateCourte(m.date)}</span>}
                </div>
                <button
                  type="button"
                  onClick={() => onDelete(m.id)}
                  className="rounded p-1 text-slate-300 hover:text-red-600"
                  aria-label="Supprimer le mouvement"
                >
                  <Icon name="close" className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
