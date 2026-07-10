"use server";

/**
 * Persistance du module RH dans Supabase (table `employes`, 0004 + entreprise_id
 * 0011), sous RLS scopee par entreprise. Le snapshot de paie (net a payer, cout
 * employeur) est calcule PAR LE MOTEUR cote serveur (calculerPaie) a l'ecriture,
 * jamais dans le navigateur.
 */
import { creerClientServeur } from "@/lib/supabase/server";
import { roleCourantServeur } from "@/lib/roles-serveur";
import { calculerPaie, PARAMETRES } from "@/lib/engine";
import type { EmployeLocal, TypeContrat } from "@/lib/organisation-data";
import type { EtatTransmission } from "@/lib/transmission";

/** Etat de transmission a poser a l'insert selon le role (cf. 0013). */
function transmissionInitiale(role: string): { transmission: "brouillon" | "envoye"; transmis_le: string | null } {
  return role === "comptable"
    ? { transmission: "envoye", transmis_le: new Date().toISOString() }
    : { transmission: "brouillon", transmis_le: null };
}

const MSG_VERROU_EMPLOYE = "Cet employe a deja ete envoye au comptable. Rappelez-le pour le modifier.";

interface EmployeRow {
  id: string;
  nom: string;
  poste: string | null;
  type_contrat: TypeContrat;
  date_embauche: string | null;
  telephone: string | null;
  actif: boolean;
  salaire_brut_mensuel: number;
  primes: number;
  autres_retenues: number;
  net_a_payer: number;
  cout_employeur: number;
  transmission: EtatTransmission;
}

const COLS =
  "id,nom,poste,type_contrat,date_embauche,telephone,actif,salaire_brut_mensuel,primes,autres_retenues,net_a_payer,cout_employeur,transmission";

function versEmploye(r: EmployeRow): EmployeLocal {
  return {
    id: r.id,
    nom: r.nom,
    poste: r.poste ?? "",
    typeContrat: r.type_contrat,
    dateEmbauche: r.date_embauche ?? "",
    telephone: r.telephone ?? undefined,
    actif: r.actif,
    salaireBrutMensuel: Number(r.salaire_brut_mensuel),
    primes: Number(r.primes),
    autresRetenues: Number(r.autres_retenues),
    netAPayer: Number(r.net_a_payer),
    coutEmployeur: Number(r.cout_employeur),
    transmission: r.transmission,
  };
}

/** Snapshot moteur d'un employe (net a payer + cout employeur). */
function snapshot(e: EmployeLocal): { netAPayer: number; coutEmployeur: number } {
  const r = calculerPaie(
    [{ salaireBrutMensuel: e.salaireBrutMensuel, primes: e.primes, autresRetenues: e.autresRetenues }],
    {
      tauxCotisationsSalariales: PARAMETRES.chargesSocialesSalariales.taux,
      tauxCotisationsPatronales: PARAMETRES.chargesSocialesPatronales.taux,
    },
  );
  const b = r.bulletins[0];
  return { netAPayer: b?.netAPayer ?? 0, coutEmployeur: b?.coutEmployeur ?? 0 };
}

export async function listerEmployesAction(entrepriseId: string): Promise<EmployeLocal[]> {
  if (!entrepriseId) return [];
  const s = await creerClientServeur();
  const { data, error } = await s
    .from("employes")
    .select(COLS)
    .eq("entreprise_id", entrepriseId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return (data as unknown as EmployeRow[]).map(versEmploye);
}

export async function upsertEmployeAction(entrepriseId: string, e: EmployeLocal): Promise<EmployeLocal> {
  const s = await creerClientServeur();
  const role = await roleCourantServeur();
  const snap = snapshot(e);
  const champs = {
    nom: e.nom.trim(),
    poste: e.poste?.trim() || null,
    type_contrat: e.typeContrat,
    date_embauche: e.dateEmbauche || null,
    telephone: e.telephone?.trim() || null,
    actif: e.actif,
    salaire_brut_mensuel: Math.round(e.salaireBrutMensuel),
    primes: Math.round(e.primes),
    autres_retenues: Math.round(e.autresRetenues),
    net_a_payer: snap.netAPayer,
    cout_employeur: snap.coutEmployeur,
  };
  if (e.id) {
    // Verrou : l'entreprise ne modifie qu'un brouillon (rappel requis sinon).
    let q = s.from("employes").update(champs).eq("id", e.id);
    if (role !== "comptable") q = q.eq("transmission", "brouillon");
    const { data, error } = await q.select(COLS).single();
    if (error || !data) {
      throw new Error(role !== "comptable" ? MSG_VERROU_EMPLOYE : (error?.message ?? "Enregistrement de l'employe impossible."));
    }
    return versEmploye(data as unknown as EmployeRow);
  }
  const { data, error } = await s
    .from("employes")
    .insert({ entreprise_id: entrepriseId, ...champs, ...transmissionInitiale(role) })
    .select(COLS)
    .single();
  if (error || !data) throw new Error(error?.message ?? "Creation de l'employe impossible.");
  return versEmploye(data as unknown as EmployeRow);
}

export async function supprimerEmployeAction(id: string): Promise<void> {
  const s = await creerClientServeur();
  const role = await roleCourantServeur();
  let q = s.from("employes").delete().eq("id", id);
  if (role !== "comptable") q = q.eq("transmission", "brouillon");
  const { data, error } = await q.select("id");
  if (error) throw new Error(error.message);
  if (role !== "comptable" && (!data || data.length === 0)) throw new Error(MSG_VERROU_EMPLOYE);
}
