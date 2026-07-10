"use client";

/**
 * RAPPORT FINANCIER — assemble un rapport d'exercice complet et imprimable.
 *
 * Regle raktak (non negociable) : aucun chiffre n'est calcule ici. Le composant
 * CHARGE les saisies locales de l'entreprise active (ecritures comptables +
 * tresorerie), les envoie a la server action qui appelle les MOTEURS testes
 * (comptabilite -> etats financiers -> rapport financier ; tresorerie), et
 * AFFICHE le snapshot renvoye. Le comptable n'ajoute que le NARRATIF (texte
 * libre) et les REFERENCES de comparaison (N-1, budget), qui sont des saisies.
 *
 * L'en-tete reprend l'identite de l'entreprise (raison sociale, NINEA, RCCM,
 * adresse, telephone, email, representant). L'export PDF se fait par impression
 * navigateur : seule la zone `.rapport-print` est imprimee (voir globals.css).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { calculerRapportAction, type ResultatRapportAction } from "../../app/(app)/rapports/actions";
import type {
  RapportFinancier,
  EtatsFinanciers,
  ResultatTresorerie,
  PosteEtat,
  Variation,
  ComparatifRapport,
  LigneComparee,
} from "../../lib/engine";
import {
  LIBELLE_FORME_JURIDIQUE,
  LIBELLE_REGIME_FISCAL,
  LIBELLE_REGIME_COMPTABLE,
} from "../../lib/engine";
import { useEntreprise } from "../../lib/entreprise-context";
import { store as financeStore } from "../../lib/finance-data";
import { store as tresoStore, libelleTypeCompte } from "../../lib/tresorerie-data";
import {
  store as rapportStore,
  brouillonParDefaut,
  type RapportBrouillon,
  type ComparatifSaisie,
} from "../../lib/rapport-data";
import { fcfa, pct } from "../../lib/format";
import { Icon } from "../icons";
import { inputCls } from "../ventes/form";

/* ------------------------------ formatage ------------------------------ */

/** "+30,0 %" / "-7,1 %" / "—". */
function pctSigne(fraction: number | null | undefined, d = 1): string {
  if (fraction == null || Number.isNaN(fraction)) return "—";
  const v = fraction * 100;
  const signe = v > 0 ? "+" : "";
  return `${signe}${v.toFixed(d).replace(".", ",")} %`;
}

/** Montant signe : "+1 200 000 FCFA" / "-400 000 FCFA". */
function fcfaSigne(n: number): string {
  return `${n > 0 ? "+" : ""}${fcfa(n)}`;
}

/* ------------------------------ composant ------------------------------ */

export function RapportFinancierClient() {
  const { active, pretes } = useEntreprise();
  const [b, setB] = useState<RapportBrouillon>(brouillonParDefaut());
  const [pret, setPret] = useState(false);
  const [data, setData] = useState<{
    rapport: RapportFinancier;
    etats: EtatsFinanciers;
    treso: ResultatTresorerie;
  } | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hydratation du brouillon depuis Supabase (rapport le plus recent de l'entreprise).
  useEffect(() => {
    let vivant = true;
    setPret(false);
    (async () => {
      const charge = active?.id ? await rapportStore.charger(active.id) : null;
      if (!vivant) return;
      setB(charge ?? brouillonParDefaut());
      setPret(true);
    })();
    return () => {
      vivant = false;
    };
  }, [active?.id]);

  // Persistance du brouillon (Supabase), autosave debounce pour ne pas ecrire a chaque frappe.
  useEffect(() => {
    if (!pret || !active?.id) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const eid = active.id;
    saveTimer.current = setTimeout(() => {
      rapportStore.sauver(eid, b).catch((e) => setErreur((e as Error).message));
    }, 600);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [b, pret, active?.id]);

  // Recalcul (moteurs) a chaque changement de reference/comparaison, debounce.
  useEffect(() => {
    if (!pret) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const [ecrituresBrutes, comptesBruts, mouvementsBruts] = await Promise.all([
        active?.id ? financeStore.chargerEcritures(active.id) : Promise.resolve([]),
        tresoStore.chargerComptes(active?.id ?? ""),
        tresoStore.chargerMouvements(active?.id ?? ""),
      ]);
      const ecritures = ecrituresBrutes.map((e) => ({
        date: e.date,
        journal: e.journal,
        libelle: e.libelle,
        lignes: e.lignes.map((l) => ({
          compte: l.compte,
          libelle: l.libelle,
          debit: l.debit,
          credit: l.credit,
        })),
      }));
      const comptes = comptesBruts.map((c) => ({
        id: c.id,
        nom: c.nom,
        type: c.type,
        operateur: c.operateur,
        soldeInitial: c.soldeInitial,
      }));
      const mouvements = mouvementsBruts.map((m) => ({
        compteId: m.compteId,
        sens: m.sens,
        montant: m.montant,
        categorie: m.categorie,
      }));

      const r: ResultatRapportAction = await calculerRapportAction({
        ecritures,
        comptes,
        mouvements,
        exercicePrecedent: b.comparerN1 ? versComparatif(b.exercicePrecedent) : undefined,
        budget: b.comparerBudget ? versComparatif(b.budget) : undefined,
      });
      if (r.ok) {
        setData({ rapport: r.rapport, etats: r.etats, treso: r.treso });
        setErreur(null);
      } else {
        setErreur(r.error);
      }
    }, 200);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [pret, active?.id, b.comparerN1, b.comparerBudget, b.exercicePrecedent, b.budget]);

  const set = <K extends keyof RapportBrouillon>(k: K, v: RapportBrouillon[K]) =>
    setB((prev) => ({ ...prev, [k]: v }));

  if (pretes && !active) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
          <p className="text-sm text-slate-500">
            Aucune entreprise active. Ouvrez un dossier client dans{" "}
            <Link href="/entreprises" className="font-medium text-brand-600 hover:underline">
              Portefeuille d&apos;entreprises
            </Link>{" "}
            pour generer son rapport financier.
          </p>
        </div>
      </div>
    );
  }

  const rapport = data?.rapport;
  const etats = data?.etats;
  const treso = data?.treso;

  return (
    <div className="mx-auto max-w-4xl">
      {/* Barre d'outils (jamais imprimee) */}
      <div className="no-print mb-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-800">Rapport financier</h1>
            <p className="mt-1 text-sm text-slate-500">
              Genere a partir des donnees de l&apos;entreprise active. Chiffres produits par les
              moteurs (serveur) ; vous redigez l&apos;analyse.
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            <Icon name="rapports" className="h-4 w-4" /> Exporter en PDF (imprimer)
          </button>
        </div>

        <Parametres b={b} set={set} />
        {erreur && (
          <div className="mt-3 rounded-lg border border-red-100 bg-red-50 px-4 py-2 text-xs font-medium text-red-600">
            Erreur de calcul : {erreur}
          </div>
        )}
      </div>

      {/* Document imprimable */}
      <div className="rapport-print space-y-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
        {active && <Entete entreprise={active} b={b} />}

        {!rapport ? (
          <p className="py-10 text-center text-sm text-slate-400">Chargement des donnees…</p>
        ) : (
          <>
            <SyntheseSection rapport={rapport} b={b} set={set} />
            <ExploitationSection rapport={rapport} b={b} set={set} />
            {etats && <BilanSection etats={etats} rapport={rapport} />}
            {treso && <TresorerieSection treso={treso} />}
            <RatiosSection rapport={rapport} />
            {b.comparerBudget && <EcartsSection rapport={rapport} b={b} set={set} />}
            <PerspectivesSection b={b} set={set} />
            {active && <Signature entreprise={active} b={b} />}
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------ parametres ------------------------------ */

function Parametres({
  b,
  set,
}: {
  b: RapportBrouillon;
  set: <K extends keyof RapportBrouillon>(k: K, v: RapportBrouillon[K]) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-3 text-sm font-semibold text-slate-700">Parametres du rapport</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Champ label="Exercice">
          <input
            type="number"
            className={inputCls}
            value={b.exercice}
            onChange={(e) => set("exercice", Number(e.target.value) || b.exercice)}
          />
        </Champ>
        <Champ label="Periode couverte">
          <input
            className={inputCls}
            value={b.periode}
            onChange={(e) => set("periode", e.target.value)}
          />
        </Champ>
        <Champ label="Lieu de presentation">
          <input className={inputCls} value={b.lieu} onChange={(e) => set("lieu", e.target.value)} />
        </Champ>
        <Champ label="Date de presentation">
          <input
            className={inputCls}
            placeholder="Ex. Juillet 2026"
            value={b.datePresentation}
            onChange={(e) => set("datePresentation", e.target.value)}
          />
        </Champ>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ComparatifEditor
          titre="Comparer a l'exercice precedent (N-1)"
          actif={b.comparerN1}
          onToggle={(v) => set("comparerN1", v)}
          valeur={b.exercicePrecedent}
          onChange={(v) => set("exercicePrecedent", v)}
        />
        <ComparatifEditor
          titre="Comparer au budget"
          actif={b.comparerBudget}
          onToggle={(v) => set("comparerBudget", v)}
          valeur={b.budget}
          onChange={(v) => set("budget", v)}
        />
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
        Les colonnes N-1 et budget sont des references saisies a la main (l&apos;historique
        multi-exercice sera automatise avec la base). Les montants de l&apos;exercice, eux, sont
        toujours calcules par les moteurs.
      </p>
    </div>
  );
}

function ComparatifEditor({
  titre,
  actif,
  onToggle,
  valeur,
  onChange,
}: {
  titre: string;
  actif: boolean;
  onToggle: (v: boolean) => void;
  valeur: ComparatifSaisie;
  onChange: (v: ComparatifSaisie) => void;
}) {
  const champ = (k: keyof ComparatifSaisie, label: string) => (
    <Champ label={label}>
      <input
        type="number"
        min={0}
        className={inputCls}
        value={valeur[k] ? valeur[k] : ""}
        onChange={(e) => onChange({ ...valeur, [k]: e.target.value === "" ? 0 : Number(e.target.value) })}
        disabled={!actif}
      />
    </Champ>
  );
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <input type="checkbox" checked={actif} onChange={(e) => onToggle(e.target.checked)} />
        {titre}
      </label>
      {actif && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          {champ("chiffreAffaires", "Chiffre d'affaires")}
          {champ("totalProduits", "Total produits")}
          {champ("totalCharges", "Total charges")}
          {champ("resultatNet", "Resultat net")}
        </div>
      )}
    </div>
  );
}

/* -------------------------------- en-tete -------------------------------- */

function Entete({
  entreprise,
  b,
}: {
  entreprise: ReturnType<typeof useEntreprise>["active"];
  b: RapportBrouillon;
}) {
  if (!entreprise) return null;
  const e = entreprise;
  const contactLignes = [
    e.adresse && `${e.adresse}${e.ville ? `, ${e.ville}` : ""}`,
    e.telephone && `Tel. ${e.telephone}`,
    e.email,
    e.siteWeb,
  ].filter(Boolean) as string[];
  const legalLignes = [
    `${LIBELLE_FORME_JURIDIQUE[e.formeJuridique]}${e.capitalSocial ? ` au capital de ${fcfa(e.capitalSocial)}` : ""}`,
    e.ninea && `NINEA : ${e.ninea}`,
    e.rccm && `RCCM : ${e.rccm}`,
    `Regime : ${LIBELLE_REGIME_FISCAL[e.regimeFiscal]} · ${LIBELLE_REGIME_COMPTABLE[e.regimeComptable]}`,
  ].filter(Boolean) as string[];

  return (
    <header className="print-avoid-break border-b-2 border-slate-800 pb-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-2xl font-bold text-white">
            {e.raisonSociale.charAt(0).toUpperCase()}
          </span>
          <div>
            <h2 className="text-xl font-bold text-slate-900">{e.raisonSociale}</h2>
            {e.sigle && <div className="text-sm text-slate-500">{e.sigle}</div>}
            <div className="mt-1 text-xs leading-relaxed text-slate-500">
              {legalLignes.map((l, i) => (
                <div key={i}>{l}</div>
              ))}
            </div>
          </div>
        </div>
        <div className="text-right text-xs leading-relaxed text-slate-500">
          {contactLignes.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
          {e.representant && (
            <div className="mt-1 text-slate-600">Representant : {e.representant}</div>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-widest text-brand-600">
            Rapport financier
          </div>
          <div className="text-3xl font-bold tracking-tight text-slate-900">
            Exercice {b.exercice}
          </div>
          <div className="mt-1 text-sm text-slate-500">Periode couverte : {b.periode}</div>
        </div>
        <div className="text-right text-xs text-slate-500">
          <span className="inline-block rounded border border-slate-300 px-2 py-0.5 font-semibold uppercase tracking-wide text-slate-600">
            Confidentiel
          </span>
          <div className="mt-1">Devise : FCFA (XOF)</div>
          {b.datePresentation && <div>Presente en {b.datePresentation}</div>}
        </div>
      </div>
    </header>
  );
}

/* ------------------------------- synthese ------------------------------- */

function SyntheseSection({
  rapport,
  b,
  set,
}: {
  rapport: RapportFinancier;
  b: RapportBrouillon;
  set: <K extends keyof RapportBrouillon>(k: K, v: RapportBrouillon[K]) => void;
}) {
  const s = rapport.synthese;
  const ca = trouver(rapport.exploitation, "ca");
  const res = trouver(rapport.exploitation, "resultat");
  const chg = trouver(rapport.exploitation, "charges");

  return (
    <Section numero="01" titre="Synthese executive">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Chiffre d'affaires" valeur={fcfa(s.chiffreAffaires)} variation={ca?.n1} />
        <Kpi
          label={s.beneficiaire ? "Resultat net" : "Resultat net (perte)"}
          valeur={fcfa(s.resultatNet)}
          variation={res?.n1}
        />
        <Kpi label="Total des charges" valeur={fcfa(s.totalCharges)} variation={chg?.n1} inverse />
        <Kpi
          label="Taux de marge nette"
          valeur={pct(s.margeNette, 1)}
          hint={s.margeNettePrecedent != null ? `N-1 : ${pct(s.margeNettePrecedent, 1)}` : undefined}
        />
        <Kpi label="Fonds de roulement" valeur={fcfa(s.fondsDeRoulement)} />
        <Kpi label="Besoin en fonds de roulement" valeur={fcfa(s.bfr)} />
        <Kpi label="Tresorerie nette" valeur={fcfa(s.tresorerieNette)} />
        <Kpi
          label="Disponible en tresorerie"
          valeur={fcfa(s.tresorerieDisponible ?? 0)}
          hint="Banques, caisses, mobile money"
        />
      </div>

      <Redaction
        titre="Faits marquants"
        value={b.faitsMarquants}
        onChange={(v) => set("faitsMarquants", v)}
        placeholder="Redigez les faits marquants de l'exercice : croissance, evenements, decisions clefs…"
      />
    </Section>
  );
}

/* ---------------------------- resultats d'exploitation ---------------------------- */

function ExploitationSection({
  rapport,
  b,
  set,
}: {
  rapport: RapportFinancier;
  b: RapportBrouillon;
  set: <K extends keyof RapportBrouillon>(k: K, v: RapportBrouillon[K]) => void;
}) {
  const avecN1 = rapport.exploitation.some((l) => l.n1);
  const avecBudget = rapport.exploitation.some((l) => l.budget);
  return (
    <Section numero="02" titre="Resultats d'exploitation">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="py-2 pr-3 font-medium">Grandeur</th>
              <th className="py-2 px-3 text-right font-medium">Exercice {b.exercice}</th>
              {avecN1 && <th className="py-2 px-3 text-right font-medium">N-1</th>}
              {avecN1 && <th className="py-2 px-3 text-right font-medium">Var. N-1</th>}
              {avecBudget && <th className="py-2 px-3 text-right font-medium">Budget</th>}
              {avecBudget && <th className="py-2 pl-3 text-right font-medium">Ecart budget</th>}
            </tr>
          </thead>
          <tbody>
            {rapport.exploitation.map((l) => (
              <tr key={l.cle} className="border-b border-slate-100 last:border-0">
                <td className="py-2.5 pr-3 font-medium text-slate-700">{l.libelle}</td>
                <td className="py-2.5 px-3 text-right font-semibold text-slate-900">{fcfa(l.valeur)}</td>
                {avecN1 && (
                  <td className="py-2.5 px-3 text-right text-slate-500">
                    {l.n1 ? fcfa(l.n1.base) : "—"}
                  </td>
                )}
                {avecN1 && (
                  <td className="py-2.5 px-3 text-right">
                    <VariationInline v={l.n1} inverse={l.cle === "charges"} />
                  </td>
                )}
                {avecBudget && (
                  <td className="py-2.5 px-3 text-right text-slate-500">
                    {l.budget ? fcfa(l.budget.base) : "—"}
                  </td>
                )}
                {avecBudget && (
                  <td className="py-2.5 pl-3 text-right">
                    <VariationInline v={l.budget} inverse={l.cle === "charges"} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Redaction
        titre="Analyse des resultats"
        value={b.analyseExploitation}
        onChange={(v) => set("analyseExploitation", v)}
        placeholder="Commentez l'evolution du chiffre d'affaires, des charges et du resultat…"
      />
    </Section>
  );
}

/* --------------------------------- bilan --------------------------------- */

function BilanSection({ etats, rapport }: { etats: EtatsFinanciers; rapport: RapportFinancier }) {
  const { bilan } = etats;
  const s = rapport.synthese;
  const resultatPoste: PosteEtat = {
    compte: "13",
    libelle: s.beneficiaire ? "Resultat net (benefice)" : "Resultat net (perte)",
    classe: 1,
    montant: bilan.resultatNet,
  };
  return (
    <Section numero="03" titre="Analyse du bilan">
      <div className="grid gap-5 lg:grid-cols-2">
        <PostesBloc titre="ACTIF (emplois)" postes={bilan.actif} total={bilan.totalActif} />
        <PostesBloc
          titre="PASSIF (ressources)"
          postes={[...bilan.passif, resultatPoste]}
          total={bilan.totalPassif}
        />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Ressources stables" valeur={fcfa(s.ressourcesStables)} />
        <Kpi label="Actif immobilise" valeur={fcfa(s.actifImmobilise)} />
        <Kpi label="Capitaux propres" valeur={fcfa(s.capitauxPropres)} />
        <Kpi label="Dettes financieres" valeur={fcfa(s.dettesFinancieres)} />
      </div>

      {!bilan.equilibre && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-700">
          Bilan desequilibre (ecart {fcfa(Math.abs(bilan.ecart))}) : verifiez que toutes les
          ecritures sont equilibrees dans la comptabilite.
        </div>
      )}
    </Section>
  );
}

function PostesBloc({ titre, postes, total }: { titre: string; postes: PosteEtat[]; total: number }) {
  return (
    <div className="print-avoid-break overflow-hidden rounded-lg border border-slate-200">
      <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
        {titre}
      </div>
      {postes.length === 0 ? (
        <div className="px-3 py-6 text-center text-sm text-slate-400">Aucun poste.</div>
      ) : (
        <table className="w-full text-sm">
          <tbody>
            {postes.map((p) => (
              <tr key={p.compte} className="border-b border-slate-50 last:border-0">
                <td className="px-3 py-1.5 font-mono text-xs text-slate-400">{p.compte}</td>
                <td className="px-3 py-1.5 text-slate-700">{p.libelle}</td>
                <td className="px-3 py-1.5 text-right font-medium text-slate-800">{fcfa(p.montant)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-200 bg-slate-50 text-sm font-semibold text-slate-900">
              <td className="px-3 py-2" colSpan={2}>
                Total
              </td>
              <td className="px-3 py-2 text-right">{fcfa(total)}</td>
            </tr>
          </tfoot>
        </table>
      )}
    </div>
  );
}

/* ------------------------------- tresorerie ------------------------------- */

function TresorerieSection({ treso }: { treso: ResultatTresorerie }) {
  return (
    <Section numero="04" titre="Tresorerie & flux financiers">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Disponible total" valeur={fcfa(treso.totalDisponible)} />
        <Kpi label="Encaissements" valeur={fcfa(treso.totalEntrees)} />
        <Kpi label="Decaissements" valeur={fcfa(treso.totalSorties)} />
        <Kpi
          label="Flux net"
          valeur={fcfa(treso.fluxNet)}
          hint={treso.fluxNet >= 0 ? "En hausse" : "En baisse"}
        />
      </div>

      {treso.comptes.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 print-avoid-break">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2 font-medium">Compte</th>
                <th className="px-3 py-2 text-right font-medium">Entrees</th>
                <th className="px-3 py-2 text-right font-medium">Sorties</th>
                <th className="px-3 py-2 text-right font-medium">Solde</th>
              </tr>
            </thead>
            <tbody>
              {treso.comptes.map((c) => (
                <tr key={c.compteId} className="border-b border-slate-50 last:border-0">
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-800">{c.nom}</div>
                    <div className="text-xs text-slate-400">
                      {libelleTypeCompte(c.type)}
                      {c.operateur ? ` · ${c.operateur}` : ""}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right text-emerald-600">{fcfa(c.totalEntrees)}</td>
                  <td className="px-3 py-2 text-right text-rose-600">{fcfa(c.totalSorties)}</td>
                  <td className="px-3 py-2 text-right font-semibold text-slate-900">{fcfa(c.soldeCourant)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

/* -------------------------------- ratios -------------------------------- */

function RatiosSection({ rapport }: { rapport: RapportFinancier }) {
  const r = rapport.ratios;
  const lignes: { label: string; valeur: string; note: string }[] = [
    { label: "Taux de marge nette", valeur: pct(r.margeNette, 1), note: "Resultat net / chiffre d'affaires" },
    {
      label: "Autonomie financiere",
      valeur: r.autonomieFinanciere != null ? pct(r.autonomieFinanciere, 1) : "—",
      note: "Capitaux propres / total passif",
    },
    {
      label: "Taux d'endettement",
      valeur: r.tauxEndettement != null ? pct(r.tauxEndettement, 1) : "—",
      note: "Dettes financieres / capitaux propres",
    },
    {
      label: "Liquidite generale",
      valeur: r.liquiditeGenerale != null ? r.liquiditeGenerale.toFixed(2).replace(".", ",") : "—",
      note: "Actif circulant + tresorerie / dettes circulantes",
    },
    {
      label: "Delai de reglement clients",
      valeur: r.delaiClients != null ? `${r.delaiClients} j` : "—",
      note: "Creances clients / CA × 360",
    },
    {
      label: "Delai de reglement fournisseurs",
      valeur: r.delaiFournisseurs != null ? `${r.delaiFournisseurs} j` : "—",
      note: "Dettes fournisseurs / achats × 360",
    },
  ];
  return (
    <Section numero="05" titre="Indicateurs cles de performance">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <tbody>
            {lignes.map((l) => (
              <tr key={l.label} className="border-b border-slate-100 last:border-0">
                <td className="py-2.5 pr-3 font-medium text-slate-700">{l.label}</td>
                <td className="py-2.5 px-3 text-right font-semibold text-slate-900">{l.valeur}</td>
                <td className="hidden py-2.5 pl-3 text-right text-xs text-slate-400 sm:table-cell">
                  {l.note}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

/* ---------------------------- ecarts budgetaires ---------------------------- */

function EcartsSection({
  rapport,
  b,
  set,
}: {
  rapport: RapportFinancier;
  b: RapportBrouillon;
  set: <K extends keyof RapportBrouillon>(k: K, v: RapportBrouillon[K]) => void;
}) {
  const lignes = rapport.exploitation.filter((l) => l.budget);
  return (
    <Section numero="06" titre="Budget vs realise">
      {lignes.length === 0 ? (
        <p className="text-sm text-slate-400">Aucune reference budgetaire saisie.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3 font-medium">Grandeur</th>
                <th className="py-2 px-3 text-right font-medium">Budget</th>
                <th className="py-2 px-3 text-right font-medium">Realise</th>
                <th className="py-2 px-3 text-right font-medium">Ecart</th>
                <th className="py-2 pl-3 text-right font-medium">Taux d'execution</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((l) => (
                <tr key={l.cle} className="border-b border-slate-100 last:border-0">
                  <td className="py-2.5 pr-3 font-medium text-slate-700">{l.libelle}</td>
                  <td className="py-2.5 px-3 text-right text-slate-500">{fcfa(l.budget!.base)}</td>
                  <td className="py-2.5 px-3 text-right font-semibold text-slate-900">{fcfa(l.valeur)}</td>
                  <td className="py-2.5 px-3 text-right">
                    <VariationInline v={l.budget} inverse={l.cle === "charges"} />
                  </td>
                  <td className="py-2.5 pl-3 text-right text-slate-600">
                    {l.budget!.ecartPct != null ? pct(1 + l.budget!.ecartPct, 1) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Redaction
        titre="Analyse des ecarts"
        value={b.analyseEcarts}
        onChange={(v) => set("analyseEcarts", v)}
        placeholder="Expliquez les principaux ecarts entre le budget et le realise et les mesures correctives…"
      />
    </Section>
  );
}

/* ----------------------------- perspectives ----------------------------- */

function PerspectivesSection({
  b,
  set,
}: {
  b: RapportBrouillon;
  set: <K extends keyof RapportBrouillon>(k: K, v: RapportBrouillon[K]) => void;
}) {
  return (
    <Section numero="07" titre="Perspectives & recommandations">
      <Redaction
        titre="Orientations pour l'exercice a venir"
        value={b.perspectives}
        onChange={(v) => set("perspectives", v)}
        placeholder="Objectifs, investissements prioritaires, optimisation du BFR, maitrise des charges…"
      />
      <Redaction
        titre="Conclusion"
        value={b.conclusion}
        onChange={(v) => set("conclusion", v)}
        placeholder="Synthese finale du rapport."
      />
    </Section>
  );
}

/* ------------------------------ signature ------------------------------ */

function Signature({
  entreprise,
  b,
}: {
  entreprise: ReturnType<typeof useEntreprise>["active"];
  b: RapportBrouillon;
}) {
  if (!entreprise) return null;
  return (
    <footer className="print-avoid-break mt-4 flex items-end justify-between border-t border-slate-200 pt-6 text-xs text-slate-500">
      <div>
        <div>
          {b.lieu ? `${b.lieu}, ` : ""}
          {b.datePresentation || `exercice clos ${b.exercice}`}
        </div>
        <div className="mt-1">
          Document confidentiel — {entreprise.raisonSociale}. Chiffres produits par le moteur de
          calcul raktak (FCFA entiers, SYSCOHADA revise).
        </div>
      </div>
      <div className="text-right">
        <div className="mb-8 font-medium text-slate-600">
          {entreprise.representant ? "Le representant legal" : "La Direction"}
        </div>
        {entreprise.representant && (
          <div className="border-t border-slate-300 pt-1 text-slate-700">{entreprise.representant}</div>
        )}
      </div>
    </footer>
  );
}

/* ------------------------------- primitives ------------------------------- */

function Section({
  numero,
  titre,
  children,
}: {
  numero: string;
  titre: string;
  children: React.ReactNode;
}) {
  return (
    <section className="print-avoid-break">
      <div className="mb-4 flex items-center gap-3 border-b border-slate-200 pb-2">
        <span className="text-sm font-bold text-brand-600">{numero}</span>
        <h3 className="text-base font-semibold text-slate-800">{titre}</h3>
      </div>
      {children}
    </section>
  );
}

function Kpi({
  label,
  valeur,
  hint,
  variation,
  inverse,
}: {
  label: string;
  valeur: string;
  hint?: string;
  variation?: Variation;
  inverse?: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 break-words text-lg font-bold leading-tight text-slate-900">{valeur}</div>
      {variation ? (
        <div className="mt-0.5">
          <VariationInline v={variation} inverse={inverse} suffixe="vs N-1" />
        </div>
      ) : (
        hint && <div className="mt-0.5 text-[11px] text-slate-400">{hint}</div>
      )}
    </div>
  );
}

/** Affiche une variation (fleche + %) coloree ; `inverse` pour les charges. */
function VariationInline({
  v,
  inverse,
  suffixe,
}: {
  v: Variation | undefined;
  inverse?: boolean;
  suffixe?: string;
}) {
  if (!v) return <span className="text-slate-400">—</span>;
  const hausse = v.ecart > 0;
  const nul = v.ecart === 0;
  const favorable = nul ? null : inverse ? !hausse : hausse;
  const couleur =
    favorable == null ? "text-slate-500" : favorable ? "text-emerald-600" : "text-rose-600";
  const fleche = nul ? "→" : hausse ? "▲" : "▼";
  return (
    <span className={`text-xs font-medium ${couleur}`} title={fcfaSigne(v.ecart)}>
      {fleche} {pctSigne(v.ecartPct)}
      {suffixe ? <span className="ml-1 font-normal text-slate-400">{suffixe}</span> : null}
    </span>
  );
}

/** Zone de texte redigee par le comptable. A l'ecran : textarea ; a l'impression : texte plat. */
function Redaction({
  titre,
  value,
  onChange,
  placeholder,
}: {
  titre: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="mt-5">
      <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {titre}
      </div>
      <textarea
        className={`${inputCls} min-h-[90px] resize-y leading-relaxed print:hidden`}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
      />
      {/* Rendu d'impression : texte plat, masque a l'ecran. */}
      <p className="hidden whitespace-pre-wrap text-sm leading-relaxed text-slate-700 print:block">
        {value || " "}
      </p>
    </div>
  );
}

function Champ({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}

/* -------------------------------- helpers -------------------------------- */

function versComparatif(s: ComparatifSaisie): ComparatifRapport {
  // Seuls les champs > 0 deviennent une base de comparaison (0 = non renseigne).
  return {
    chiffreAffaires: s.chiffreAffaires > 0 ? s.chiffreAffaires : undefined,
    totalProduits: s.totalProduits > 0 ? s.totalProduits : undefined,
    totalCharges: s.totalCharges > 0 ? s.totalCharges : undefined,
    resultatNet: s.resultatNet !== 0 ? s.resultatNet : undefined,
  };
}

function trouver(lignes: LigneComparee[], cle: string): LigneComparee | undefined {
  return lignes.find((l) => l.cle === cle);
}
