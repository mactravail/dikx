/**
 * Point d'entree serverless Vercel de l'app dikx.
 *
 * Toutes les routes sont reecrites vers cette fonction (voir `vercel.json`) : on
 * delegue au handler unique de l'app (`src/web-server.ts`), le meme code qui tourne
 * en local via `npm run dev:web`. Vercel invoque cette fonction requete par requete
 * (modele serverless) — il ne fait PAS tourner un serveur `listen()` persistant.
 *
 * Le handler est importe depuis le build (`dist/`, produit par `npm run build`,
 * configure comme `buildCommand` cote Vercel) : resolution de modules sans ambiguite.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { handler } from "../dist/web-server.js";

export default async function (req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    await handler(req, res);
  } catch (e) {
    // Filet de securite : le handler gere deja ses erreurs (500), mais on evite
    // qu'une exception inattendue fasse planter la fonction (FUNCTION_INVOCATION_FAILED).
    if (!res.headersSent) {
      res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ ok: false, error: (e as Error).message }));
    }
  }
}
