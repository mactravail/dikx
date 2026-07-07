/**
 * Lectures Supabase pour le tableau de bord (et l'apercu d'un dossier).
 * Couche I/O : appelle PostgREST via restGet, puis projette les lignes en
 * vues simples consommees par le template (pur).
 */

import { restGet } from "../config/supabase.js";
import type {
  DossierListe,
  ConversationListe,
  GenerationListe,
} from "../dashboard/template.js";
import type { DonneesDossier } from "../api/ports.js";
import type {
  DossierRow,
  InvestissementRow,
  PostePersonnelRow,
  ProduitRow,
} from "./types.js";

const LIMITE = 200;

/** Liste des dossiers, du plus recent au plus ancien, avec le telephone associe. */
export async function listerDossiers(): Promise<DossierListe[]> {
  type Ligne = {
    id: string;
    nom_projet: string | null;
    secteur: string | null;
    forme_juridique: string;
    statut: string;
    created_at: string;
    conversations: { telephone: string | null } | null;
  };
  const rows = await restGet<Ligne[]>(
    "dossiers?select=id,nom_projet,secteur,forme_juridique,statut,created_at," +
      "conversations(telephone)&order=created_at.desc&limit=" +
      LIMITE,
  );
  return rows.map((r) => ({
    id: r.id,
    nomProjet: r.nom_projet,
    secteur: r.secteur,
    formeJuridique: r.forme_juridique,
    statut: r.statut,
    telephone: r.conversations?.telephone ?? null,
    creeLe: r.created_at,
  }));
}

/** Liste des conversations WhatsApp. */
export async function listerConversations(): Promise<ConversationListe[]> {
  type Ligne = {
    id: string;
    telephone: string;
    statut: string;
    etape_courante: string | null;
    last_message_at: string | null;
    created_at: string;
  };
  const rows = await restGet<Ligne[]>(
    "conversations?select=id,telephone,statut,etape_courante,last_message_at,created_at" +
      "&order=created_at.desc&limit=" +
      LIMITE,
  );
  return rows.map((r) => ({
    id: r.id,
    telephone: r.telephone,
    statut: r.statut,
    etapeCourante: r.etape_courante,
    dernierMessage: r.last_message_at,
    creeLe: r.created_at,
  }));
}

/** Historique des generations (PDF / email). */
export async function listerGenerations(): Promise<GenerationListe[]> {
  type Ligne = {
    id: string;
    statut: string;
    email_destinataire: string | null;
    email_envoye_at: string | null;
    erreur: string | null;
    created_at: string;
    dossiers: { nom_projet: string | null } | null;
  };
  const rows = await restGet<Ligne[]>(
    "generations?select=id,statut,email_destinataire,email_envoye_at,erreur,created_at," +
      "dossiers(nom_projet)&order=created_at.desc&limit=" +
      LIMITE,
  );
  return rows.map((r) => ({
    id: r.id,
    dossierNom: r.dossiers?.nom_projet ?? null,
    statut: r.statut,
    emailDestinataire: r.email_destinataire,
    emailEnvoyeAt: r.email_envoye_at,
    erreur: r.erreur,
    creeLe: r.created_at,
  }));
}

/**
 * Charge un dossier complet (+ ses boucles) pour l'apercu. `null` si introuvable.
 * Le resultat alimente `construireDossierInput` puis le moteur.
 */
export async function chargerDonneesDossier(id: string): Promise<DonneesDossier | null> {
  const filtre = `dossier_id=eq.${encodeURIComponent(id)}`;
  const [dossiers, investissements, postes, produits] = await Promise.all([
    restGet<DossierRow[]>(`dossiers?select=*&id=eq.${encodeURIComponent(id)}&limit=1`),
    restGet<InvestissementRow[]>(`investissements?select=*&${filtre}&order=ordre`),
    restGet<PostePersonnelRow[]>(`postes_personnel?select=*&${filtre}&order=ordre`),
    restGet<ProduitRow[]>(`produits_ca?select=*&${filtre}&order=ordre`),
  ]);
  const dossier = dossiers[0];
  if (!dossier) return null;
  return { dossier, investissements, postes, produits };
}
