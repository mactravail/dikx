"use client";

/**
 * Ecran TRESORERIE — le comptable suit OU se trouve l'argent (banques, caisses,
 * Wave, Orange Money...), COMBIEN chaque compte contient, et POURQUOI l'argent
 * est entre / sorti (categorie + motif de chaque mouvement).
 *
 * L'UI COLLECTE comptes et mouvements et affiche des soldes, mais ne les calcule
 * jamais : a chaque changement tout est envoye a la server action qui appelle le
 * MOTEUR teste (`calculerTresorerie`). Soldes courants, totaux et repartitions
 * affiches sont le SNAPSHOT du moteur, cote serveur. Sommer des mouvements EST
 * un calcul.
 */
import { useEffect, useRef, useState } from "react";
import { calculerTresorerieAction } from "../../app/(app)/tresorerie/actions";
import type {
  CompteTresorerieInput,
  MouvementTresorerieInput,
  ResultatTresorerie,
  TypeCompteTresorerie,
  SensMouvement,
} from "../../lib/engine";
import {
  store,
  TYPES_COMPTE,
  OPERATEURS,
  CATEGORIES_FLUX,
  libelleTypeCompte,
  libelleCategorieFlux,
  type CompteTresorerieLocal,
  type MouvementLocal,
} from "../../lib/tresorerie-data";
import { useEntreprise } from "../../lib/entreprise-context";
import { useSession } from "../../lib/session-context";
import { estEnvoye } from "../../lib/transmission";
import { rappelerAction } from "../../app/(app)/transmission/data-actions";
import { BadgeTransmission } from "../BadgeTransmission";
import { Card, PageHeading, StatTile } from "../ui";
import { Icon } from "../icons";
import { Field, Text, Num, Modal, BtnPrimary, BtnGhost, inputCls } from "../ventes/form";
import { fcfa, pct, dateCourte } from "../../lib/format";

const TYPE_LABEL: Record<TypeCompteTresorerie, string> = Object.fromEntries(
  TYPES_COMPTE,
) as Record<TypeCompteTresorerie, string>;

function compteToInput(c: CompteTresorerieLocal): CompteTresorerieInput {
  return { id: c.id, nom: c.nom, type: c.type, operateur: c.operateur, soldeInitial: c.soldeInitial };
}
function mouvementToInput(m: MouvementLocal): MouvementTresorerieInput {
  return { compteId: m.compteId, sens: m.sens, montant: m.montant, categorie: m.categorie };
}

function compteVide(): CompteTresorerieLocal {
  return { id: "", nom: "", type: "banque", operateur: "", soldeInitial: 0 };
}
function mouvementVide(compteId: string): MouvementLocal {
  return {
    id: "",
    compteId,
    date: new Date().toISOString().slice(0, 10),
    sens: "sortie",
    montant: 0,
    categorie: "fournisseurs",
    motif: "",
  };
}

export function TresorerieClient() {
  const { active } = useEntreprise();
  const { role } = useSession();
  const estEntreprise = role === "entreprise";
  const entrepriseId = active?.id ?? "";
  const [comptes, setComptes] = useState<CompteTresorerieLocal[]>([]);
  const [mouvements, setMouvements] = useState<MouvementLocal[]>([]);
  const [pret, setPret] = useState(false);
  const [resultat, setResultat] = useState<ResultatTresorerie | null>(null);
  const [editCompte, setEditCompte] = useState<CompteTresorerieLocal | null>(null);
  const [editMvt, setEditMvt] = useState<MouvementLocal | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Chargement des saisies de l'entreprise active (Supabase, RLS).
  useEffect(() => {
    let vivant = true;
    setPret(false);
    (async () => {
      if (!entrepriseId) {
        if (vivant) {
          setComptes([]);
          setMouvements([]);
          setPret(true);
        }
        return;
      }
      const [cs, ms] = await Promise.all([
        store.chargerComptes(entrepriseId),
        store.chargerMouvements(entrepriseId),
      ]);
      if (!vivant) return;
      setComptes(cs);
      setMouvements(ms);
      setPret(true);
    })();
    return () => {
      vivant = false;
    };
  }, [entrepriseId]);

  // Agregation par le moteur (server action), debounce leger. Aucune persistance
  // ici : c'est le SNAPSHOT d'affichage recalcule a partir des saisies courantes.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const r = await calculerTresorerieAction(
        comptes.map(compteToInput),
        mouvements.map(mouvementToInput),
      );
      if (r.ok) setResultat(r.resultat);
    }, 200);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [comptes, mouvements]);

  async function enregistrerCompte(c: CompteTresorerieLocal) {
    if (!c.nom.trim() || !entrepriseId) return;
    try {
      const saved = await store.enregistrerCompte(entrepriseId, c);
      setComptes((prev) => (c.id ? prev.map((x) => (x.id === c.id ? saved : x)) : [...prev, saved]));
      setEditCompte(null);
    } catch (e) {
      setErreur((e as Error).message);
    }
  }
  async function supprimerCompte(id: string) {
    try {
      await store.supprimerCompte(id);
      setComptes((prev) => prev.filter((c) => c.id !== id));
      // Les mouvements du compte sont supprimes en cascade cote base.
      setMouvements((prev) => prev.filter((m) => m.compteId !== id));
    } catch (e) {
      setErreur((e as Error).message);
    }
  }

  async function enregistrerMvt(m: MouvementLocal) {
    if (!m.compteId || m.montant <= 0 || !entrepriseId) return;
    try {
      const saved = await store.enregistrerMouvement(entrepriseId, m);
      setMouvements((prev) => (m.id ? prev.map((x) => (x.id === m.id ? saved : x)) : [saved, ...prev]));
      setEditMvt(null);
    } catch (e) {
      setErreur((e as Error).message);
    }
  }
  async function supprimerMvt(id: string) {
    try {
      await store.supprimerMouvement(id);
      setMouvements((prev) => prev.filter((m) => m.id !== id));
    } catch (e) {
      setErreur((e as Error).message);
    }
  }

  // Rappel : un mouvement deja envoye repasse en brouillon pour correction.
  async function rappelerMvt(id: string) {
    try {
      await rappelerAction("mouvements_tresorerie", id);
      setMouvements((prev) => prev.map((m) => (m.id === id ? { ...m, transmission: "brouillon" } : m)));
    } catch (e) {
      setErreur((e as Error).message);
    }
  }

  const soldeParCompte = new Map(resultat?.comptes.map((c) => [c.compteId, c]) ?? []);

  if (!entrepriseId) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeading titre="Tresorerie" sousTitre="Ou se trouve l'argent : banques, caisses, mobile money." />
        <Card className="px-4 py-12 text-center text-sm text-slate-500">
          Selectionnez d&apos;abord une entreprise pour saisir sa tresorerie.
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeading
        titre="Tresorerie"
        sousTitre="Ou se trouve l'argent (banques, caisses, mobile money), combien, et pourquoi il entre ou sort. Soldes calcules par le moteur."
        action={
          <div className="flex gap-2">
            <BtnGhost onClick={() => setEditCompte(compteVide())}>
              <Icon name="plus" className="h-4 w-4" /> Compte
            </BtnGhost>
            <BtnPrimary
              onClick={() => setEditMvt(mouvementVide(comptes[0]?.id ?? ""))}
            >
              <Icon name="plus" className="h-4 w-4" /> Mouvement
            </BtnPrimary>
          </div>
        }
      />

      {erreur && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {erreur}
        </div>
      )}
      {!pret && (
        <div className="mb-4 text-sm text-slate-400">Chargement des donnees…</div>
      )}

      {/* Indicateurs de tresorerie (snapshot moteur) */}
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Disponible total" value={fcfa(resultat?.totalDisponible ?? 0)} hint="Tous comptes" icon="tresorerie" />
        <StatTile label="Entrees" value={fcfa(resultat?.totalEntrees ?? 0)} hint="Encaissements" icon="chart" />
        <StatTile label="Sorties" value={fcfa(resultat?.totalSorties ?? 0)} hint="Decaissements" icon="charges" />
        <StatTile
          label="Flux net"
          value={fcfa(resultat?.fluxNet ?? 0)}
          hint={(resultat?.fluxNet ?? 0) >= 0 ? "Tresorerie en hausse" : "Tresorerie en baisse"}
          icon="comptabilite"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          {/* Rapport de tresorerie : un panorama par compte */}
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Rapport de tresorerie — par compte
            </h2>
            {comptes.length === 0 ? (
              <Card className="px-4 py-12 text-center text-sm text-slate-400">
                Aucun compte. Ajoutez une banque, une caisse ou un compte mobile money (Wave, Orange Money...).
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {comptes.map((c) => {
                  const s = soldeParCompte.get(c.id);
                  return (
                    <Card key={c.id} className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <TypeBadge type={c.type} />
                            {c.operateur && (
                              <span className="truncate text-[11px] text-slate-400">{c.operateur}</span>
                            )}
                          </div>
                          <div className="mt-1 truncate font-semibold text-slate-800">{c.nom}</div>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <button
                            type="button"
                            onClick={() => setEditCompte(c)}
                            className="rounded-lg px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50"
                          >
                            Editer
                          </button>
                          <button
                            type="button"
                            onClick={() => supprimerCompte(c.id)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600"
                            aria-label="Supprimer le compte"
                          >
                            <Icon name="close" className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <div className="mt-3 text-2xl font-semibold text-slate-900">
                        {fcfa(s?.soldeCourant ?? c.soldeInitial)}
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs">
                        <span className="text-emerald-600">↑ {fcfa(s?.totalEntrees ?? 0)}</span>
                        <span className="text-rose-600">↓ {fcfa(s?.totalSorties ?? 0)}</span>
                        <span className="text-slate-400">{s?.nbMouvements ?? 0} mvt</span>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          {/* Journal des mouvements */}
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Mouvements — qui, ou, pourquoi
            </h2>
            <MouvementsTable
              mouvements={mouvements}
              comptes={comptes}
              estEntreprise={estEntreprise}
              onOpen={setEditMvt}
              onDelete={supprimerMvt}
              onRappeler={rappelerMvt}
            />
          </section>
        </div>

        {/* Colonne synthese (snapshot moteur) */}
        <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <Card className="p-5">
            <h3 className="mb-4 text-sm font-semibold text-slate-700">Repartition du disponible</h3>
            {!resultat || resultat.parType.length === 0 ? (
              <p className="text-sm text-slate-400">Aucune donnee.</p>
            ) : (
              <div className="space-y-3">
                {resultat.parType.map((t) => (
                  <Barre
                    key={t.type}
                    label={libelleTypeCompte(t.type)}
                    part={t.part}
                    montant={t.soldeCourant}
                    couleur="bg-brand-500"
                  />
                ))}
              </div>
            )}
          </Card>

          <Card className="p-5">
            <h3 className="mb-1 text-sm font-semibold text-slate-700">Qu'a-t-on depense</h3>
            <p className="mb-4 text-[11px] text-slate-400">Sorties par categorie</p>
            {!resultat || resultat.sortiesParCategorie.length === 0 ? (
              <p className="text-sm text-slate-400">Aucune sortie enregistree.</p>
            ) : (
              <div className="space-y-3">
                {resultat.sortiesParCategorie.map((s) => (
                  <Barre
                    key={s.categorie}
                    label={libelleCategorieFlux(s.categorie)}
                    part={s.part}
                    montant={s.total}
                    couleur="bg-rose-500"
                  />
                ))}
              </div>
            )}
            <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-500">
              Soldes et totaux produits par le moteur (serveur), en FCFA entiers.
            </p>
          </Card>
        </div>
      </div>

      {editCompte && (
        <CompteForm
          initial={editCompte}
          onClose={() => setEditCompte(null)}
          onSave={enregistrerCompte}
        />
      )}
      {editMvt && (
        <MouvementForm
          initial={editMvt}
          comptes={comptes}
          onClose={() => setEditMvt(null)}
          onSave={enregistrerMvt}
        />
      )}
    </div>
  );
}

/* --------------------------------- pieces --------------------------------- */

function TypeBadge({ type }: { type: TypeCompteTresorerie }) {
  const couleur: Record<TypeCompteTresorerie, string> = {
    banque: "bg-brand-50 text-brand-700",
    mobile_money: "bg-violet-50 text-violet-700",
    caisse: "bg-amber-50 text-amber-700",
  };
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${couleur[type]}`}>
      {TYPE_LABEL[type]}
    </span>
  );
}

function Barre({
  label,
  part,
  montant,
  couleur,
}: {
  label: string;
  part: number;
  montant: number;
  couleur: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
        <span className="truncate text-slate-600">{label}</span>
        <span className="shrink-0 font-medium text-slate-500">{pct(part)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${couleur}`} style={{ width: `${Math.round(Math.max(0, Math.min(1, part)) * 100)}%` }} />
      </div>
      <div className="mt-0.5 text-right text-[11px] text-slate-400">{fcfa(montant)}</div>
    </div>
  );
}

function MouvementsTable({
  mouvements,
  comptes,
  estEntreprise,
  onOpen,
  onDelete,
  onRappeler,
}: {
  mouvements: MouvementLocal[];
  comptes: CompteTresorerieLocal[];
  estEntreprise: boolean;
  onOpen: (m: MouvementLocal) => void;
  onDelete: (id: string) => void;
  onRappeler: (id: string) => void;
}) {
  const nomCompte = (id: string) => comptes.find((c) => c.id === id)?.nom ?? "— compte supprime —";
  const tries = [...mouvements].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return (
    <Card className="overflow-hidden">
      {mouvements.length === 0 ? (
        <div className="px-4 py-12 text-center text-sm text-slate-400">
          Aucun mouvement. Notez un encaissement ou une depense.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Compte</th>
                <th className="px-4 py-2 font-medium">Motif</th>
                <th className="px-4 py-2 text-right font-medium">Montant</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {tries.map((m) => {
                const entree = m.sens === "entree";
                return (
                  <tr key={m.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                    <td className="px-4 py-2.5 whitespace-nowrap text-slate-600">{dateCourte(m.date)}</td>
                    <td className="px-4 py-2.5 text-slate-600">{nomCompte(m.compteId)}</td>
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-slate-800">{m.motif || libelleCategorieFlux(m.categorie)}</div>
                      <div className="text-xs text-slate-400">{libelleCategorieFlux(m.categorie)}</div>
                    </td>
                    <td className={`px-4 py-2.5 text-right font-semibold ${entree ? "text-emerald-600" : "text-rose-600"}`}>
                      {entree ? "+" : "−"}
                      {fcfa(m.montant)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {estEntreprise && <BadgeTransmission etat={m.transmission} />}
                        {estEntreprise && estEnvoye(m.transmission) ? (
                          <button
                            type="button"
                            onClick={() => onRappeler(m.id)}
                            className="rounded-lg px-2 py-1 text-xs font-medium text-amber-600 hover:bg-amber-50"
                            title="Repasser en brouillon pour corriger"
                          >
                            Rappeler
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => onOpen(m)}
                              className="rounded-lg px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50"
                            >
                              Ouvrir
                            </button>
                            <button
                              type="button"
                              onClick={() => onDelete(m.id)}
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
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/* ------------------------------- formulaires ------------------------------- */

function CompteForm({
  initial,
  onClose,
  onSave,
}: {
  initial: CompteTresorerieLocal;
  onClose: () => void;
  onSave: (c: CompteTresorerieLocal) => void;
}) {
  const [c, setC] = useState<CompteTresorerieLocal>(initial);
  const up = <K extends keyof CompteTresorerieLocal>(k: K, v: CompteTresorerieLocal[K]) =>
    setC((prev) => ({ ...prev, [k]: v }));
  return (
    <Modal
      titre={initial.id ? "Modifier le compte" : "Nouveau compte de tresorerie"}
      onClose={onClose}
      footer={
        <>
          <BtnGhost onClick={onClose}>Annuler</BtnGhost>
          <BtnPrimary onClick={() => onSave(c)} disabled={!c.nom.trim()}>
            Enregistrer
          </BtnPrimary>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom du compte *" className="sm:col-span-2">
          <Text value={c.nom} onChange={(v) => up("nom", v)} placeholder="Ex. Wave (caisse mobile)" />
        </Field>
        <Field label="Type">
          <select
            className={inputCls}
            value={c.type}
            onChange={(e) => up("type", e.target.value as TypeCompteTresorerie)}
          >
            {TYPES_COMPTE.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </Field>
        <Field label="Operateur / etablissement">
          <input
            className={inputCls}
            list="operateurs-tresorerie"
            value={c.operateur ?? ""}
            onChange={(e) => up("operateur", e.target.value)}
            placeholder="Wave, Orange Money, CBAO..."
          />
          <datalist id="operateurs-tresorerie">
            {OPERATEURS.map((o) => (
              <option key={o} value={o} />
            ))}
          </datalist>
        </Field>
        <Field label="Solde initial" className="sm:col-span-2">
          <Num value={c.soldeInitial} suffix="FCFA" onChange={(n) => up("soldeInitial", n)} />
        </Field>
      </div>
      <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-500">
        Le solde courant est recalcule par le moteur a partir du solde initial et des mouvements.
      </p>
    </Modal>
  );
}

function MouvementForm({
  initial,
  comptes,
  onClose,
  onSave,
}: {
  initial: MouvementLocal;
  comptes: CompteTresorerieLocal[];
  onClose: () => void;
  onSave: (m: MouvementLocal) => void;
}) {
  const [m, setM] = useState<MouvementLocal>(initial);
  const up = <K extends keyof MouvementLocal>(k: K, v: MouvementLocal[K]) =>
    setM((prev) => ({ ...prev, [k]: v }));
  const valide = !!m.compteId && m.montant > 0;
  return (
    <Modal
      titre={initial.id ? "Modifier le mouvement" : "Nouveau mouvement"}
      onClose={onClose}
      footer={
        <>
          <BtnGhost onClick={onClose}>Annuler</BtnGhost>
          <BtnPrimary onClick={() => onSave(m)} disabled={!valide}>
            Enregistrer
          </BtnPrimary>
        </>
      }
    >
      {comptes.length === 0 ? (
        <p className="text-sm text-slate-500">
          Creez d'abord un compte de tresorerie (banque, caisse ou mobile money).
        </p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Compte">
              <select
                className={inputCls}
                value={m.compteId}
                onChange={(e) => up("compteId", e.target.value)}
              >
                {comptes.map((c) => (
                  <option key={c.id} value={c.id}>{c.nom}</option>
                ))}
              </select>
            </Field>
            <Field label="Sens">
              <select
                className={inputCls}
                value={m.sens}
                onChange={(e) => up("sens", e.target.value as SensMouvement)}
              >
                <option value="entree">Entree (encaissement)</option>
                <option value="sortie">Sortie (depense)</option>
              </select>
            </Field>
            <Field label="Categorie (pourquoi)">
              <select
                className={inputCls}
                value={m.categorie}
                onChange={(e) => up("categorie", e.target.value)}
              >
                {CATEGORIES_FLUX.map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </Field>
            <Field label="Date">
              <input
                type="date"
                className={inputCls}
                value={m.date}
                onChange={(e) => up("date", e.target.value)}
              />
            </Field>
            <Field label="Montant">
              <Num value={m.montant} suffix="FCFA" onChange={(n) => up("montant", n)} />
            </Field>
            <Field label="Motif / beneficiaire" className="sm:col-span-2">
              <Text
                value={m.motif}
                onChange={(v) => up("motif", v)}
                placeholder="Ex. Reglement fournisseur SENELEC, virement salaire..."
              />
            </Field>
          </div>
          <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-500">
            Notez ou est passe l'argent et pourquoi. L'impact sur le solde est calcule par le moteur.
          </p>
        </>
      )}
    </Modal>
  );
}
