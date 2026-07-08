"use client";

/**
 * Ecran PROJETS & TACHES — kanban des taches et suivi d'avancement.
 *
 * L'UI COLLECTE les projets et les taches ; TOUTE agregation (nombre de taches,
 * avancement, charge en heures) vient de la server action -> moteur teste
 * (`calculerProjets`). Le navigateur ne compte ni ne somme rien lui-meme.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { calculerProjetsAction } from "../../app/(app)/projets/actions";
import type { ResultatProjets, StatutTache } from "../../lib/engine";
import {
  store,
  genId,
  STATUTS_TACHE,
  STATUTS_PROJET,
  libelleStatutTache,
  libelleStatutProjet,
  type ProjetLocal,
  type TacheLocal,
  type StatutProjet,
} from "../../lib/organisation-data";
import { Card, PageHeading, StatTile } from "../ui";
import { Icon } from "../icons";
import { Field, Text, Num, Modal, BtnPrimary, BtnGhost, inputCls } from "../ventes/form";
import { pct, dateCourte } from "../../lib/format";

const STATUT_ORDRE: StatutTache[] = STATUTS_TACHE.map(([v]) => v);

const COL_STYLE: Record<StatutTache, string> = {
  a_faire: "border-t-slate-300",
  en_cours: "border-t-blue-300",
  termine: "border-t-emerald-400",
};

function heures(n: number): string {
  return `${Number.isFinite(n) ? Math.round(n * 10) / 10 : 0} h`;
}

function tacheVide(projetId: string): TacheLocal {
  return {
    id: "",
    projetId,
    titre: "",
    statut: "a_faire",
    assignee: "",
    echeance: "",
    heuresEstimees: 0,
    heuresRealisees: 0,
  };
}

function projetVide(): ProjetLocal {
  return { id: "", nom: "", client: "", statut: "actif", echeance: "" };
}

export function ProjetsClient() {
  const [projets, setProjets] = useState<ProjetLocal[]>([]);
  const [taches, setTaches] = useState<TacheLocal[]>([]);
  const [pret, setPret] = useState(false);
  const [resultat, setResultat] = useState<ResultatProjets | null>(null);
  const [editionTache, setEditionTache] = useState<TacheLocal | null>(null);
  const [editionProjet, setEditionProjet] = useState<ProjetLocal | null>(null);
  const [filtre, setFiltre] = useState<string>("tous");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setProjets(store.chargerProjets());
    setTaches(store.chargerTaches());
    setPret(true);
  }, []);

  useEffect(() => {
    if (pret) store.sauverProjets(projets);
  }, [projets, pret]);

  useEffect(() => {
    if (pret) store.sauverTaches(taches);
  }, [taches, pret]);

  // Agregation par le moteur (server action), debounce leger.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const r = await calculerProjetsAction(
        taches.map((t) => ({
          projet: t.projetId,
          statut: t.statut,
          heuresEstimees: t.heuresEstimees,
          heuresRealisees: t.heuresRealisees,
        })),
        projets.map((p) => p.id),
      );
      if (r.ok) setResultat(r.resultat);
    }, 200);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [taches, projets]);

  const nomProjet = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of projets) m.set(p.id, p.nom);
    return m;
  }, [projets]);

  const avancementParProjet = useMemo(() => {
    const m = new Map<string, ResultatProjets["parProjet"][number]>();
    for (const p of resultat?.parProjet ?? []) m.set(p.projet, p);
    return m;
  }, [resultat]);

  const tachesVisibles = useMemo(
    () => (filtre === "tous" ? taches : taches.filter((t) => t.projetId === filtre)),
    [taches, filtre],
  );

  function enregistrerTache(t: TacheLocal) {
    if (!t.titre.trim() || !t.projetId) return;
    setTaches((prev) => {
      if (t.id) return prev.map((x) => (x.id === t.id ? t : x));
      return [...prev, { ...t, id: genId() }];
    });
    setEditionTache(null);
  }

  function supprimerTache(id: string) {
    setTaches((prev) => prev.filter((t) => t.id !== id));
  }

  function deplacer(id: string, direction: -1 | 1) {
    setTaches((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const idx = STATUT_ORDRE.indexOf(t.statut);
        const suivant = Math.min(STATUT_ORDRE.length - 1, Math.max(0, idx + direction));
        return { ...t, statut: STATUT_ORDRE[suivant] ?? t.statut };
      }),
    );
  }

  function enregistrerProjet(p: ProjetLocal) {
    if (!p.nom.trim()) return;
    setProjets((prev) => {
      if (p.id) return prev.map((x) => (x.id === p.id ? p : x));
      return [...prev, { ...p, id: genId() }];
    });
    setEditionProjet(null);
  }

  function supprimerProjet(id: string) {
    setProjets((prev) => prev.filter((p) => p.id !== id));
    setTaches((prev) => prev.filter((t) => t.projetId !== id));
    if (filtre === id) setFiltre("tous");
  }

  const aucunProjet = projets.length === 0;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeading
        titre="Projets & Taches"
        sousTitre="Kanban des taches, feuilles de temps et avancement calcules par le moteur."
        action={
          <div className="flex gap-2">
            <BtnGhost onClick={() => setEditionProjet(projetVide())}>
              <Icon name="plus" className="h-4 w-4" /> Projet
            </BtnGhost>
            <BtnPrimary onClick={() => setEditionTache(tacheVide(projets[0]?.id ?? ""))}>
              <Icon name="plus" className="h-4 w-4" /> Nouvelle tache
            </BtnPrimary>
          </div>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Projets" value={projets.length} icon="projets" />
        <StatTile label="Taches" value={resultat?.totalTaches ?? taches.length} hint={`${resultat?.terminees ?? 0} terminees`} icon="dashboard" />
        <StatTile label="Avancement global" value={pct(resultat?.avancementGlobal ?? 0)} icon="chart" />
        <StatTile label="Charge (realise / estime)" value={`${heures(resultat?.totalHeuresRealisees ?? 0)} / ${heures(resultat?.totalHeuresEstimees ?? 0)}`} icon="production" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_290px]">
        {/* Kanban des taches */}
        <div className="min-w-0">
          {/* Filtre par projet */}
          <div className="mb-3 flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">Projet :</span>
            <select
              className="rounded-lg border border-slate-300 px-2 py-1 text-sm text-slate-700 outline-none focus:border-brand-500"
              value={filtre}
              onChange={(e) => setFiltre(e.target.value)}
            >
              <option value="tous">Tous les projets</option>
              {projets.map((p) => (
                <option key={p.id} value={p.id}>{p.nom}</option>
              ))}
            </select>
          </div>

          {aucunProjet ? (
            <Card className="px-4 py-12 text-center text-sm text-slate-400">
              Aucun projet. Creez un projet, puis ajoutez des taches.
            </Card>
          ) : (
            <div className="grid grid-flow-col auto-cols-[minmax(220px,1fr)] gap-4 overflow-x-auto pb-2">
              {STATUT_ORDRE.map((statut) => {
                const cartes = tachesVisibles.filter((t) => t.statut === statut);
                const idxCol = STATUT_ORDRE.indexOf(statut);
                return (
                  <div key={statut} className="min-w-0">
                    <Card className={`border-t-2 ${COL_STYLE[statut]} p-3`}>
                      <div className="mb-3 flex items-baseline justify-between">
                        <div className="text-sm font-semibold text-slate-700">{libelleStatutTache(statut)}</div>
                        <div className="text-xs text-slate-400">{cartes.length}</div>
                      </div>

                      <div className="space-y-2">
                        {cartes.map((t) => (
                          <div key={t.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                            <div className="flex items-start justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => setEditionTache(t)}
                                className="text-left text-sm font-medium text-slate-800 hover:text-brand-700"
                              >
                                {t.titre}
                              </button>
                              <button
                                type="button"
                                onClick={() => supprimerTache(t.id)}
                                className="rounded p-0.5 text-slate-300 hover:text-red-600"
                                aria-label="Supprimer"
                              >
                                <Icon name="close" className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            {filtre === "tous" && (
                              <div className="mt-1 truncate text-xs text-slate-400">
                                {nomProjet.get(t.projetId) ?? "—"}
                              </div>
                            )}
                            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px]">
                              {t.assignee && (
                                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 font-medium text-slate-500">
                                  {t.assignee}
                                </span>
                              )}
                              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 font-medium text-slate-500">
                                {heures(t.heuresRealisees)} / {heures(t.heuresEstimees)}
                              </span>
                              {t.echeance && (
                                <span className="rounded-full bg-amber-50 px-1.5 py-0.5 font-medium text-amber-700">
                                  {dateCourte(t.echeance)}
                                </span>
                              )}
                            </div>
                            <div className="mt-2 flex justify-between">
                              <button
                                type="button"
                                disabled={idxCol <= 0}
                                onClick={() => deplacer(t.id, -1)}
                                className="rounded px-1.5 py-0.5 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
                                aria-label="Etat precedent"
                              >
                                ←
                              </button>
                              <button
                                type="button"
                                disabled={idxCol >= STATUT_ORDRE.length - 1}
                                onClick={() => deplacer(t.id, 1)}
                                className="rounded px-1.5 py-0.5 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
                                aria-label="Etat suivant"
                              >
                                →
                              </button>
                            </div>
                          </div>
                        ))}
                        {cartes.length === 0 && (
                          <div className="rounded-lg border border-dashed border-slate-200 py-6 text-center text-xs text-slate-300">
                            Vide
                          </div>
                        )}
                      </div>
                    </Card>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Avancement par projet (snapshot moteur) */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <Card className="p-5">
            <h3 className="mb-4 text-sm font-semibold text-slate-700">Avancement par projet</h3>
            {projets.length === 0 ? (
              <p className="text-sm text-slate-400">Aucun projet.</p>
            ) : (
              <div className="space-y-4">
                {projets.map((p) => {
                  const a = avancementParProjet.get(p.id);
                  const avancement = a?.avancement ?? 0;
                  return (
                    <div key={p.id}>
                      <div className="mb-1 flex items-start justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => setEditionProjet(p)}
                          className="text-left text-xs font-medium text-slate-700 hover:text-brand-700"
                        >
                          {p.nom}
                        </button>
                        <button
                          type="button"
                          onClick={() => supprimerProjet(p.id)}
                          className="shrink-0 rounded p-0.5 text-slate-300 hover:text-red-600"
                          aria-label="Supprimer le projet"
                        >
                          <Icon name="close" className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="mb-1 flex items-center justify-between text-[11px] text-slate-400">
                        <span>{libelleStatutProjet(p.statut)}</span>
                        <span>{a?.terminees ?? 0}/{a?.total ?? 0} · {pct(avancement)}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-brand-500"
                          style={{ width: `${Math.round(avancement * 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-500">
              Comptages, avancement et heures produits par le moteur (serveur).
            </p>
          </Card>
        </div>
      </div>

      {editionTache && (
        <TacheForm
          initial={editionTache}
          projets={projets}
          onClose={() => setEditionTache(null)}
          onSave={enregistrerTache}
        />
      )}
      {editionProjet && (
        <ProjetForm
          initial={editionProjet}
          onClose={() => setEditionProjet(null)}
          onSave={enregistrerProjet}
        />
      )}
    </div>
  );
}

function TacheForm({
  initial,
  projets,
  onClose,
  onSave,
}: {
  initial: TacheLocal;
  projets: ProjetLocal[];
  onClose: () => void;
  onSave: (t: TacheLocal) => void;
}) {
  const [t, setT] = useState<TacheLocal>(initial);
  const up = <K extends keyof TacheLocal>(k: K, v: TacheLocal[K]) =>
    setT((prev) => ({ ...prev, [k]: v }));

  return (
    <Modal
      titre={initial.id ? "Modifier la tache" : "Nouvelle tache"}
      onClose={onClose}
      footer={
        <>
          <BtnGhost onClick={onClose}>Annuler</BtnGhost>
          <BtnPrimary onClick={() => onSave(t)} disabled={!t.titre.trim() || !t.projetId}>
            Enregistrer
          </BtnPrimary>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Intitule *" className="sm:col-span-2">
          <Text value={t.titre} onChange={(v) => up("titre", v)} placeholder="Ex. Negocier le bail" />
        </Field>
        <Field label="Projet *">
          <select
            className={inputCls}
            value={t.projetId}
            onChange={(e) => up("projetId", e.target.value)}
          >
            <option value="">— Choisir —</option>
            {projets.map((p) => (
              <option key={p.id} value={p.id}>{p.nom}</option>
            ))}
          </select>
        </Field>
        <Field label="Etat">
          <select
            className={inputCls}
            value={t.statut}
            onChange={(e) => up("statut", e.target.value as StatutTache)}
          >
            {STATUTS_TACHE.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </Field>
        <Field label="Assigne a">
          <Text value={t.assignee ?? ""} onChange={(v) => up("assignee", v)} placeholder="Optionnel" />
        </Field>
        <Field label="Echeance">
          <input
            type="date"
            className={inputCls}
            value={t.echeance ?? ""}
            onChange={(e) => up("echeance", e.target.value)}
          />
        </Field>
        <Field label="Heures estimees">
          <Num value={t.heuresEstimees} suffix="h" step={0.5} onChange={(n) => up("heuresEstimees", n)} />
        </Field>
        <Field label="Heures realisees">
          <Num value={t.heuresRealisees} suffix="h" step={0.5} onChange={(n) => up("heuresRealisees", n)} />
        </Field>
      </div>
    </Modal>
  );
}

function ProjetForm({
  initial,
  onClose,
  onSave,
}: {
  initial: ProjetLocal;
  onClose: () => void;
  onSave: (p: ProjetLocal) => void;
}) {
  const [p, setP] = useState<ProjetLocal>(initial);
  const up = <K extends keyof ProjetLocal>(k: K, v: ProjetLocal[K]) =>
    setP((prev) => ({ ...prev, [k]: v }));

  return (
    <Modal
      titre={initial.id ? "Modifier le projet" : "Nouveau projet"}
      onClose={onClose}
      footer={
        <>
          <BtnGhost onClick={onClose}>Annuler</BtnGhost>
          <BtnPrimary onClick={() => onSave(p)} disabled={!p.nom.trim()}>
            Enregistrer
          </BtnPrimary>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom du projet *" className="sm:col-span-2">
          <Text value={p.nom} onChange={(v) => up("nom", v)} placeholder="Ex. Ouverture point de vente Thies" />
        </Field>
        <Field label="Client">
          <Text value={p.client ?? ""} onChange={(v) => up("client", v)} placeholder="Interne ou nom du client" />
        </Field>
        <Field label="Statut">
          <select
            className={inputCls}
            value={p.statut}
            onChange={(e) => up("statut", e.target.value as StatutProjet)}
          >
            {STATUTS_PROJET.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </Field>
        <Field label="Echeance">
          <input
            type="date"
            className={inputCls}
            value={p.echeance ?? ""}
            onChange={(e) => up("echeance", e.target.value)}
          />
        </Field>
      </div>
    </Modal>
  );
}
