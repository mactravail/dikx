"use client";

/**
 * Ecran RESSOURCES HUMAINES — registre du personnel et paie mensuelle.
 *
 * L'UI COLLECTE les employes et leurs elements de paie (brut, primes, retenues)
 * mais ne calcule jamais un montant : a chaque changement la liste est envoyee a
 * la server action qui appelle le MOTEUR teste (`calculerPaie`). Les cotisations,
 * le net a payer, le cout employeur et la masse salariale affiches sont le
 * SNAPSHOT du moteur, cote serveur. Les taux (salarial / patronal) vivent dans
 * les PARAMETRES (« a valider par un expert paie SN »).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { calculerPaieAction } from "../../app/(app)/rh/actions";
import type { BulletinInput, ResultatPaie } from "../../lib/engine";
import {
  store,
  TYPES_CONTRAT,
  libelleContrat,
  type EmployeLocal,
  type TypeContrat,
} from "../../lib/organisation-data";
import { useEntreprise } from "../../lib/entreprise-context";
import { useSession } from "../../lib/session-context";
import { estEnvoye } from "../../lib/transmission";
import { rappelerAction } from "../../app/(app)/transmission/data-actions";
import { BadgeTransmission } from "../BadgeTransmission";
import { Card, PageHeading, StatTile } from "../ui";
import { Icon } from "../icons";
import { Field, Text, Num, Modal, BtnPrimary, BtnGhost, inputCls } from "../ventes/form";
import { fcfa, pct, dateCourte } from "../../lib/format";

function toBulletin(e: EmployeLocal): BulletinInput {
  return {
    salaireBrutMensuel: e.salaireBrutMensuel,
    primes: e.primes,
    autresRetenues: e.autresRetenues,
  };
}

function employeVide(): EmployeLocal {
  return {
    id: "",
    nom: "",
    poste: "",
    typeContrat: "CDI",
    dateEmbauche: new Date().toISOString().slice(0, 10),
    telephone: "",
    actif: true,
    salaireBrutMensuel: 0,
    primes: 0,
    autresRetenues: 0,
    netAPayer: 0,
    coutEmployeur: 0,
  };
}

export function RhClient() {
  const { active } = useEntreprise();
  const { role } = useSession();
  const estEntreprise = role === "entreprise";
  const entrepriseId = active?.id ?? "";
  const [employes, setEmployes] = useState<EmployeLocal[]>([]);
  const [pret, setPret] = useState(false);
  const [resultat, setResultat] = useState<ResultatPaie | null>(null);
  const [edition, setEdition] = useState<EmployeLocal | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Chargement des employes de l'entreprise active (Supabase, RLS).
  useEffect(() => {
    let vivant = true;
    setPret(false);
    (async () => {
      const liste = entrepriseId ? await store.chargerEmployes(entrepriseId) : [];
      if (!vivant) return;
      setEmployes(liste);
      setPret(true);
    })();
    return () => {
      vivant = false;
    };
  }, [entrepriseId]);

  // Seuls les employes actifs entrent dans la paie du mois.
  const actifs = useMemo(() => employes.filter((e) => e.actif), [employes]);

  // Agregation d'affichage de la paie par le moteur (server action), debounce.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const r = await calculerPaieAction(actifs.map(toBulletin));
      if (r.ok) setResultat(r.resultat);
    }, 200);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [actifs]);

  async function enregistrer(e: EmployeLocal) {
    if (!e.nom.trim() || !entrepriseId) return;
    try {
      // Snapshot net/cout = moteur cote serveur (data-action).
      const saved = await store.enregistrerEmploye(entrepriseId, e);
      setEmployes((prev) => (e.id ? prev.map((x) => (x.id === e.id ? saved : x)) : [saved, ...prev]));
      setEdition(null);
    } catch (err) {
      setErreur((err as Error).message);
    }
  }

  async function supprimer(id: string) {
    try {
      await store.supprimerEmploye(id);
      setEmployes((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      setErreur((err as Error).message);
    }
  }

  // Rappel : un employe deja envoye repasse en brouillon pour correction.
  async function rappeler(id: string) {
    try {
      await rappelerAction("employes", id);
      setEmployes((prev) => prev.map((e) => (e.id === id ? { ...e, transmission: "brouillon" } : e)));
    } catch (err) {
      setErreur((err as Error).message);
    }
  }

  if (!entrepriseId) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeading titre="Ressources humaines" sousTitre="Registre du personnel et paie." />
        <Card className="px-4 py-12 text-center text-sm text-slate-500">
          Selectionnez d&apos;abord une entreprise pour gerer ses employes.
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeading
        titre="Ressources humaines"
        sousTitre="Registre du personnel et paie. Cotisations, net a payer et masse salariale calcules par le moteur."
        action={
          <BtnPrimary onClick={() => setEdition(employeVide())}>
            <Icon name="plus" className="h-4 w-4" /> Nouvel employe
          </BtnPrimary>
        }
      />

      {erreur && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</div>
      )}
      {!pret && <div className="mb-4 text-sm text-slate-400">Chargement des donnees…</div>}

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Effectif actif" value={actifs.length} hint={`${employes.length} au total`} icon="rh" />
        <StatTile label="Masse salariale chargee" value={fcfa(resultat?.totalCoutEmployeur ?? 0)} hint="Cout employeur mensuel" icon="charges" />
        <StatTile label="Net a payer" value={fcfa(resultat?.totalNetAPayer ?? 0)} hint="Total verse aux employes" icon="invoice" />
        <StatTile label="Charges patronales" value={fcfa(resultat?.totalCotisationsPatronales ?? 0)} hint="Part employeur" icon="comptabilite" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        {/* Registre du personnel */}
        <Card className="overflow-hidden">
          {employes.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-slate-400">
              Aucun employe. Ajoutez votre premiere fiche.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-2 font-medium">Employe</th>
                    <th className="px-4 py-2 font-medium">Contrat</th>
                    <th className="px-4 py-2 text-right font-medium">Brut</th>
                    <th className="px-4 py-2 text-right font-medium">Net a payer</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {employes.map((e) => (
                    <tr key={e.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-800">{e.nom}</span>
                          {!e.actif && (
                            <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
                              Inactif
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400">
                          {e.poste || "—"}
                          {e.dateEmbauche ? ` · depuis ${dateCourte(e.dateEmbauche)}` : ""}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                          {libelleContrat(e.typeContrat)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-600">
                        {fcfa(e.salaireBrutMensuel + e.primes)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium text-slate-800">{fcfa(e.netAPayer)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {estEntreprise && <BadgeTransmission etat={e.transmission} />}
                          {estEntreprise && estEnvoye(e.transmission) ? (
                            <button
                              type="button"
                              onClick={() => rappeler(e.id)}
                              className="rounded-lg px-2 py-1 text-xs font-medium text-amber-600 hover:bg-amber-50"
                              title="Repasser en brouillon pour corriger"
                            >
                              Rappeler
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => setEdition(e)}
                                className="rounded-lg px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50"
                              >
                                Ouvrir
                              </button>
                              <button
                                type="button"
                                onClick={() => supprimer(e.id)}
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

        {/* Recapitulatif de paie (snapshot moteur) */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <Card className="p-5">
            <h3 className="mb-4 text-sm font-semibold text-slate-700">Paie du mois</h3>
            {!resultat ? (
              <p className="text-sm text-slate-400">Aucune donnee.</p>
            ) : (
              <dl className="space-y-2 text-sm">
                <Ligne label="Brut total" value={fcfa(resultat.totalBrut)} />
                <Ligne
                  label={`Cotis. salariales (${pct(resultat.tauxCotisationsSalariales, 1)})`}
                  value={`− ${fcfa(resultat.totalCotisationsSalariales)}`}
                />
                <div className="my-2 border-t border-slate-100" />
                <Ligne label="Net a payer" value={fcfa(resultat.totalNetAPayer)} fort />
                <Ligne
                  label={`Cotis. patronales (${pct(resultat.tauxCotisationsPatronales, 1)})`}
                  value={`+ ${fcfa(resultat.totalCotisationsPatronales)}`}
                />
                <div className="my-2 border-t border-slate-100" />
                <Ligne label="Cout employeur" value={fcfa(resultat.totalCoutEmployeur)} fort />
              </dl>
            )}
            <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800">
              Taux de cotisations <strong>a valider par un expert paie SN</strong>{" "}
              (parametrables). L'IR/TRIMF (bareme progressif) se saisit en « autres
              retenues » en attendant sa modelisation.
            </p>
          </Card>
        </div>
      </div>

      {edition && (
        <EmployeForm
          initial={edition}
          onClose={() => setEdition(null)}
          onSave={enregistrer}
        />
      )}
    </div>
  );
}

function Ligne({ label, value, fort }: { label: string; value: string; fort?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className={fort ? "font-medium text-slate-700" : "text-slate-500"}>{label}</dt>
      <dd className={fort ? "font-semibold text-slate-800" : "text-slate-600"}>{value}</dd>
    </div>
  );
}

function EmployeForm({
  initial,
  onClose,
  onSave,
}: {
  initial: EmployeLocal;
  onClose: () => void;
  onSave: (e: EmployeLocal) => void;
}) {
  const [e, setE] = useState<EmployeLocal>(initial);
  const up = <K extends keyof EmployeLocal>(k: K, v: EmployeLocal[K]) =>
    setE((prev) => ({ ...prev, [k]: v }));

  return (
    <Modal
      titre={initial.id ? "Modifier l'employe" : "Nouvel employe"}
      onClose={onClose}
      footer={
        <>
          <BtnGhost onClick={onClose}>Annuler</BtnGhost>
          <BtnPrimary onClick={() => onSave(e)} disabled={!e.nom.trim()}>
            Enregistrer
          </BtnPrimary>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom complet *" className="sm:col-span-2">
          <Text value={e.nom} onChange={(v) => up("nom", v)} placeholder="Ex. Awa Ndiaye" />
        </Field>
        <Field label="Poste">
          <Text value={e.poste} onChange={(v) => up("poste", v)} placeholder="Ex. Comptable" />
        </Field>
        <Field label="Type de contrat">
          <select
            className={inputCls}
            value={e.typeContrat}
            onChange={(ev) => up("typeContrat", ev.target.value as TypeContrat)}
          >
            {TYPES_CONTRAT.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </Field>
        <Field label="Date d'embauche">
          <input
            type="date"
            className={inputCls}
            value={e.dateEmbauche}
            onChange={(ev) => up("dateEmbauche", ev.target.value)}
          />
        </Field>
        <Field label="Telephone">
          <Text value={e.telephone ?? ""} onChange={(v) => up("telephone", v)} placeholder="Optionnel" />
        </Field>
        <Field label="Salaire brut mensuel">
          <Num value={e.salaireBrutMensuel} suffix="FCFA" onChange={(n) => up("salaireBrutMensuel", n)} />
        </Field>
        <Field label="Primes / indemnites">
          <Num value={e.primes} suffix="FCFA" onChange={(n) => up("primes", n)} />
        </Field>
        <Field label="Autres retenues">
          <Num value={e.autresRetenues} suffix="FCFA" onChange={(n) => up("autresRetenues", n)} />
        </Field>
        <Field label="Statut">
          <select
            className={inputCls}
            value={e.actif ? "actif" : "inactif"}
            onChange={(ev) => up("actif", ev.target.value === "actif")}
          >
            <option value="actif">Actif</option>
            <option value="inactif">Inactif (hors paie)</option>
          </select>
        </Field>
      </div>
      <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-500">
        Le net a payer, les cotisations et le cout employeur seront calcules par
        le moteur a l'enregistrement.
      </p>
    </Modal>
  );
}
