"use client";

/**
 * Portefeuille du cabinet : la liste des entreprises clientes + creation.
 * C'est le point d'entree naturel du comptable — il choisit le dossier client
 * sur lequel travailler (« Ouvrir »), ce qui scope tous les modules.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, PageHeading, RegimeBadge } from "../ui";
import { Icon } from "../icons";
import { useEntreprise } from "../../lib/entreprise-context";
import { InvitationEntreprise } from "./InvitationEntreprise";
import type { EntrepriseBrouillon } from "../../lib/entreprise-store";
import {
  LIBELLE_FORME_JURIDIQUE,
  type FormeJuridique,
  type ProfilEntreprise,
} from "../../lib/engine";

const FORMES: FormeJuridique[] = ["SARL", "SUARL", "SA", "GIE", "EI"];

const BROUILLON_VIDE: EntrepriseBrouillon = {
  raisonSociale: "",
  profil: "formel",
  formeJuridique: "SARL",
  ninea: "",
  rccm: "",
  secteur: "",
  adresse: "",
  ville: "",
  telephone: "",
  email: "",
  representant: "",
  capitalSocial: 0,
};

export function EntreprisesClient() {
  const router = useRouter();
  const { entreprises, active, changerActive, creer, supprimer } = useEntreprise();
  const [formOuvert, setFormOuvert] = useState(false);
  const [b, setB] = useState<EntrepriseBrouillon>(BROUILLON_VIDE);

  const [enCours, setEnCours] = useState(false);

  const ouvrir = async (id: string) => {
    await changerActive(id);
    router.push("/");
  };

  const soumettre = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!b.raisonSociale.trim() || enCours) return;
    setEnCours(true);
    try {
      const ent = await creer(b);
      setB(BROUILLON_VIDE);
      setFormOuvert(false);
      await ouvrir(ent.id);
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeading
        titre="Portefeuille d'entreprises"
        sousTitre="Les dossiers clients geres par le cabinet. Ouvrez-en un pour travailler dessus."
        action={
          <button
            type="button"
            onClick={() => setFormOuvert((v) => !v)}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            <Icon name="plus" className="h-4 w-4" />
            Nouvelle entreprise
          </button>
        }
      />

      {formOuvert && (
        <Card className="mb-6 p-5">
          <form onSubmit={soumettre} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Champ label="Raison sociale" obligatoire>
                <input
                  value={b.raisonSociale}
                  onChange={(e) => setB({ ...b, raisonSociale: e.target.value })}
                  placeholder="Ex. Sourou Distribution SARL"
                  className={INPUT}
                  autoFocus
                />
              </Champ>
              <Champ label="Secteur d'activite">
                <input
                  value={b.secteur ?? ""}
                  onChange={(e) => setB({ ...b, secteur: e.target.value })}
                  placeholder="Ex. Distribution, Commerce, Services"
                  className={INPUT}
                />
              </Champ>
              <Champ label="Forme juridique">
                <select
                  value={b.formeJuridique}
                  onChange={(e) =>
                    setB({ ...b, formeJuridique: e.target.value as FormeJuridique })
                  }
                  className={INPUT}
                >
                  {FORMES.map((f) => (
                    <option key={f} value={f}>
                      {LIBELLE_FORME_JURIDIQUE[f]}
                    </option>
                  ))}
                </select>
              </Champ>
              <Champ label="NINEA (optionnel)">
                <input
                  value={b.ninea ?? ""}
                  onChange={(e) => setB({ ...b, ninea: e.target.value })}
                  placeholder="Identifiant fiscal"
                  className={INPUT}
                />
              </Champ>
              <Champ label="RCCM (optionnel)">
                <input
                  value={b.rccm ?? ""}
                  onChange={(e) => setB({ ...b, rccm: e.target.value })}
                  placeholder="Ex. SN-DKR-2019-B-12345"
                  className={INPUT}
                />
              </Champ>
              <Champ label="Representant legal / gerant">
                <input
                  value={b.representant ?? ""}
                  onChange={(e) => setB({ ...b, representant: e.target.value })}
                  placeholder="Nom du signataire"
                  className={INPUT}
                />
              </Champ>
            </div>

            <fieldset>
              <legend className="mb-2 text-sm font-medium text-slate-700">
                Coordonnees (en-tete des documents et du rapport)
              </legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <Champ label="Adresse / siege">
                  <input
                    value={b.adresse ?? ""}
                    onChange={(e) => setB({ ...b, adresse: e.target.value })}
                    placeholder="Ex. Sacre-Coeur 3, Villa 8421"
                    className={INPUT}
                  />
                </Champ>
                <Champ label="Ville">
                  <input
                    value={b.ville ?? ""}
                    onChange={(e) => setB({ ...b, ville: e.target.value })}
                    placeholder="Ex. Dakar"
                    className={INPUT}
                  />
                </Champ>
                <Champ label="Telephone">
                  <input
                    value={b.telephone ?? ""}
                    onChange={(e) => setB({ ...b, telephone: e.target.value })}
                    placeholder="Ex. +221 33 800 00 00"
                    className={INPUT}
                  />
                </Champ>
                <Champ label="Email">
                  <input
                    type="email"
                    value={b.email ?? ""}
                    onChange={(e) => setB({ ...b, email: e.target.value })}
                    placeholder="contact@entreprise.sn"
                    className={INPUT}
                  />
                </Champ>
                <Champ label="Capital social (FCFA)">
                  <input
                    type="number"
                    min={0}
                    value={b.capitalSocial ? b.capitalSocial : ""}
                    onChange={(e) =>
                      setB({ ...b, capitalSocial: e.target.value === "" ? 0 : Number(e.target.value) })
                    }
                    placeholder="Ex. 5000000"
                    className={INPUT}
                  />
                </Champ>
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-2 text-sm font-medium text-slate-700">Regime</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <OptionProfil
                  valeur="formel"
                  actif={b.profil === "formel"}
                  onClick={() => setB({ ...b, profil: "formel" })}
                  titre="Formel"
                  detail="Systeme Normal SYSCOHADA · TVA 18 % + IS"
                />
                <OptionProfil
                  valeur="informel"
                  actif={b.profil === "informel"}
                  onClick={() => setB({ ...b, profil: "informel" })}
                  titre="Informel"
                  detail="Tresorerie (SMT) · CGU (ni TVA ni IS)"
                />
              </div>
            </fieldset>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setFormOuvert(false);
                  setB(BROUILLON_VIDE);
                }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={enCours}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {enCours ? "Creation…" : "Creer et ouvrir"}
              </button>
            </div>
          </form>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {entreprises.map((e) => {
          const estActive = e.id === active?.id;
          return (
            <Card key={e.id} className="flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                      <Icon name="entreprise" className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-slate-800">
                        {e.raisonSociale}
                      </div>
                      <div className="text-xs text-slate-500">
                        {LIBELLE_FORME_JURIDIQUE[e.formeJuridique]}
                        {e.secteur ? ` · ${e.secteur}` : ""}
                      </div>
                    </div>
                  </div>
                </div>
                {estActive && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Active
                  </span>
                )}
              </div>

              <div className="mt-3">
                <RegimeBadge regimeComptable={e.regimeComptable} regimeFiscal={e.regimeFiscal} />
              </div>
              {(e.ninea || e.telephone || e.email) && (
                <div className="mt-2 space-y-0.5 text-xs text-slate-400">
                  {e.ninea && <div>NINEA {e.ninea}</div>}
                  {(e.telephone || e.email) && (
                    <div className="truncate">
                      {[e.telephone, e.email].filter(Boolean).join(" · ")}
                    </div>
                  )}
                </div>
              )}

              <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => ouvrir(e.id)}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
                >
                  Ouvrir
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (
                      window.confirm(
                        `Supprimer « ${e.raisonSociale} » du portefeuille ? Les donnees de cette entreprise seront perdues.`,
                      )
                    ) {
                      await supprimer(e.id);
                    }
                  }}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-red-600"
                  aria-label="Supprimer"
                >
                  <Icon name="close" className="h-4 w-4" />
                </button>
              </div>

              <InvitationEntreprise entrepriseId={e.id} />
            </Card>
          );
        })}
      </div>

      {entreprises.length === 0 && !formOuvert && (
        <Card className="p-10 text-center">
          <p className="text-sm text-slate-500">
            Aucune entreprise pour l'instant. Creez votre premier dossier client.
          </p>
        </Card>
      )}
    </div>
  );
}

const INPUT =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

function Champ({
  label,
  obligatoire,
  children,
}: {
  label: string;
  obligatoire?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">
        {label}
        {obligatoire && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  );
}

function OptionProfil({
  valeur,
  actif,
  onClick,
  titre,
  detail,
}: {
  valeur: ProfilEntreprise;
  actif: boolean;
  onClick: () => void;
  titre: string;
  detail: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={actif}
      className={`rounded-lg border p-3 text-left transition-colors ${
        actif
          ? "border-brand-500 bg-brand-50/50 ring-1 ring-brand-500"
          : "border-slate-300 hover:bg-slate-50"
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`flex h-4 w-4 items-center justify-center rounded-full border ${
            actif ? "border-brand-600 bg-brand-600" : "border-slate-400"
          }`}
        >
          {actif && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
        </span>
        <span className="text-sm font-semibold text-slate-800">{titre}</span>
      </div>
      <p className="mt-1 pl-6 text-xs text-slate-500">{detail}</p>
    </button>
  );
}
