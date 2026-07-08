"use client";

/**
 * Formulaire du Previsionnel 5 ans. Il COLLECTE les reponses et les envoie au
 * moteur via la server action ; il ne calcule AUCUN montant. Les resultats
 * (9 tableaux) sont rendus par le moteur (HTML) et affiches dans un iframe.
 */
import { useRef, useState, type ReactNode } from "react";
import { genererDossierAction, type ResultatGeneration } from "../../app/(app)/previsionnel/actions";
import type {
  DossierInput,
  FormeJuridique,
  NatureInvestissement,
} from "../../src/types/dossier-input";
import { Card } from "../ui";
import { Icon } from "../icons";
import { fcfa } from "../../lib/format";

const NATURES: ReadonlyArray<[NatureInvestissement, string]> = [
  ["materiel", "Materiel / equipement"],
  ["construction", "Construction / amenagement"],
  ["mobilier", "Mobilier"],
  ["informatique", "Informatique"],
  ["vehicule", "Vehicule"],
  ["terrain", "Terrain (non amortissable)"],
  ["fraisEtablissement", "Frais d'etablissement"],
  ["autre", "Autre"],
];

const FORMES: ReadonlyArray<[FormeJuridique, string]> = [
  ["EI", "Entreprise individuelle (EI)"],
  ["SUARL", "SUARL"],
  ["SARL", "SARL"],
  ["SA", "SA"],
  ["GIE", "GIE"],
];

const MOIS = [
  "Janvier", "Fevrier", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Aout", "Septembre", "Octobre", "Novembre", "Decembre",
];

interface InvestRow {
  nature: NatureInvestissement;
  libelle: string;
  montantHT: number;
}
interface PosteRow {
  intitule: string;
  nombre: number;
  salaireBrutMensuel: number;
}

interface FormState {
  nomProjet: string;
  secteur: string;
  formeJuridique: FormeJuridique;
  mois: number;
  annee: number;
  assujettiTVA: boolean;
  investissements: InvestRow[];
  apportCapital: number;
  apportCompteCourant: number;
  subventionInvestissement: number;
  empruntPresent: boolean;
  empruntMontant: number;
  empruntTaux: number; // en %
  empruntDuree: number;
  empruntDiffere: number;
  caMontant: number;
  caCroissance: number; // en %
  caSaisonnier: boolean;
  achatsMode: "pourcentageCA" | "montant";
  achatsValeur: number; // % si pourcentageCA, sinon FCFA
  loyerMensuel: number;
  eauElectriciteMensuel: number;
  telecomMensuel: number;
  transportCarburantAnnuel: number;
  assurancesAnnuel: number;
  honorairesAnnuel: number;
  marketingAnnuel: number;
  entretienDiversAnnuel: number;
  impotsTaxesAnnuel: number;
  personnel: PosteRow[];
  salaireDirigeant: number;
  delaiClientsJours: number;
  delaiFournisseursJours: number;
  delaiStockJours: number;
}

function etatVide(): FormState {
  return {
    nomProjet: "",
    secteur: "",
    formeJuridique: "SARL",
    mois: 1,
    annee: 2026,
    assujettiTVA: true,
    investissements: [{ nature: "materiel", libelle: "", montantHT: 0 }],
    apportCapital: 0,
    apportCompteCourant: 0,
    subventionInvestissement: 0,
    empruntPresent: false,
    empruntMontant: 0,
    empruntTaux: 9,
    empruntDuree: 5,
    empruntDiffere: 0,
    caMontant: 0,
    caCroissance: 0,
    caSaisonnier: false,
    achatsMode: "pourcentageCA",
    achatsValeur: 40,
    loyerMensuel: 0,
    eauElectriciteMensuel: 0,
    telecomMensuel: 0,
    transportCarburantAnnuel: 0,
    assurancesAnnuel: 0,
    honorairesAnnuel: 0,
    marketingAnnuel: 0,
    entretienDiversAnnuel: 0,
    impotsTaxesAnnuel: 0,
    personnel: [{ intitule: "", nombre: 1, salaireBrutMensuel: 0 }],
    salaireDirigeant: 0,
    delaiClientsJours: 0,
    delaiFournisseursJours: 30,
    delaiStockJours: 0,
  };
}

function depuisDossier(d: DossierInput): FormState {
  const e = d.financement.emprunt ?? null;
  const achatsPct = d.charges.achatsMatieres.mode === "pourcentageCA";
  return {
    nomProjet: d.nomProjet,
    secteur: d.secteur,
    formeJuridique: d.formeJuridique,
    mois: d.moisDemarrage.mois,
    annee: d.moisDemarrage.annee,
    assujettiTVA: d.assujettiTVA,
    investissements: d.investissements.map((i) => ({
      nature: i.nature,
      libelle: i.libelle ?? "",
      montantHT: i.montantHT,
    })),
    apportCapital: d.financement.apportCapital,
    apportCompteCourant: d.financement.apportCompteCourant ?? 0,
    subventionInvestissement: d.financement.subventionInvestissement ?? 0,
    empruntPresent: Boolean(e),
    empruntMontant: e?.montant ?? 0,
    empruntTaux: e ? Math.round(e.tauxAnnuel * 1000) / 10 : 9,
    empruntDuree: e?.dureeAnnees ?? 5,
    empruntDiffere: e?.differeMois ?? 0,
    caMontant: d.chiffreAffaires.montantAnnee1 ?? 0,
    caCroissance: Math.round((d.chiffreAffaires.tauxCroissance ?? 0) * 1000) / 10,
    caSaisonnier: Boolean(d.chiffreAffaires.saisonnier),
    achatsMode: d.charges.achatsMatieres.mode,
    achatsValeur: achatsPct
      ? Math.round(d.charges.achatsMatieres.valeur * 1000) / 10
      : d.charges.achatsMatieres.valeur,
    loyerMensuel: d.charges.loyerMensuel ?? 0,
    eauElectriciteMensuel: d.charges.eauElectriciteMensuel ?? 0,
    telecomMensuel: d.charges.telecomMensuel ?? 0,
    transportCarburantAnnuel: d.charges.transportCarburantAnnuel ?? 0,
    assurancesAnnuel: d.charges.assurancesAnnuel ?? 0,
    honorairesAnnuel: d.charges.honorairesAnnuel ?? 0,
    marketingAnnuel: d.charges.marketingAnnuel ?? 0,
    entretienDiversAnnuel: d.charges.entretienDiversAnnuel ?? 0,
    impotsTaxesAnnuel: d.charges.impotsTaxesAnnuel ?? 0,
    personnel: d.personnel.map((p) => ({
      intitule: p.intitule,
      nombre: p.nombre ?? 1,
      salaireBrutMensuel: p.salaireBrutMensuel,
    })),
    salaireDirigeant: d.salaireDirigeant?.montantMensuel ?? 0,
    delaiClientsJours: d.delais.delaiClientsJours ?? 0,
    delaiFournisseursJours: d.delais.delaiFournisseursJours ?? 30,
    delaiStockJours: d.delais.delaiStockJours ?? 0,
  };
}

function versDossier(f: FormState): DossierInput {
  return {
    nomProjet: f.nomProjet || "Mon projet",
    secteur: f.secteur || "—",
    formeJuridique: f.formeJuridique,
    moisDemarrage: { mois: f.mois, annee: f.annee },
    assujettiTVA: f.assujettiTVA,
    investissements: f.investissements
      .filter((i) => i.montantHT > 0)
      .map((i) => ({
        nature: i.nature,
        libelle: i.libelle || undefined,
        montantHT: i.montantHT,
      })),
    financement: {
      apportCapital: f.apportCapital,
      apportCompteCourant: f.apportCompteCourant,
      subventionInvestissement: f.subventionInvestissement,
      emprunt: f.empruntPresent
        ? {
            montant: f.empruntMontant,
            tauxAnnuel: f.empruntTaux / 100,
            dureeAnnees: f.empruntDuree,
            differeMois: f.empruntDiffere,
          }
        : null,
    },
    chiffreAffaires: {
      mode: "simple",
      montantAnnee1: f.caMontant,
      tauxCroissance: f.caCroissance / 100,
      saisonnier: f.caSaisonnier,
    },
    charges: {
      achatsMatieres: {
        mode: f.achatsMode,
        valeur: f.achatsMode === "pourcentageCA" ? f.achatsValeur / 100 : f.achatsValeur,
      },
      loyerMensuel: f.loyerMensuel,
      eauElectriciteMensuel: f.eauElectriciteMensuel,
      telecomMensuel: f.telecomMensuel,
      transportCarburantAnnuel: f.transportCarburantAnnuel,
      assurancesAnnuel: f.assurancesAnnuel,
      honorairesAnnuel: f.honorairesAnnuel,
      marketingAnnuel: f.marketingAnnuel,
      entretienDiversAnnuel: f.entretienDiversAnnuel,
      impotsTaxesAnnuel: f.impotsTaxesAnnuel,
    },
    personnel: f.personnel
      .filter((p) => p.intitule.trim() !== "" && p.salaireBrutMensuel > 0)
      .map((p) => ({
        intitule: p.intitule,
        nombre: p.nombre,
        salaireBrutMensuel: p.salaireBrutMensuel,
      })),
    salaireDirigeant: f.salaireDirigeant > 0 ? { montantMensuel: f.salaireDirigeant } : null,
    delais: {
      delaiClientsJours: f.delaiClientsJours,
      delaiFournisseursJours: f.delaiFournisseursJours,
      delaiStockJours: f.delaiStockJours,
    },
  };
}

/* ------------------------------ champs UI ------------------------------ */

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500";

function Num({
  value,
  onChange,
  suffix,
}: {
  value: number;
  onChange: (n: number) => void;
  suffix?: string;
}) {
  return (
    <div className="relative">
      <input
        type="number"
        className={inputCls}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
        min={0}
      />
      {suffix && (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
          {suffix}
        </span>
      )}
    </div>
  );
}

function SectionCard({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <Card className="p-5">
      <h3 className="mb-4 text-sm font-semibold text-slate-700">{titre}</h3>
      {children}
    </Card>
  );
}

/* ------------------------------ composant ------------------------------ */

export function PrevisionnelClient({ exemple }: { exemple: DossierInput }) {
  const [f, setF] = useState<FormState>(etatVide);
  const [res, setRes] = useState<ResultatGeneration | null>(null);
  const [loading, setLoading] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const up = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setF((prev) => ({ ...prev, [key]: val }));

  async function generer() {
    setLoading(true);
    setRes(null);
    try {
      const r = await genererDossierAction(versDossier(f));
      setRes(r);
      if (r.ok) {
        // Defiler vers les resultats apres le rendu.
        setTimeout(() => document.getElementById("resultats")?.scrollIntoView({ behavior: "smooth" }), 60);
      }
    } finally {
      setLoading(false);
    }
  }

  const imprimer = () => iframeRef.current?.contentWindow?.print();

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Previsionnel financier 5 ans</h1>
          <p className="mt-1 text-sm text-slate-500">
            Renseignez le projet ; le moteur calcule les 9 tableaux SYSCOHADA et les
            indicateurs. Aucun montant n'est calcule dans le navigateur.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setF(depuisDossier(exemple))}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <Icon name="plus" className="h-4 w-4" /> Remplir avec l'exemple
        </button>
      </div>

      <div className="space-y-5">
        {/* Identite */}
        <SectionCard titre="1. Identite du projet">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nom du projet">
              <input className={inputCls} value={f.nomProjet} onChange={(e) => up("nomProjet", e.target.value)} placeholder="Ex. Boulangerie La Teranga" />
            </Field>
            <Field label="Secteur d'activite">
              <input className={inputCls} value={f.secteur} onChange={(e) => up("secteur", e.target.value)} placeholder="Ex. Boulangerie - patisserie" />
            </Field>
            <Field label="Forme juridique">
              <select className={inputCls} value={f.formeJuridique} onChange={(e) => up("formeJuridique", e.target.value as FormeJuridique)}>
                {FORMES.map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Mois de demarrage">
                <select className={inputCls} value={f.mois} onChange={(e) => up("mois", Number(e.target.value))}>
                  {MOIS.map((m, i) => (
                    <option key={m} value={i + 1}>{m}</option>
                  ))}
                </select>
              </Field>
              <Field label="Annee">
                <Num value={f.annee} onChange={(n) => up("annee", n)} />
              </Field>
            </div>
          </div>
          <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={f.assujettiTVA} onChange={(e) => up("assujettiTVA", e.target.checked)} />
            Assujetti a la TVA (18 %)
          </label>
        </SectionCard>

        {/* Investissements */}
        <SectionCard titre="2. Investissements de depart (HT)">
          <div className="space-y-3">
            {f.investissements.map((inv, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1.4fr_1fr_auto]">
                <select
                  className={inputCls}
                  value={inv.nature}
                  onChange={(e) => {
                    const arr = [...f.investissements];
                    arr[i] = { ...inv, nature: e.target.value as NatureInvestissement };
                    up("investissements", arr);
                  }}
                >
                  {NATURES.map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
                <input
                  className={inputCls}
                  placeholder="Libelle (ex. Four + petrin)"
                  value={inv.libelle}
                  onChange={(e) => {
                    const arr = [...f.investissements];
                    arr[i] = { ...inv, libelle: e.target.value };
                    up("investissements", arr);
                  }}
                />
                <Num
                  value={inv.montantHT}
                  suffix="FCFA"
                  onChange={(n) => {
                    const arr = [...f.investissements];
                    arr[i] = { ...inv, montantHT: n };
                    up("investissements", arr);
                  }}
                />
                <button
                  type="button"
                  className="rounded-lg px-2 text-slate-400 hover:bg-slate-100 hover:text-red-600"
                  onClick={() => up("investissements", f.investissements.filter((_, j) => j !== i))}
                  aria-label="Supprimer"
                >
                  <Icon name="close" className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700"
            onClick={() => up("investissements", [...f.investissements, { nature: "materiel", libelle: "", montantHT: 0 }])}
          >
            <Icon name="plus" className="h-4 w-4" /> Ajouter un investissement
          </button>
        </SectionCard>

        {/* Financement */}
        <SectionCard titre="3. Financement">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Apport / capital"><Num value={f.apportCapital} suffix="FCFA" onChange={(n) => up("apportCapital", n)} /></Field>
            <Field label="Compte courant associes"><Num value={f.apportCompteCourant} suffix="FCFA" onChange={(n) => up("apportCompteCourant", n)} /></Field>
            <Field label="Subvention"><Num value={f.subventionInvestissement} suffix="FCFA" onChange={(n) => up("subventionInvestissement", n)} /></Field>
          </div>
          <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={f.empruntPresent} onChange={(e) => up("empruntPresent", e.target.checked)} />
            Emprunt bancaire
          </label>
          {f.empruntPresent && (
            <div className="mt-3 grid gap-4 sm:grid-cols-4">
              <Field label="Montant"><Num value={f.empruntMontant} suffix="FCFA" onChange={(n) => up("empruntMontant", n)} /></Field>
              <Field label="Taux annuel"><Num value={f.empruntTaux} suffix="%" onChange={(n) => up("empruntTaux", n)} /></Field>
              <Field label="Duree"><Num value={f.empruntDuree} suffix="ans" onChange={(n) => up("empruntDuree", n)} /></Field>
              <Field label="Differe"><Num value={f.empruntDiffere} suffix="mois" onChange={(n) => up("empruntDiffere", n)} /></Field>
            </div>
          )}
        </SectionCard>

        {/* Chiffre d'affaires */}
        <SectionCard titre="4. Chiffre d'affaires">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="CA HT prevu la 1re annee"><Num value={f.caMontant} suffix="FCFA" onChange={(n) => up("caMontant", n)} /></Field>
            <Field label="Croissance annuelle"><Num value={f.caCroissance} suffix="%" onChange={(n) => up("caCroissance", n)} /></Field>
          </div>
        </SectionCard>

        {/* Charges */}
        <SectionCard titre="5. Charges d'exploitation">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Achats matieres">
              <div className="flex gap-2">
                <select className={inputCls + " max-w-[9rem]"} value={f.achatsMode} onChange={(e) => up("achatsMode", e.target.value as FormState["achatsMode"])}>
                  <option value="pourcentageCA">% du CA</option>
                  <option value="montant">Montant/an</option>
                </select>
                <Num value={f.achatsValeur} suffix={f.achatsMode === "pourcentageCA" ? "%" : "FCFA"} onChange={(n) => up("achatsValeur", n)} />
              </div>
            </Field>
            <Field label="Loyer (mensuel)"><Num value={f.loyerMensuel} suffix="FCFA/mois" onChange={(n) => up("loyerMensuel", n)} /></Field>
            <Field label="Eau / electricite (mensuel)"><Num value={f.eauElectriciteMensuel} suffix="FCFA/mois" onChange={(n) => up("eauElectriciteMensuel", n)} /></Field>
            <Field label="Telecom / internet (mensuel)"><Num value={f.telecomMensuel} suffix="FCFA/mois" onChange={(n) => up("telecomMensuel", n)} /></Field>
            <Field label="Transport / carburant (annuel)"><Num value={f.transportCarburantAnnuel} suffix="FCFA/an" onChange={(n) => up("transportCarburantAnnuel", n)} /></Field>
            <Field label="Assurances (annuel)"><Num value={f.assurancesAnnuel} suffix="FCFA/an" onChange={(n) => up("assurancesAnnuel", n)} /></Field>
            <Field label="Honoraires (annuel)"><Num value={f.honorairesAnnuel} suffix="FCFA/an" onChange={(n) => up("honorairesAnnuel", n)} /></Field>
            <Field label="Marketing (annuel)"><Num value={f.marketingAnnuel} suffix="FCFA/an" onChange={(n) => up("marketingAnnuel", n)} /></Field>
            <Field label="Entretien / divers (annuel)"><Num value={f.entretienDiversAnnuel} suffix="FCFA/an" onChange={(n) => up("entretienDiversAnnuel", n)} /></Field>
            <Field label="Impots & taxes (annuel)"><Num value={f.impotsTaxesAnnuel} suffix="FCFA/an" onChange={(n) => up("impotsTaxesAnnuel", n)} /></Field>
          </div>
        </SectionCard>

        {/* Personnel */}
        <SectionCard titre="6. Personnel & masse salariale">
          <div className="space-y-3">
            {f.personnel.map((p, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[1.6fr_0.7fr_1fr_auto]">
                <input
                  className={inputCls}
                  placeholder="Intitule (ex. Boulanger)"
                  value={p.intitule}
                  onChange={(e) => {
                    const arr = [...f.personnel];
                    arr[i] = { ...p, intitule: e.target.value };
                    up("personnel", arr);
                  }}
                />
                <Num
                  value={p.nombre}
                  onChange={(n) => {
                    const arr = [...f.personnel];
                    arr[i] = { ...p, nombre: n };
                    up("personnel", arr);
                  }}
                />
                <Num
                  value={p.salaireBrutMensuel}
                  suffix="FCFA"
                  onChange={(n) => {
                    const arr = [...f.personnel];
                    arr[i] = { ...p, salaireBrutMensuel: n };
                    up("personnel", arr);
                  }}
                />
                <button
                  type="button"
                  className="rounded-lg px-2 text-slate-400 hover:bg-slate-100 hover:text-red-600"
                  onClick={() => up("personnel", f.personnel.filter((_, j) => j !== i))}
                  aria-label="Supprimer"
                >
                  <Icon name="close" className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700"
            onClick={() => up("personnel", [...f.personnel, { intitule: "", nombre: 1, salaireBrutMensuel: 0 }])}
          >
            <Icon name="plus" className="h-4 w-4" /> Ajouter un poste
          </button>
          <div className="mt-4 max-w-xs">
            <Field label="Salaire du dirigeant (mensuel, 0 = aucun)">
              <Num value={f.salaireDirigeant} suffix="FCFA" onChange={(n) => up("salaireDirigeant", n)} />
            </Field>
          </div>
        </SectionCard>

        {/* Delais (BFR) */}
        <SectionCard titre="7. Delais (besoin en fonds de roulement)">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Delai paiement clients"><Num value={f.delaiClientsJours} suffix="jours" onChange={(n) => up("delaiClientsJours", n)} /></Field>
            <Field label="Delai paiement fournisseurs"><Num value={f.delaiFournisseursJours} suffix="jours" onChange={(n) => up("delaiFournisseursJours", n)} /></Field>
            <Field label="Duree de stockage"><Num value={f.delaiStockJours} suffix="jours" onChange={(n) => up("delaiStockJours", n)} /></Field>
          </div>
        </SectionCard>

        {/* Action */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={generer}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            <Icon name="chart" className="h-4 w-4" />
            {loading ? "Calcul en cours…" : "Generer le dossier"}
          </button>
          {res && !res.ok && (
            <span className="text-sm text-red-600">Erreur : {res.error}</span>
          )}
        </div>
      </div>

      {/* Resultats */}
      {res && res.ok && (
        <div id="resultats" className="mt-10">
          <Resultats res={res} iframeRef={iframeRef} onImprimer={imprimer} />
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, ton = "neutre" }: { label: string; value: string; ton?: "neutre" | "ok" | "alerte" }) {
  const couleur =
    ton === "ok" ? "text-emerald-600" : ton === "alerte" ? "text-red-600" : "text-slate-800";
  return (
    <Card className="p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-lg font-semibold ${couleur}`}>{value}</div>
    </Card>
  );
}

function Resultats({
  res,
  iframeRef,
  onImprimer,
}: {
  res: Extract<ResultatGeneration, { ok: true }>;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  onImprimer: () => void;
}) {
  const o = res.output;
  const dscr = o.indicateurs.dscr[0];
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-800">Resultats</h2>
        <button
          type="button"
          onClick={onImprimer}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <Icon name="invoice" className="h-4 w-4" /> Imprimer / PDF
        </button>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Besoin de financement" value={fcfa(o.t1.totalEmplois)} />
        <Kpi label="Resultat net (An 1)" value={fcfa(o.t5.resultatNet[0])} ton={(o.t5.resultatNet[0] ?? 0) >= 0 ? "ok" : "alerte"} />
        <Kpi label="CAF (An 1)" value={fcfa(o.indicateurs.caf[0])} />
        <Kpi
          label="DSCR (An 1)"
          value={dscr == null ? "—" : dscr.toFixed(2)}
          ton={dscr == null ? "neutre" : dscr >= 1.2 ? "ok" : "alerte"}
        />
      </div>

      {o.avertissements.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="mb-1 text-sm font-semibold text-amber-800">Points de vigilance</div>
          <ul className="list-disc space-y-1 pl-5 text-sm text-amber-700">
            {o.avertissements.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      <Card className="overflow-hidden">
        <iframe
          ref={iframeRef}
          title="Apercu du dossier previsionnel"
          srcDoc={res.html}
          className="h-[80vh] w-full border-0"
        />
      </Card>
    </>
  );
}
