/**
 * `npm run serve` : petit serveur local (module http de Node, sans dependance).
 *
 *   /                      -> dossier d'exemple rendu en HTML
 *   /dossier.pdf           -> dossier d'exemple en PDF (Puppeteer)
 *   /dossier.json          -> DossierOutput de l'exemple (JSON)
 *
 *   /dashboard             -> tableau de bord : dossiers, conversations, generations (Supabase)
 *   /dashboard.json        -> donnees du tableau de bord (JSON)
 *   /dossier/<id>          -> apercu HTML d'un dossier reel (Supabase)
 *   /dossier/<id>.pdf      -> ce dossier en PDF
 *   /dossier/<id>.json     -> DossierOutput de ce dossier (JSON)
 */

import { createServer } from "node:http";
import { chargerEnvLocal } from "./config/env.js";
import { genererDossier } from "./index.js";
import { exempleBoulangerie } from "./examples/boulangerie.js";
import { genererHTML } from "./pdf/template.js";
import { genererPDF } from "./pdf/index.js";
import { lireConfigSupabase } from "./config/supabase.js";
import {
  listerDossiers,
  listerConversations,
  listerGenerations,
  chargerDonneesDossier,
} from "./db/supabase-queries.js";
import { construireDossierInput } from "./db/mapper.js";
import { genererDashboardHTML, type DashboardData } from "./dashboard/template.js";

chargerEnvLocal();

const PORT = Number(process.env.PORT ?? 3000);

function calculer() {
  return genererDossier(exempleBoulangerie, {
    dateGeneration: new Date("2026-01-01T00:00:00.000Z"),
  });
}

const BANNIERE = `
<div class="no-print" style="position:fixed;top:0;left:0;right:0;background:#1d4e89;color:#fff;
  padding:8px 16px;font-family:Arial,sans-serif;font-size:13px;z-index:1000;display:flex;gap:16px;align-items:center">
  <strong>Apercu dossier</strong>
  <a href="/dashboard" style="color:#fff">Tableau de bord</a>
  <a href="/" style="color:#fff">HTML</a>
  <a href="/dossier.pdf" style="color:#fff">PDF</a>
  <a href="/dossier.json" style="color:#fff">JSON</a>
  <span style="margin-left:auto;opacity:.85">Boulangerie La Teranga &mdash; exemple</span>
</div>
<style>body{margin-top:46px}@media print{.no-print{display:none!important}body{margin-top:0}}</style>
`;

function htmlAvecBanniere(): string {
  return genererHTML(calculer()).replace("</body>", `${BANNIERE}</body>`);
}

/** Lit les trois listes depuis Supabase, en degradant proprement si besoin. */
async function chargerDashboard(): Promise<DashboardData> {
  if (!lireConfigSupabase()) {
    return { dossiers: [], conversations: [], generations: [], supabaseConfigure: false };
  }
  try {
    const [dossiers, conversations, generations] = await Promise.all([
      listerDossiers(),
      listerConversations(),
      listerGenerations(),
    ]);
    return { dossiers, conversations, generations, supabaseConfigure: true, erreur: null };
  } catch (e) {
    return {
      dossiers: [],
      conversations: [],
      generations: [],
      supabaseConfigure: true,
      erreur: (e as Error).message,
    };
  }
}

type FormatDossier = "html" | "pdf" | "json";

/** Decoupe `/dossier/<id>[.pdf|.json]` en { id, format }, ou null si non concerne. */
function routeDossier(chemin: string): { id: string; format: FormatDossier } | null {
  if (!chemin.startsWith("/dossier/")) return null;
  let reste = chemin.slice("/dossier/".length);
  let format: FormatDossier = "html";
  if (reste.endsWith(".pdf")) {
    reste = reste.slice(0, -4);
    format = "pdf";
  } else if (reste.endsWith(".json")) {
    reste = reste.slice(0, -5);
    format = "json";
  }
  const id = decodeURIComponent(reste);
  return id ? { id, format } : null;
}

async function servirDossier(
  id: string,
  format: FormatDossier,
  res: import("node:http").ServerResponse,
): Promise<void> {
  if (!lireConfigSupabase()) {
    res.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
    res.end("Supabase non configure (voir .env.example).");
    return;
  }
  const donnees = await chargerDonneesDossier(id);
  if (!donnees) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Dossier introuvable : " + id);
    return;
  }
  const input = construireDossierInput(
    donnees.dossier,
    donnees.investissements,
    donnees.postes,
    donnees.produits,
  );
  const dossier = genererDossier(input);

  if (format === "json") {
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(dossier, null, 2));
    return;
  }
  if (format === "pdf") {
    const pdf = await genererPDF(dossier);
    res.writeHead(200, {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="dossier-${id}.pdf"`,
    });
    res.end(Buffer.from(pdf));
    return;
  }
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(genererHTML(dossier));
}

const server = createServer(async (req, res) => {
  const chemin = (req.url ?? "/").split("?")[0] ?? "/";
  try {
    if (chemin === "/" || chemin === "/index.html") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(htmlAvecBanniere());
      return;
    }
    if (chemin === "/dashboard" || chemin === "/dashboard.html") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(genererDashboardHTML(await chargerDashboard()));
      return;
    }
    if (chemin === "/dashboard.json") {
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(await chargerDashboard(), null, 2));
      return;
    }
    const rd = routeDossier(chemin);
    if (rd) {
      await servirDossier(rd.id, rd.format, res);
      return;
    }
    if (chemin === "/dossier.json") {
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(calculer(), null, 2));
      return;
    }
    if (chemin === "/dossier.pdf") {
      const pdf = await genererPDF(calculer());
      res.writeHead(200, {
        "content-type": "application/pdf",
        "content-disposition": 'inline; filename="dossier-exemple.pdf"',
      });
      res.end(Buffer.from(pdf));
      return;
    }
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Introuvable. Routes : /  /dashboard  /dossier/<id>  /dossier.pdf  /dossier.json");
  } catch (e) {
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    res.end("Erreur : " + (e as Error).message);
  }
});

server.listen(PORT, () => {
  console.log(`Serveur pret : http://localhost:${PORT}`);
  console.log(`  /             -> dossier d'exemple (HTML)`);
  console.log(`  /dashboard    -> tableau de bord (dossiers / conversations / generations)`);
  console.log(`  /dossier/<id> -> apercu d'un dossier reel (+ .pdf / .json)`);
});
