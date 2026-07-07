/**
 * Rendu HTML PUR du tableau de bord (donnees en entree -> HTML en sortie).
 * Aucune I/O, aucun appel reseau : les listes sont fournies par l'appelant
 * (le serveur les lit depuis Supabase). Testable sans service externe.
 */

import { echapperHTML } from "../pdf/format.js";

export interface DossierListe {
  id: string;
  nomProjet: string | null;
  secteur: string | null;
  formeJuridique: string;
  statut: string;
  telephone: string | null;
  creeLe: string;
}

export interface ConversationListe {
  id: string;
  telephone: string;
  statut: string;
  etapeCourante: string | null;
  dernierMessage: string | null;
  creeLe: string;
}

export interface GenerationListe {
  id: string;
  dossierNom: string | null;
  statut: string;
  emailDestinataire: string | null;
  emailEnvoyeAt: string | null;
  erreur: string | null;
  creeLe: string;
}

export interface DashboardData {
  dossiers: DossierListe[];
  conversations: ConversationListe[];
  generations: GenerationListe[];
  /** false => l'UI affiche un encart « configurer Supabase ». */
  supabaseConfigure: boolean;
  /** message d'erreur de lecture, le cas echeant. */
  erreur?: string | null;
}

/** Date ISO -> "JJ/MM/AAAA HH:mm" (UTC, deterministe). "—" si absente. */
function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return echapperHTML(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${p(
    d.getUTCHours(),
  )}:${p(d.getUTCMinutes())}`;
}

/** Couleur d'un badge de statut (fond, texte). */
function couleurStatut(statut: string): { bg: string; fg: string } {
  switch (statut) {
    case "envoye":
    case "terminee":
      return { bg: "#e3f5e9", fg: "#1b7a3d" };
    case "genere":
    case "en_recapitulatif":
      return { bg: "#e6f0fb", fg: "#1d4e89" };
    case "erreur":
    case "abandonnee":
      return { bg: "#fde7e7", fg: "#b3261e" };
    case "en_cours":
    case "en_attente":
    default:
      return { bg: "#fdf3e1", fg: "#9a6700" };
  }
}

function badge(statut: string): string {
  const { bg, fg } = couleurStatut(statut);
  return `<span class="badge" style="background:${bg};color:${fg}">${echapperHTML(statut)}</span>`;
}

function texte(v: string | null | undefined): string {
  return v == null || v === "" ? "—" : echapperHTML(v);
}

function tableDossiers(rows: DossierListe[]): string {
  if (rows.length === 0) return `<p class="vide">Aucun dossier.</p>`;
  const lignes = rows
    .map(
      (d) => `
      <tr>
        <td><a href="/dossier/${encodeURIComponent(d.id)}">${texte(d.nomProjet)}</a></td>
        <td>${texte(d.secteur)}</td>
        <td>${texte(d.formeJuridique)}</td>
        <td>${texte(d.telephone)}</td>
        <td>${badge(d.statut)}</td>
        <td>${formatDate(d.creeLe)}</td>
        <td class="actions">
          <a href="/dossier/${encodeURIComponent(d.id)}">Aperçu</a>
          <a href="/dossier/${encodeURIComponent(d.id)}.pdf">PDF</a>
          <a href="/dossier/${encodeURIComponent(d.id)}.json">JSON</a>
        </td>
      </tr>`,
    )
    .join("");
  return `
    <table>
      <thead><tr>
        <th>Projet</th><th>Secteur</th><th>Forme</th><th>Téléphone</th>
        <th>Statut</th><th>Créé le</th><th>Actions</th>
      </tr></thead>
      <tbody>${lignes}</tbody>
    </table>`;
}

function tableConversations(rows: ConversationListe[]): string {
  if (rows.length === 0) return `<p class="vide">Aucune conversation.</p>`;
  const lignes = rows
    .map(
      (c) => `
      <tr>
        <td>${texte(c.telephone)}</td>
        <td>${badge(c.statut)}</td>
        <td>${texte(c.etapeCourante)}</td>
        <td>${formatDate(c.dernierMessage)}</td>
        <td>${formatDate(c.creeLe)}</td>
      </tr>`,
    )
    .join("");
  return `
    <table>
      <thead><tr>
        <th>Téléphone</th><th>Statut</th><th>Étape</th>
        <th>Dernier message</th><th>Créée le</th>
      </tr></thead>
      <tbody>${lignes}</tbody>
    </table>`;
}

function tableGenerations(rows: GenerationListe[]): string {
  if (rows.length === 0) return `<p class="vide">Aucune génération.</p>`;
  const lignes = rows
    .map(
      (g) => `
      <tr>
        <td>${texte(g.dossierNom)}</td>
        <td>${badge(g.statut)}</td>
        <td>${texte(g.emailDestinataire)}</td>
        <td>${formatDate(g.emailEnvoyeAt)}</td>
        <td class="err">${texte(g.erreur)}</td>
        <td>${formatDate(g.creeLe)}</td>
      </tr>`,
    )
    .join("");
  return `
    <table>
      <thead><tr>
        <th>Projet</th><th>Statut</th><th>Email</th>
        <th>Envoyé le</th><th>Erreur</th><th>Créée le</th>
      </tr></thead>
      <tbody>${lignes}</tbody>
    </table>`;
}

function encartConfig(): string {
  return `
    <div class="encart">
      <strong>Supabase non configuré.</strong>
      Définir <code>SUPABASE_URL</code> et <code>SUPABASE_SERVICE_ROLE_KEY</code>
      (voir <code>.env.example</code>) pour afficher les données réelles.
    </div>`;
}

function encartErreur(message: string): string {
  return `<div class="encart erreur"><strong>Erreur de lecture Supabase :</strong> ${echapperHTML(
    message,
  )}</div>`;
}

/** Page complete du tableau de bord. */
export function genererDashboardHTML(data: DashboardData): string {
  const sections = data.supabaseConfigure
    ? `
      ${data.erreur ? encartErreur(data.erreur) : ""}
      <section>
        <h2>Dossiers <span class="compte">${data.dossiers.length}</span></h2>
        ${tableDossiers(data.dossiers)}
      </section>
      <section>
        <h2>Conversations WhatsApp <span class="compte">${data.conversations.length}</span></h2>
        ${tableConversations(data.conversations)}
      </section>
      <section>
        <h2>Générations (PDF / email) <span class="compte">${data.generations.length}</span></h2>
        ${tableGenerations(data.generations)}
      </section>`
    : encartConfig();

  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Tableau de bord — Prévisionnel financier 5 ans</title>
  <style>
    :root { --brand:#1d4e89; }
    * { box-sizing: border-box; }
    body { margin:0; font-family: Arial, Helvetica, sans-serif; color:#1f2937; background:#f5f6f8; }
    header { background:var(--brand); color:#fff; padding:16px 24px; }
    header h1 { margin:0; font-size:18px; }
    header p { margin:4px 0 0; opacity:.85; font-size:13px; }
    main { padding:24px; max-width:1200px; margin:0 auto; }
    section { background:#fff; border:1px solid #e5e7eb; border-radius:8px; padding:16px 20px; margin-bottom:24px; }
    h2 { font-size:15px; margin:0 0 12px; display:flex; align-items:center; gap:8px; }
    .compte { background:#eef2f7; color:#374151; border-radius:999px; padding:1px 10px; font-size:12px; font-weight:normal; }
    table { width:100%; border-collapse:collapse; font-size:13px; }
    th, td { text-align:left; padding:8px 10px; border-bottom:1px solid #eef0f3; vertical-align:top; }
    th { color:#6b7280; font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:.03em; }
    tbody tr:hover { background:#fafbfc; }
    a { color:var(--brand); text-decoration:none; }
    a:hover { text-decoration:underline; }
    .actions a { margin-right:10px; }
    .badge { display:inline-block; padding:2px 8px; border-radius:999px; font-size:11px; font-weight:600; }
    .vide { color:#9ca3af; font-style:italic; margin:4px 0 0; }
    .err { color:#b3261e; max-width:280px; }
    .encart { background:#fff; border:1px solid #e5e7eb; border-left:4px solid #9a6700; border-radius:8px; padding:16px 20px; }
    .encart.erreur { border-left-color:#b3261e; }
    code { background:#eef2f7; padding:1px 5px; border-radius:4px; font-size:12px; }
  </style>
</head>
<body>
  <header>
    <h1>Tableau de bord — Prévisionnel financier 5 ans</h1>
    <p>Suivi des dossiers, conversations WhatsApp et générations.</p>
  </header>
  <main>${sections}</main>
</body>
</html>`;
}
