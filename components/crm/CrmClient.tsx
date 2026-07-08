"use client";

/**
 * Ecran VENTES & CRM — pipeline commercial (kanban).
 *
 * Les opportunites sont saisies ici, mais TOUTE agregation monetaire (totaux
 * par etape, prevision ponderee) vient de la server action -> moteur teste.
 * L'UI ne somme aucun montant elle-meme.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { calculerPipelineAction } from "../../app/(app)/crm/actions";
import type { ResultatPipeline } from "../../lib/engine";
import {
  store,
  genId,
  ETAPES_PIPELINE,
  PROBA_PAR_ETAPE,
  type ClientLocal,
  type OpportuniteLocal,
} from "../../lib/ventes-data";
import { Card, PageHeading, StatTile } from "../ui";
import { Icon } from "../icons";
import { Field, Text, Num, Modal, BtnPrimary, BtnGhost, inputCls } from "../ventes/form";
import { fcfa, fcfaCompact, pct } from "../../lib/format";

const ETAPES: string[] = [...ETAPES_PIPELINE];

const COL_STYLE: Record<string, string> = {
  Prospection: "border-t-slate-300",
  Qualification: "border-t-blue-300",
  Proposition: "border-t-indigo-300",
  Negociation: "border-t-amber-300",
  Gagne: "border-t-emerald-400",
  Perdu: "border-t-red-300",
};

function oppVide(): OpportuniteLocal {
  return {
    id: "",
    titre: "",
    clientNom: "",
    etape: "Prospection",
    montant: 0,
    probabilite: PROBA_PAR_ETAPE["Prospection"] ?? 0.1,
  };
}

export function CrmClient() {
  const [opps, setOpps] = useState<OpportuniteLocal[]>([]);
  const [clients, setClients] = useState<ClientLocal[]>([]);
  const [pret, setPret] = useState(false);
  const [pipeline, setPipeline] = useState<ResultatPipeline | null>(null);
  const [edition, setEdition] = useState<OpportuniteLocal | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setOpps(store.chargerOpportunites());
    setClients(store.chargerClients());
    setPret(true);
  }, []);

  useEffect(() => {
    if (pret) store.sauverOpportunites(opps);
  }, [opps, pret]);

  // Agregation du pipeline par le moteur (server action), debounce leger.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const r = await calculerPipelineAction(
        opps.map((o) => ({ etape: o.etape, montant: o.montant, probabilite: o.probabilite })),
        ETAPES,
      );
      if (r.ok) setPipeline(r.pipeline);
    }, 200);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [opps]);

  const totauxEtape = useMemo(() => {
    const m = new Map<string, { total: number; nombre: number }>();
    for (const e of pipeline?.parEtape ?? []) m.set(e.etape, { total: e.total, nombre: e.nombre });
    return m;
  }, [pipeline]);

  function enregistrer(o: OpportuniteLocal) {
    if (!o.titre.trim()) return;
    setOpps((prev) => {
      if (o.id) return prev.map((x) => (x.id === o.id ? o : x));
      return [...prev, { ...o, id: genId() }];
    });
    setEdition(null);
  }

  function supprimer(id: string) {
    setOpps((prev) => prev.filter((o) => o.id !== id));
  }

  function deplacer(id: string, direction: -1 | 1) {
    setOpps((prev) =>
      prev.map((o) => {
        if (o.id !== id) return o;
        const idx = ETAPES.indexOf(o.etape);
        const nouvel = Math.min(ETAPES.length - 1, Math.max(0, idx + direction));
        const etape = ETAPES[nouvel] ?? o.etape;
        // La proba par defaut suit l'etape (l'utilisateur peut l'ajuster ensuite).
        return { ...o, etape, probabilite: PROBA_PAR_ETAPE[etape] ?? o.probabilite };
      }),
    );
  }

  // Affaires ouvertes = hors Gagne / Perdu.
  const ouvertes = (pipeline?.parEtape ?? []).filter((e) => e.etape !== "Gagne" && e.etape !== "Perdu");
  const totalOuvert = ouvertes.reduce((s, e) => s + e.total, 0);
  const gagne = totauxEtape.get("Gagne")?.total ?? 0;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeading
        titre="Ventes & CRM"
        sousTitre="Pipeline commercial : opportunites, etapes et prevision ponderee."
        action={
          <BtnPrimary onClick={() => setEdition(oppVide())}>
            <Icon name="plus" className="h-4 w-4" /> Nouvelle opportunite
          </BtnPrimary>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Opportunites" value={pipeline?.nombre ?? opps.length} icon="crm" />
        <StatTile label="Pipeline ouvert" value={fcfa(totalOuvert)} hint="Hors gagne / perdu" icon="chart" />
        <StatTile label="Prevision ponderee" value={fcfa(pipeline?.totalPondere ?? 0)} hint="Σ montant × probabilite" icon="charges" />
        <StatTile label="Gagne" value={fcfa(gagne)} icon="invoice" />
      </div>

      <div className="grid grid-flow-col auto-cols-[minmax(230px,1fr)] gap-4 overflow-x-auto pb-2">
        {ETAPES.map((etape) => {
          const cartes = opps.filter((o) => o.etape === etape);
          const t = totauxEtape.get(etape);
          return (
            <div key={etape} className="min-w-0">
              <Card className={`border-t-2 ${COL_STYLE[etape] ?? "border-t-slate-300"} p-3`}>
                <div className="mb-3 flex items-baseline justify-between">
                  <div className="text-sm font-semibold text-slate-700">{etape}</div>
                  <div className="text-xs text-slate-400">{t?.nombre ?? cartes.length}</div>
                </div>
                <div className="mb-3 text-xs font-medium text-slate-500">{fcfaCompact(t?.total ?? 0)} FCFA</div>

                <div className="space-y-2">
                  {cartes.map((o) => {
                    const idx = ETAPES.indexOf(o.etape);
                    return (
                      <div key={o.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                        <div className="flex items-start justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => setEdition(o)}
                            className="text-left text-sm font-medium text-slate-800 hover:text-brand-700"
                          >
                            {o.titre}
                          </button>
                          <button
                            type="button"
                            onClick={() => supprimer(o.id)}
                            className="rounded p-0.5 text-slate-300 hover:text-red-600"
                            aria-label="Supprimer"
                          >
                            <Icon name="close" className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        {o.clientNom && <div className="mt-0.5 text-xs text-slate-400">{o.clientNom}</div>}
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-sm font-semibold text-slate-700">{fcfaCompact(o.montant)}</span>
                          <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                            {pct(o.probabilite)}
                          </span>
                        </div>
                        <div className="mt-2 flex justify-between">
                          <button
                            type="button"
                            disabled={idx <= 0}
                            onClick={() => deplacer(o.id, -1)}
                            className="rounded px-1.5 py-0.5 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
                            aria-label="Etape precedente"
                          >
                            ←
                          </button>
                          <button
                            type="button"
                            disabled={idx >= ETAPES.length - 1}
                            onClick={() => deplacer(o.id, 1)}
                            className="rounded px-1.5 py-0.5 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
                            aria-label="Etape suivante"
                          >
                            →
                          </button>
                        </div>
                      </div>
                    );
                  })}
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

      {edition && (
        <OpportuniteForm
          initial={edition}
          clients={clients}
          onClose={() => setEdition(null)}
          onSave={enregistrer}
        />
      )}
    </div>
  );
}

function OpportuniteForm({
  initial,
  clients,
  onClose,
  onSave,
}: {
  initial: OpportuniteLocal;
  clients: ClientLocal[];
  onClose: () => void;
  onSave: (o: OpportuniteLocal) => void;
}) {
  const [o, setO] = useState<OpportuniteLocal>(initial);
  const up = <K extends keyof OpportuniteLocal>(k: K, v: OpportuniteLocal[K]) =>
    setO((prev) => ({ ...prev, [k]: v }));

  const clientsActifs = clients.filter((c) => c.actif);

  return (
    <Modal
      titre={initial.id ? "Modifier l'opportunite" : "Nouvelle opportunite"}
      onClose={onClose}
      footer={
        <>
          <BtnGhost onClick={onClose}>Annuler</BtnGhost>
          <BtnPrimary onClick={() => onSave(o)} disabled={!o.titre.trim()}>
            Enregistrer
          </BtnPrimary>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Intitule *" className="sm:col-span-2">
          <Text value={o.titre} onChange={(v) => up("titre", v)} placeholder="Ex. Contrat annuel farine" />
        </Field>
        <Field label="Client" className="sm:col-span-2">
          {clientsActifs.length > 0 ? (
            <select
              className={inputCls}
              value={o.clientNom}
              onChange={(e) => up("clientNom", e.target.value)}
            >
              <option value="">— Aucun —</option>
              {clientsActifs.map((c) => (
                <option key={c.id} value={c.raisonSociale}>{c.raisonSociale}</option>
              ))}
            </select>
          ) : (
            <Text value={o.clientNom} onChange={(v) => up("clientNom", v)} placeholder="Nom du client" />
          )}
        </Field>
        <Field label="Etape">
          <select
            className={inputCls}
            value={o.etape}
            onChange={(e) => {
              const etape = e.target.value;
              setO((prev) => ({ ...prev, etape, probabilite: PROBA_PAR_ETAPE[etape] ?? prev.probabilite }));
            }}
          >
            {ETAPES.map((et) => (
              <option key={et} value={et}>{et}</option>
            ))}
          </select>
        </Field>
        <Field label="Montant estime">
          <Num value={o.montant} suffix="FCFA" onChange={(n) => up("montant", n)} />
        </Field>
        <Field label="Probabilite">
          <Num value={Math.round(o.probabilite * 100)} suffix="%" onChange={(n) => up("probabilite", Math.min(100, n) / 100)} />
        </Field>
      </div>
    </Modal>
  );
}
