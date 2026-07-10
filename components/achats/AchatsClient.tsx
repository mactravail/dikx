"use client";

/**
 * Ecran ACHATS — commandes d'achat, receptions et encours fournisseurs.
 *
 * L'UI COLLECTE les commandes (fournisseur, lignes, receptions, reglement) ;
 * TOUS les montants (HT, TVA deductible, TTC, reste a payer, valeur a recevoir,
 * encours) viennent de la server action -> moteur teste (`calculerAchats`). Le
 * navigateur ne calcule aucun total. Etat persiste dans Supabase (RLS, par entreprise).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { calculerAchatsAction } from "../../app/(app)/achats/actions";
import type { CommandeAchatInput, ResultatAchats } from "../../lib/engine";
import {
  store,
  genId,
  STATUTS_COMMANDE,
  libelleStatutCommande,
  type CommandeLocal,
  type LigneCommandeLocal,
  type FournisseurLocal,
} from "../../lib/achats-stock-data";
import type { StatutCommande } from "../../lib/engine";
import { useEntreprise } from "../../lib/entreprise-context";
import { Card, PageHeading, StatTile } from "../ui";
import { Icon } from "../icons";
import { Field, Text, Num, Modal, BtnPrimary, BtnGhost, inputCls } from "../ventes/form";
import { fcfa, pct, dateCourte } from "../../lib/format";

function toInput(c: CommandeLocal): CommandeAchatInput {
  return {
    fournisseur: c.fournisseur,
    statut: c.statut,
    assujettiTVA: c.assujettiTVA,
    montantPaye: c.montantPaye,
    lignes: c.lignes.map((l) => ({
      designation: l.designation,
      quantite: l.quantite,
      quantiteRecue: l.quantiteRecue,
      prixUnitaireHT: l.prixUnitaireHT,
    })),
  };
}

const STATUT_STYLE: Record<StatutCommande, string> = {
  brouillon: "bg-slate-100 text-slate-600",
  envoyee: "bg-blue-50 text-blue-700",
  recue_partiel: "bg-amber-50 text-amber-700",
  recue: "bg-emerald-50 text-emerald-700",
  annulee: "bg-red-50 text-red-700",
};

function numeroSuivant(commandes: CommandeLocal[]): string {
  const annee = new Date().getFullYear();
  const n = commandes.length + 1;
  return `CA-${annee}-${String(n).padStart(3, "0")}`;
}

function ligneVide(): LigneCommandeLocal {
  return { id: genId(), designation: "", quantite: 1, quantiteRecue: 0, prixUnitaireHT: 0 };
}

function commandeVide(commandes: CommandeLocal[]): CommandeLocal {
  return {
    id: "",
    numero: numeroSuivant(commandes),
    fournisseur: "",
    date: new Date().toISOString().slice(0, 10),
    statut: "brouillon",
    assujettiTVA: true,
    montantPaye: 0,
    lignes: [ligneVide()],
    totalTTC: 0,
    resteAPayer: 0,
  };
}

export function AchatsClient() {
  const { active } = useEntreprise();
  const entrepriseId = active?.id ?? "";
  const [commandes, setCommandes] = useState<CommandeLocal[]>([]);
  const [fournisseurs, setFournisseurs] = useState<FournisseurLocal[]>([]);
  const [pret, setPret] = useState(false);
  const [resultat, setResultat] = useState<ResultatAchats | null>(null);
  const [edition, setEdition] = useState<CommandeLocal | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Chargement des commandes + fournisseurs de l'entreprise active (Supabase, RLS).
  useEffect(() => {
    let vivant = true;
    setPret(false);
    (async () => {
      const [cmds, fours] = entrepriseId
        ? await Promise.all([store.chargerCommandes(entrepriseId), store.chargerFournisseurs(entrepriseId)])
        : [[], []];
      if (!vivant) return;
      setCommandes(cmds);
      setFournisseurs(fours);
      setPret(true);
    })();
    return () => {
      vivant = false;
    };
  }, [entrepriseId]);

  // Agregation des achats par le moteur (server action), debounce leger.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const r = await calculerAchatsAction(commandes.map(toInput));
      if (r.ok) setResultat(r.resultat);
    }, 200);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [commandes]);

  const snapParIndex = resultat?.commandes ?? [];

  async function enregistrer(c: CommandeLocal) {
    if (!c.fournisseur.trim() || !entrepriseId) return;
    try {
      // Le snapshot des totaux est calcule par le moteur cote serveur (data-action).
      const saved = await store.enregistrerCommande(entrepriseId, c);
      setCommandes((prev) => (c.id ? prev.map((x) => (x.id === c.id ? saved : x)) : [saved, ...prev]));
      setEdition(null);
    } catch (e) {
      setErreur((e as Error).message);
    }
  }

  async function supprimer(id: string) {
    try {
      await store.supprimerCommande(id);
      setCommandes((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      setErreur((e as Error).message);
    }
  }

  if (!entrepriseId) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeading titre="Achats" sousTitre="Commandes d'achat, receptions et encours fournisseurs." />
        <Card className="px-4 py-12 text-center text-sm text-slate-500">
          Selectionnez d&apos;abord une entreprise pour gerer ses achats.
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeading
        titre="Achats"
        sousTitre="Commandes d'achat, receptions et encours fournisseurs, calcules par le moteur."
        action={
          <BtnPrimary onClick={() => setEdition(commandeVide(commandes))}>
            <Icon name="plus" className="h-4 w-4" /> Nouvelle commande
          </BtnPrimary>
        }
      />

      {erreur && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</div>
      )}
      {!pret && <div className="mb-4 text-sm text-slate-400">Chargement des donnees…</div>}

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Commandes" value={commandes.length} icon="achats" />
        <StatTile label="Total achats" value={fcfa(resultat?.totalTTC ?? 0)} hint="TTC, hors annulees" icon="charges" />
        <StatTile label="A payer" value={fcfa(resultat?.totalAPayer ?? 0)} hint="Encours fournisseurs" icon="invoice" />
        <StatTile label="A recevoir" value={fcfa(resultat?.totalARecevoirHT ?? 0)} hint="Valeur HT non livree" icon="fournisseurs" />
      </div>

      <Card className="overflow-hidden">
        {commandes.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-slate-400">
            Aucune commande d'achat. Creez votre premiere commande.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2 font-medium">Commande</th>
                  <th className="px-4 py-2 font-medium">Fournisseur</th>
                  <th className="px-4 py-2 font-medium">Statut</th>
                  <th className="px-4 py-2 text-right font-medium">Reception</th>
                  <th className="px-4 py-2 text-right font-medium">Total TTC</th>
                  <th className="px-4 py-2 text-right font-medium">Reste a payer</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {commandes.map((c, i) => {
                  const snap = snapParIndex[i];
                  return (
                    <tr key={c.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                      <td className="px-4 py-2.5">
                        <button
                          type="button"
                          onClick={() => setEdition(c)}
                          className="text-left font-medium text-slate-800 hover:text-brand-700"
                        >
                          {c.numero}
                        </button>
                        <div className="text-xs text-slate-400">{dateCourte(c.date)}</div>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">{c.fournisseur || "—"}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUT_STYLE[c.statut]}`}>
                          {libelleStatutCommande(c.statut)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-600">{pct(snap?.tauxReception ?? 0)}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-slate-800">{fcfa(snap?.totalTTC ?? c.totalTTC)}</td>
                      <td className="px-4 py-2.5 text-right text-slate-700">{fcfa(snap?.resteAPayer ?? c.resteAPayer)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setEdition(c)}
                            className="rounded-lg px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50"
                          >
                            Ouvrir
                          </button>
                          <button
                            type="button"
                            onClick={() => supprimer(c.id)}
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

      {edition && (
        <CommandeForm
          initial={edition}
          fournisseurs={fournisseurs}
          onClose={() => setEdition(null)}
          onSave={enregistrer}
        />
      )}
    </div>
  );
}

function CommandeForm({
  initial,
  fournisseurs,
  onClose,
  onSave,
}: {
  initial: CommandeLocal;
  fournisseurs: FournisseurLocal[];
  onClose: () => void;
  onSave: (c: CommandeLocal) => void;
}) {
  const [c, setC] = useState<CommandeLocal>(initial);
  const [apercu, setApercu] = useState<ResultatAchats["commandes"][number] | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const up = <K extends keyof CommandeLocal>(k: K, v: CommandeLocal[K]) =>
    setC((prev) => ({ ...prev, [k]: v }));

  // Apercu des totaux par le moteur (jamais calcules ici), debounce leger.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const r = await calculerAchatsAction([toInput(c)]);
      if (r.ok) setApercu(r.resultat.commandes[0] ?? null);
    }, 200);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [c]);

  function majLigne(id: string, patch: Partial<LigneCommandeLocal>) {
    setC((prev) => ({
      ...prev,
      lignes: prev.lignes.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    }));
  }
  function ajouterLigne() {
    setC((prev) => ({ ...prev, lignes: [...prev.lignes, ligneVide()] }));
  }
  function supprimerLigne(id: string) {
    setC((prev) => ({ ...prev, lignes: prev.lignes.filter((l) => l.id !== id) }));
  }

  return (
    <Modal
      titre={initial.id ? `Commande ${initial.numero}` : "Nouvelle commande d'achat"}
      onClose={onClose}
      footer={
        <>
          <BtnGhost onClick={onClose}>Annuler</BtnGhost>
          <BtnPrimary onClick={() => onSave(c)} disabled={!c.fournisseur.trim()}>
            Enregistrer
          </BtnPrimary>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Fournisseur *">
          {fournisseurs.length > 0 ? (
            <select
              className={inputCls}
              value={c.fournisseur}
              onChange={(e) => up("fournisseur", e.target.value)}
            >
              <option value="">— Choisir —</option>
              {fournisseurs.map((f) => (
                <option key={f.id} value={f.nom}>{f.nom}</option>
              ))}
            </select>
          ) : (
            <Text value={c.fournisseur} onChange={(v) => up("fournisseur", v)} placeholder="Nom du fournisseur" />
          )}
        </Field>
        <Field label="Date">
          <input type="date" className={inputCls} value={c.date} onChange={(e) => up("date", e.target.value)} />
        </Field>
        <Field label="Statut">
          <select
            className={inputCls}
            value={c.statut}
            onChange={(e) => up("statut", e.target.value as StatutCommande)}
          >
            {STATUTS_COMMANDE.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </Field>
        <Field label="Montant deja regle">
          <Num value={c.montantPaye} suffix="FCFA" onChange={(n) => up("montantPaye", n)} />
        </Field>
      </div>

      <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={c.assujettiTVA}
          onChange={(e) => up("assujettiTVA", e.target.checked)}
        />
        Assujettie a la TVA (18 %)
      </label>

      {/* Lignes de commande */}
      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Lignes</h4>
          <button
            type="button"
            onClick={ajouterLigne}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50"
          >
            <Icon name="plus" className="h-3.5 w-3.5" /> Ligne
          </button>
        </div>
        <div className="space-y-2">
          {c.lignes.map((l) => (
            <div key={l.id} className="rounded-lg border border-slate-200 p-2.5">
              <div className="grid gap-2 sm:grid-cols-12">
                <div className="sm:col-span-5">
                  <input
                    className={inputCls}
                    value={l.designation}
                    placeholder="Designation"
                    onChange={(e) => majLigne(l.id, { designation: e.target.value })}
                  />
                </div>
                <div className="sm:col-span-2">
                  <input
                    type="number"
                    className={inputCls}
                    value={l.quantite}
                    min={0}
                    placeholder="Qte"
                    onChange={(e) => majLigne(l.id, { quantite: Number(e.target.value) || 0 })}
                  />
                </div>
                <div className="sm:col-span-2">
                  <input
                    type="number"
                    className={inputCls}
                    value={l.quantiteRecue}
                    min={0}
                    placeholder="Recu"
                    onChange={(e) => majLigne(l.id, { quantiteRecue: Number(e.target.value) || 0 })}
                  />
                </div>
                <div className="sm:col-span-3 flex items-center gap-1">
                  <input
                    type="number"
                    className={inputCls}
                    value={l.prixUnitaireHT}
                    min={0}
                    placeholder="PU HT"
                    onChange={(e) => majLigne(l.id, { prixUnitaireHT: Number(e.target.value) || 0 })}
                  />
                  <button
                    type="button"
                    onClick={() => supprimerLigne(l.id)}
                    className="shrink-0 rounded p-1 text-slate-300 hover:text-red-600"
                    aria-label="Supprimer la ligne"
                  >
                    <Icon name="close" className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-12 px-1 text-[10px] uppercase tracking-wide text-slate-400">
          <span className="col-span-5">Designation</span>
          <span className="col-span-2">Qte cmd</span>
          <span className="col-span-2">Qte recue</span>
          <span className="col-span-3">PU HT</span>
        </div>
      </div>

      {/* Apercu des totaux (snapshot moteur) */}
      <dl className="mt-4 space-y-1.5 rounded-lg bg-slate-50 px-4 py-3 text-sm">
        <TotLigne label="Total HT" value={fcfa(apercu?.totalHT ?? 0)} />
        <TotLigne label="TVA deductible" value={fcfa(apercu?.totalTVA ?? 0)} />
        <TotLigne label="Total TTC" value={fcfa(apercu?.totalTTC ?? 0)} fort />
        <TotLigne label="Reste a payer" value={fcfa(apercu?.resteAPayer ?? 0)} />
        <TotLigne label="Reception" value={pct(apercu?.tauxReception ?? 0)} />
      </dl>
      <p className="mt-2 text-[11px] text-slate-400">
        Totaux calcules par le moteur (serveur). Le taux de TVA vient des parametres.
      </p>
    </Modal>
  );
}

function TotLigne({ label, value, fort }: { label: string; value: string; fort?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className={fort ? "font-medium text-slate-700" : "text-slate-500"}>{label}</dt>
      <dd className={fort ? "font-semibold text-slate-800" : "text-slate-600"}>{value}</dd>
    </div>
  );
}
