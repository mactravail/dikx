/**
 * Serveur de l'app dikx — version web (interface principale).
 *
 * Sert le frontend statique (/web) et expose l'API HTTP qui appelle le moteur.
 * Le frontend ne calcule AUCUN chiffre : il collecte les reponses, les envoie
 * ici, et affiche ce que le moteur renvoie. Aucun taux n'est embarque cote client.
 *
 *   GET  /                    -> landing page (landing.html)
 *   GET  /app                 -> app dikx (formulaire guide, index.html)
 *   GET  /login               -> page de connexion (login.html)
 *   POST /api/auth/login      -> { email, password } -> session (cookie httpOnly)
 *   POST /api/auth/signup     -> { email, password, nom? } -> creation de compte
 *   POST /api/auth/reset      -> { email } -> email de reinitialisation
 *   GET  /styles.css /app.js  -> assets statiques du frontend
 *   GET  /api/exemple         -> DossierInput d'exemple (prefill du formulaire)
 *   POST /api/dossier         -> DossierInput (JSON) -> { ok, output }
 *   POST /api/dossier/html    -> DossierInput (JSON) -> dossier complet en HTML
 *   POST /api/dossier/pdf     -> DossierInput (JSON) -> PDF (Puppeteer)
 *
 * Zero dependance nouvelle : uniquement le module http de Node + le moteur.
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve, extname, sep } from "node:path";

import { chargerEnvLocal } from "./config/env.js";
import { genererDossier } from "./index.js";
import { genererHTML } from "./pdf/template.js";
import { genererPDF } from "./pdf/index.js";
import { exempleBoulangerie } from "./examples/boulangerie.js";
import type { DossierInput } from "./types/dossier-input.js";
import {
  connexion,
  inscription,
  reinitialisation,
  lireConfigAuth,
  type Session,
} from "./config/supabase-auth.js";

chargerEnvLocal();

const WEB_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "web");
const PORT = Number(process.env.PORT ?? 3000);

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

/** Concatene le corps de la requete et le parse en JSON (objet vide si vide). */
async function lireCorpsJSON(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const brut = Buffer.concat(chunks).toString("utf-8");
  return brut ? JSON.parse(brut) : {};
}

function envoyerJSON(res: ServerResponse, code: number, data: unknown): void {
  res.writeHead(code, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

/**
 * Pose les cookies de session (httpOnly : invisibles au JS du navigateur).
 * Le frontend ne manipule aucun token ; il se contente d'etre redirige.
 */
function poserCookieSession(res: ServerResponse, session: Session): void {
  const commun = "Path=/; HttpOnly; SameSite=Lax";
  res.setHeader("Set-Cookie", [
    // access token : courte duree (~1h cote Supabase).
    `dikx_session=${encodeURIComponent(session.accessToken)}; ${commun}; Max-Age=3600`,
    // refresh token : plus long, pour renouveler la session (7 jours).
    `dikx_refresh=${encodeURIComponent(session.refreshToken)}; ${commun}; Max-Age=604800`,
  ]);
}

/** Route les appels /api/auth/*. Renvoie true si la requete a ete traitee. */
async function traiterAuth(
  chemin: string,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  if (!chemin.startsWith("/api/auth/")) return false;

  if (!lireConfigAuth()) {
    envoyerJSON(res, 503, {
      ok: false,
      error: "Authentification indisponible : Supabase non configure (voir .env.example).",
    });
    return true;
  }

  const corps = (await lireCorpsJSON(req)) as {
    email?: string;
    password?: string;
    nom?: string;
  };
  const email = (corps.email ?? "").trim();
  const password = corps.password ?? "";

  try {
    if (chemin === "/api/auth/login") {
      const session = await connexion(email, password);
      poserCookieSession(res, session);
      envoyerJSON(res, 200, { ok: true, email: session.email });
      return true;
    }
    if (chemin === "/api/auth/signup") {
      const { confirmationRequise, session } = await inscription(email, password, corps.nom);
      if (session) poserCookieSession(res, session);
      envoyerJSON(res, 200, { ok: true, confirmationRequise });
      return true;
    }
    if (chemin === "/api/auth/reset") {
      await reinitialisation(email);
      envoyerJSON(res, 200, { ok: true });
      return true;
    }
  } catch (e) {
    // 401 : identifiants refuses ou requete d'auth rejetee par Supabase.
    envoyerJSON(res, 401, { ok: false, error: (e as Error).message });
    return true;
  }

  envoyerJSON(res, 404, { ok: false, error: "Route d'authentification inconnue." });
  return true;
}

/** Sert un fichier de /web ; renvoie false si absent ou hors du dossier (anti-traversal). */
async function servirStatique(chemin: string, res: ServerResponse): Promise<boolean> {
  const nom = chemin === "/" ? "landing.html" : chemin.replace(/^\/+/, "");
  const fichier = resolve(WEB_DIR, nom);
  if (fichier !== WEB_DIR && !fichier.startsWith(WEB_DIR + sep)) return false;
  try {
    const contenu = await readFile(fichier);
    res.writeHead(200, {
      "content-type": MIME[extname(fichier).toLowerCase()] ?? "application/octet-stream",
    });
    res.end(contenu);
    return true;
  } catch {
    return false;
  }
}

const server = createServer(async (req, res) => {
  const chemin = (req.url ?? "/").split("?")[0] ?? "/";
  const methode = (req.method ?? "GET").toUpperCase();

  try {
    // ---- API : authentification (login / signup / reset) ----
    if (methode === "POST" && (await traiterAuth(chemin, req, res))) return;

    // ---- App dikx / formulaire guide (URL propre) ----
    if (methode === "GET" && chemin === "/app") {
      if (await servirStatique("/index.html", res)) return;
    }

    // ---- Page de connexion (URL propre) ----
    if (methode === "GET" && chemin === "/login") {
      if (await servirStatique("/login.html", res)) return;
    }

    // ---- API : jeu de donnees d'exemple (prefill) ----
    if (methode === "GET" && chemin === "/api/exemple") {
      envoyerJSON(res, 200, exempleBoulangerie);
      return;
    }

    // ---- API : generation (JSON / HTML / PDF) ----
    const routesGeneration = ["/api/dossier", "/api/dossier/html", "/api/dossier/pdf"];
    if (methode === "POST" && routesGeneration.includes(chemin)) {
      const input = (await lireCorpsJSON(req)) as DossierInput;

      let dossier;
      try {
        dossier = genererDossier(input);
      } catch (e) {
        // 422 : l'entree est invalide / incoherente pour le moteur.
        envoyerJSON(res, 422, { ok: false, error: (e as Error).message });
        return;
      }

      if (chemin === "/api/dossier") {
        envoyerJSON(res, 200, { ok: true, output: dossier });
        return;
      }
      if (chemin === "/api/dossier/html") {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(genererHTML(dossier));
        return;
      }
      // /api/dossier/pdf
      try {
        const pdf = await genererPDF(dossier);
        res.writeHead(200, {
          "content-type": "application/pdf",
          "content-disposition": 'inline; filename="previsionnel-dikx.pdf"',
        });
        res.end(Buffer.from(pdf));
      } catch (e) {
        // 501 : rendu PDF indisponible (ex. Puppeteer/Chromium absent).
        envoyerJSON(res, 501, { ok: false, error: (e as Error).message });
      }
      return;
    }

    // ---- Frontend statique ----
    if (methode === "GET" && (await servirStatique(chemin, res))) return;

    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Introuvable.");
  } catch (e) {
    envoyerJSON(res, 500, { ok: false, error: (e as Error).message });
  }
});

server.listen(PORT, () => {
  console.log(`App dikx (web) prete : http://localhost:${PORT}`);
});
