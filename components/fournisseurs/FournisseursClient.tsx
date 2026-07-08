"use client";

/**
 * Ecran FOURNISSEURS — repertoire fournisseurs, encours et echeances.
 *
 * L'UI COLLECTE les fournisseurs et leur solde du ; l'agregation des encours et
 * la ventilation echu / a echoir viennent de la server action -> moteur teste
 * (`calculerFournisseurs`). Le navigateur ne somme aucun montant lui-meme.
 * L'etat est persiste localement (localStorage) en attendant Supabase.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { calculerFournisseursAction } from "../../app/(app)/fournisseurs/actions";
import type { ResultatFournisseurs } from "../../lib/engine";
import { store, genId, type FournisseurLocal } from "../../lib/achats-stock-data";
import { Card, PageHeading, StatTile } from "../ui";
import { Icon } from "../icons";
import { Field, Text, Num, Modal, BtnPrimary, BtnGhost } from "../ventes/form";
import { fcfa, dateCourte } from "../../lib/format";

function vide(): FournisseurLocal {
  return {
    id: "",
    nom: "",
    contact: "",
    telephone: "",
    email: "",
    ville: "",
    delaiPaiementJours: 30,
    encours: 0,
    echeance: "",
    actif: true,
  };
}

export function FournisseursClient() {
  const [fournisseurs, setFournisseurs] = useState<FournisseurLocal[]>([]);
  const [pret, setPret] = useState(false);
  const [recherche, setRecherche] = useState("");
  const [resultat, setResultat] = useState<ResultatFournisseurs | null>(null);
  const [edition, setEdition] = useState<FournisseurLocal | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setFournisseurs(store.chargerFournisseurs());
    setPret(true);
  }, []);

  useEffect(() => {
    if (pret) store.sauverFournisseurs(fournisseurs);
  }, [fournisseurs, pret]);

  // Agregation des encours par le moteur (server action), debounce leger.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const r = await calculerFournisseursAction(
        fournisseurs.map((f) => ({ nom: f.nom, encours: f.encours, echeance: f.echeance })),
      );
      if (r.ok) setResultat(r.resultat);
    }, 200);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [fournisseurs]);

  const echuParNom = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const f of resultat?.parFournisseur ?? []) m.set(f.nom, f.echu);
    return m;
  }, [resultat]);

  const filtres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    if (!q) return fournisseurs;
    return fournisseurs.filter((f) =>
      [f.nom, f.ville, f.contact, f.email]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q)),
    );
  }, [fournisseurs, recherche]);

  function enregistrer(f: FournisseurLocal) {
    if (!f.nom.trim()) return;
    setFournisseurs((prev) => {
      if (f.id) return prev.map((x) => (x.id === f.id ? f : x));
      return [{ ...f, id: genId() }, ...prev];
    });
    setEdition(null);
  }

  function supprimer(id: string) {
    setFournisseurs((prev) => prev.filter((f) => f.id !== id));
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeading
        titre="Fournisseurs"
        sousTitre="Repertoire fournisseurs, encours et echeances de paiement."
        action={
          <BtnPrimary onClick={() => setEdition(vide())}>
            <Icon name="plus" className="h-4 w-4" /> Nouveau fournisseur
          </BtnPrimary>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Fournisseurs" value={fournisseurs.length} icon="fournisseurs" />
        <StatTile label="Encours total" value={fcfa(resultat?.totalEncours ?? 0)} hint="Dettes fournisseurs" icon="charges" />
        <StatTile label="Echu" value={fcfa(resultat?.totalEchu ?? 0)} hint="A regler en priorite" icon="invoice" />
        <StatTile label="A echoir" value={fcfa(resultat?.totalAEchoir ?? 0)} hint="Echeances futures" icon="comptabilite" />
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
          <span className="text-slate-400">
            <Icon name="search" className="h-4 w-4" />
          </span>
          <input
            className="w-full text-sm text-slate-800 outline-none placeholder:text-slate-400"
            placeholder="Rechercher un fournisseur (nom, ville, contact…)"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
          />
        </div>

        {filtres.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-slate-400">
            {fournisseurs.length === 0
              ? "Aucun fournisseur. Ajoutez votre premier fournisseur."
              : "Aucun resultat."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2 font-medium">Fournisseur</th>
                  <th className="px-4 py-2 font-medium">Ville</th>
                  <th className="px-4 py-2 text-right font-medium">Delai</th>
                  <th className="px-4 py-2 text-right font-medium">Encours</th>
                  <th className="px-4 py-2 font-medium">Echeance</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {filtres.map((f) => {
                  const echu = echuParNom.get(f.nom) ?? false;
                  return (
                    <tr key={f.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-slate-800">{f.nom}</div>
                        <div className="text-xs text-slate-400">
                          {f.contact || "—"}
                          {f.telephone ? ` · ${f.telephone}` : ""}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">{f.ville || "—"}</td>
                      <td className="px-4 py-2.5 text-right text-slate-600">{f.delaiPaiementJours} j</td>
                      <td className="px-4 py-2.5 text-right font-medium text-slate-800">
                        {f.encours > 0 ? fcfa(f.encours) : "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        {f.echeance ? (
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              f.encours > 0 && echu
                                ? "bg-red-50 text-red-700"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {dateCourte(f.echeance)}
                            {f.encours > 0 && echu ? " · echu" : ""}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setEdition(f)}
                            className="rounded-lg px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50"
                          >
                            Modifier
                          </button>
                          <button
                            type="button"
                            onClick={() => supprimer(f.id)}
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
        Encours, echu et a echoir sont agreges par le moteur (serveur) a la date du jour.
      </p>

      {edition && (
        <FournisseurForm
          initial={edition}
          onClose={() => setEdition(null)}
          onSave={enregistrer}
        />
      )}
    </div>
  );
}

function FournisseurForm({
  initial,
  onClose,
  onSave,
}: {
  initial: FournisseurLocal;
  onClose: () => void;
  onSave: (f: FournisseurLocal) => void;
}) {
  const [f, setF] = useState<FournisseurLocal>(initial);
  const up = <K extends keyof FournisseurLocal>(k: K, v: FournisseurLocal[K]) =>
    setF((prev) => ({ ...prev, [k]: v }));

  return (
    <Modal
      titre={initial.id ? "Modifier le fournisseur" : "Nouveau fournisseur"}
      onClose={onClose}
      footer={
        <>
          <BtnGhost onClick={onClose}>Annuler</BtnGhost>
          <BtnPrimary onClick={() => onSave(f)} disabled={!f.nom.trim()}>
            Enregistrer
          </BtnPrimary>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom / raison sociale *" className="sm:col-span-2">
          <Text value={f.nom} onChange={(v) => up("nom", v)} placeholder="Ex. Grands Moulins de Dakar" />
        </Field>
        <Field label="Contact">
          <Text value={f.contact ?? ""} onChange={(v) => up("contact", v)} placeholder="Nom du contact" />
        </Field>
        <Field label="Telephone">
          <Text value={f.telephone ?? ""} onChange={(v) => up("telephone", v)} placeholder="+221 …" />
        </Field>
        <Field label="Email">
          <Text value={f.email ?? ""} onChange={(v) => up("email", v)} placeholder="contact@…" />
        </Field>
        <Field label="Ville">
          <Text value={f.ville ?? ""} onChange={(v) => up("ville", v)} placeholder="Dakar" />
        </Field>
        <Field label="Delai de paiement">
          <Num value={f.delaiPaiementJours} suffix="jours" onChange={(n) => up("delaiPaiementJours", n)} />
        </Field>
        <Field label="Encours du">
          <Num value={f.encours} suffix="FCFA" onChange={(n) => up("encours", n)} />
        </Field>
        <Field label="Echeance de l'encours">
          <input
            type="date"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            value={f.echeance ?? ""}
            onChange={(e) => up("echeance", e.target.value)}
          />
        </Field>
        <label className="mt-2 flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
          <input type="checkbox" checked={f.actif} onChange={(e) => up("actif", e.target.checked)} />
          Fournisseur actif
        </label>
      </div>
    </Modal>
  );
}
