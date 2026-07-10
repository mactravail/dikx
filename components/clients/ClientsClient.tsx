"use client";

/**
 * Ecran CLIENTS — repertoire clients (facturation).
 * Collecte et affiche uniquement : aucun montant calcule ici. L'etat est
 * persiste localement (localStorage) en attendant le branchement Supabase.
 */
import { useEffect, useMemo, useState } from "react";
import { Card, PageHeading, StatTile } from "../ui";
import { Icon } from "../icons";
import { Field, Text, Num, Modal, BtnPrimary, BtnGhost, inputCls } from "../ventes/form";
import { store, type ClientLocal } from "../../lib/ventes-data";
import { useEntreprise } from "../../lib/entreprise-context";

function vide(): ClientLocal {
  return {
    id: "",
    raisonSociale: "",
    ninea: "",
    contactNom: "",
    telephone: "",
    email: "",
    ville: "",
    delaiPaiementJours: 30,
    actif: true,
  };
}

export function ClientsClient() {
  const { active } = useEntreprise();
  const entrepriseId = active?.id ?? "";
  const [clients, setClients] = useState<ClientLocal[]>([]);
  const [pret, setPret] = useState(false);
  const [recherche, setRecherche] = useState("");
  const [edition, setEdition] = useState<ClientLocal | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  // Chargement des clients de l'entreprise active (Supabase, RLS).
  useEffect(() => {
    let vivant = true;
    setPret(false);
    (async () => {
      const liste = entrepriseId ? await store.chargerClients(entrepriseId) : [];
      if (!vivant) return;
      setClients(liste);
      setPret(true);
    })();
    return () => {
      vivant = false;
    };
  }, [entrepriseId]);

  const filtres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) =>
      [c.raisonSociale, c.ville, c.contactNom, c.ninea, c.email]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q)),
    );
  }, [clients, recherche]);

  const actifs = clients.filter((c) => c.actif).length;

  async function enregistrer(c: ClientLocal) {
    if (!c.raisonSociale.trim() || !entrepriseId) return;
    try {
      const saved = await store.enregistrerClient(entrepriseId, c);
      setClients((prev) => (c.id ? prev.map((x) => (x.id === c.id ? saved : x)) : [saved, ...prev]));
      setEdition(null);
    } catch (e) {
      setErreur((e as Error).message);
    }
  }

  async function supprimer(id: string) {
    try {
      await store.supprimerClient(id);
      setClients((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      setErreur((e as Error).message);
    }
  }

  if (!entrepriseId) {
    return (
      <div className="mx-auto max-w-5xl">
        <PageHeading titre="Clients" sousTitre="Repertoire clients." />
        <Card className="px-4 py-12 text-center text-sm text-slate-500">
          Selectionnez d&apos;abord une entreprise pour gerer ses clients.
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeading
        titre="Clients"
        sousTitre="Repertoire clients : coordonnees, NINEA et delai de paiement."
        action={
          <BtnPrimary onClick={() => setEdition(vide())}>
            <Icon name="plus" className="h-4 w-4" /> Nouveau client
          </BtnPrimary>
        }
      />

      {erreur && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</div>
      )}
      {!pret && <div className="mb-4 text-sm text-slate-400">Chargement des donnees…</div>}

      <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatTile label="Clients" value={clients.length} icon="clients" />
        <StatTile label="Actifs" value={actifs} icon="clients" />
        <StatTile
          label="Delai moyen"
          value={clients.length ? `${Math.round(clients.reduce((s, c) => s + c.delaiPaiementJours, 0) / clients.length)} j` : "—"}
          hint="Paiement"
          icon="invoice"
        />
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
          <span className="text-slate-400">
            <Icon name="search" className="h-4 w-4" />
          </span>
          <input
            className="w-full text-sm text-slate-800 outline-none placeholder:text-slate-400"
            placeholder="Rechercher un client (nom, ville, NINEA…)"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
          />
        </div>

        {filtres.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-slate-400">
            {clients.length === 0 ? "Aucun client. Ajoutez votre premier client." : "Aucun resultat."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2 font-medium">Raison sociale</th>
                  <th className="px-4 py-2 font-medium">Contact</th>
                  <th className="px-4 py-2 font-medium">Ville</th>
                  <th className="px-4 py-2 font-medium">NINEA</th>
                  <th className="px-4 py-2 text-right font-medium">Delai</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {filtres.map((c) => (
                  <tr key={c.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-slate-800">{c.raisonSociale}</div>
                      {!c.actif && <span className="text-xs text-amber-600">Inactif</span>}
                      {c.email && <div className="text-xs text-slate-400">{c.email}</div>}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      <div>{c.contactNom || "—"}</div>
                      {c.telephone && <div className="text-xs text-slate-400">{c.telephone}</div>}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{c.ville || "—"}</td>
                    <td className="px-4 py-2.5 text-slate-600">{c.ninea || "—"}</td>
                    <td className="px-4 py-2.5 text-right text-slate-600">{c.delaiPaiementJours} j</td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setEdition(c)}
                          className="rounded-lg px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50"
                        >
                          Modifier
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {edition && (
        <ClientForm
          initial={edition}
          onClose={() => setEdition(null)}
          onSave={enregistrer}
        />
      )}
    </div>
  );
}

function ClientForm({
  initial,
  onClose,
  onSave,
}: {
  initial: ClientLocal;
  onClose: () => void;
  onSave: (c: ClientLocal) => void;
}) {
  const [c, setC] = useState<ClientLocal>(initial);
  const up = <K extends keyof ClientLocal>(k: K, v: ClientLocal[K]) =>
    setC((prev) => ({ ...prev, [k]: v }));

  return (
    <Modal
      titre={initial.id ? "Modifier le client" : "Nouveau client"}
      onClose={onClose}
      footer={
        <>
          <BtnGhost onClick={onClose}>Annuler</BtnGhost>
          <BtnPrimary onClick={() => onSave(c)} disabled={!c.raisonSociale.trim()}>
            Enregistrer
          </BtnPrimary>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Raison sociale *" className="sm:col-span-2">
          <Text value={c.raisonSociale} onChange={(v) => up("raisonSociale", v)} placeholder="Ex. Boulangerie La Teranga" />
        </Field>
        <Field label="Contact">
          <Text value={c.contactNom ?? ""} onChange={(v) => up("contactNom", v)} placeholder="Nom du contact" />
        </Field>
        <Field label="Telephone">
          <Text value={c.telephone ?? ""} onChange={(v) => up("telephone", v)} placeholder="+221 …" />
        </Field>
        <Field label="Email">
          <Text value={c.email ?? ""} onChange={(v) => up("email", v)} placeholder="contact@…" />
        </Field>
        <Field label="Ville">
          <Text value={c.ville ?? ""} onChange={(v) => up("ville", v)} placeholder="Dakar" />
        </Field>
        <Field label="NINEA">
          <Text value={c.ninea ?? ""} onChange={(v) => up("ninea", v)} placeholder="Identifiant fiscal" />
        </Field>
        <Field label="Delai de paiement">
          <Num value={c.delaiPaiementJours} suffix="jours" onChange={(n) => up("delaiPaiementJours", n)} />
        </Field>
        <label className="mt-2 flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
          <input type="checkbox" checked={c.actif} onChange={(e) => up("actif", e.target.checked)} />
          Client actif
        </label>
      </div>
    </Modal>
  );
}
