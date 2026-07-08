# CLAUDE.md — App « raktak » : ERP de gestion d'entreprise (Sénégal / SYSCOHADA)

## Vue d'ensemble

Produit : **raktak**, une **application de gestion d'entreprise (ERP)** pour des entrepreneurs et
PME au **Sénégal**, référentiel **SYSCOHADA révisé**, devise **FCFA (XOF)**. L'app est organisée en
**modules** accessibles depuis un **tableau de bord unifié**.

Le **premier module, opérationnel**, est le **Prévisionnel financier 5 ans** (les 9 tableaux + les
indicateurs bancaires). Les autres modules sont en construction progressive :

- **Ventes** : Facturation (devis/factures/avoirs), Clients, Ventes & CRM.
- **Achats & Stock** : Achats, Fournisseurs, Stocks (matières premières + produits finis),
  Production / MRP.
- **Finance** : Comptabilité (plan comptable SYSCOHADA, journal, grand livre, balance),
  Charges & Dépenses.
- **Organisation** : Ressources humaines (paie), Projets & Tâches.

Canaux de collecte : l'**app raktak** (interface principale) et **WhatsApp** (canal secondaire, via
n8n, pour le prévisionnel). Le workflow n8n n'est pas construit dans ce repo.

> Historique : l'app a démarré comme un générateur de prévisionnel seul. La direction produit est
> désormais un **ERP modulaire** ; le prévisionnel en est le module d'ancrage.

## Règles critiques (non négociables — valables pour TOUS les modules)

1. **Ni l'IA ni le frontend ne calculent JAMAIS un chiffre.** Tout montant du produit
   (prévisionnel, facture, TVA, valorisation de stock, écriture comptable, paie, MRP) vient d'un
   **moteur de calcul déterministe et testé**, exécuté **côté serveur** (moteur `src/` ou server
   action / route). Le frontend collecte et affiche ; il ne calcule pas.
2. **L'argent est manipulé en FCFA entiers** (XOF, 0 décimale). Pas de float naïf pour les sommes
   finales. Arrondi centralisé via `arrondiFCFA()` (voir Conventions).
3. **Aucun taux fiscal ou social en dur dans le code.** Tout taux (TVA, IS, charges sociales,
   durées d'amortissement, barèmes de paie…) vit dans `src/config/parametres.ts`, paramétrable,
   marqué « à valider par un expert ». Le frontend n'embarque aucun taux : il lit ce que le backend
   expose.
4. **WhatsApp = API officielle Business Cloud uniquement.** Jamais de solution non officielle
   (risque de bannissement du numéro).
5. **Tout calcul financier doit avoir des tests unitaires** (Vitest) avec des cas d'entrée/sortie
   vérifiés à la main. Pas de fonctionnalité touchant un montant sans test.

## Architecture

- **App raktak (CE REPO)** — application **Next.js (App Router)** : tableau de bord + tous les
  modules. Rendu serveur + server actions qui appellent le moteur. Auth et données dans **Supabase**.
- **Moteur de calcul (CE REPO, `src/`)** — TypeScript **pur et déterministe** : entrée JSON →
  sortie JSON. Réutilisé tel quel par l'app (et par n8n via une éventuelle API). C'est le cœur.
- **Rendu** — HTML → PDF (prévisionnel, factures…) + affichage dans l'app.
- **WhatsApp (via n8n) — canal secondaire** : conversation IA qui collecte les réponses du
  prévisionnel. Construit dans l'UI n8n, pas ici.

**Ce que Claude Code construit dans ce repo :** le frontend Next.js de tous les modules, les server
actions / API exposant le moteur, le **moteur de calcul par module + ses tests**, le modèle de
données (types + migrations Supabase), la génération PDF, le schéma SQL.

**Ce que Claude Code ne construit PAS :** le workflow n8n lui-même.

## Stack

- **Langage : TypeScript** partout.
- **Frontend / app : Next.js 16 (App Router) + React 19 + Tailwind CSS v4.** Responsive
  (desktop + mobile). Composants dans `/components`, pages dans `/app`.
- **Moteur : TypeScript pur** dans `/src` (aucune dépendance UI/serveur ; importable partout).
- **Base : Supabase** (Postgres + Auth). Schéma versionné en SQL dans `/db/migrations`.
  Accès backend via `service_role` ; RLS deny-by-default.
- **Tests : Vitest** (moteur).
- **PDF :** template HTML → PDF (Puppeteer en local ; à déporter en prod serverless).
- **Déploiement : Vercel** (framework `nextjs`, zéro config de routing custom).

## Structure du projet

```
/app                      Next.js App Router
  layout.tsx              layout racine (html/body + globals.css)
  (app)/                  groupe de routes de l'ERP (sidebar + topbar partagés)
    layout.tsx            -> <AppShell>
    page.tsx              tableau de bord (accueil)
    previsionnel/         module Prévisionnel : page + actions.ts (server action -> moteur)
    facturation/ clients/ crm/ achats/ fournisseurs/ stocks/ production/
    comptabilite/ charges/ rh/ projets/   (modules — pages en construction)
/components                UI React : AppShell, Sidebar, ui.tsx, icons.tsx,
                           ModulePlaceholder, previsionnel/PrevisionnelClient
/lib                       nav.ts (navigation), format.ts (affichage FCFA), engine.ts (pont moteur)
/src                       MOTEUR pur (inchangé, réutilisé par l'app)
  /types /config /engine /pdf   + index.ts (genererDossier) + examples/
/tests                     tests unitaires Vitest du moteur
/db/migrations             SQL Supabase (0001 prévisionnel, 0002 facturation, …)
```

Ancien socle (avant migration Next.js) conservé mais **non déployé** (voir `.vercelignore`) :
`/web` (statique), `api/index.ts`, `src/web-server.ts`, `src/server.ts`. À supprimer une fois la
migration stabilisée.

## Conventions

- **Code en anglais** (noms de variables, fonctions), **commentaires en français** acceptés.
- **Un module = un dossier** sous `app/(app)/<module>` (page) + éventuellement
  `components/<module>/` (UI) + un **moteur par calcul** sous `src/engine/` + tests.
- **Le frontend n'importe le moteur QUE via `lib/engine.ts`** (un seul point d'entrée serveur).
- **Argent :** type `FCFA = number` (entiers). Les intermédiaires peuvent être décimaux ; arrondi à
  l'entier FCFA **uniquement au moment de produire chaque ligne de sortie**, via `arrondiFCFA()`.
- **Pur et déterministe :** les fonctions du moteur ne font pas d'I/O, pas de réseau, pas d'aléatoire.
- **Tests d'abord pour les calculs financiers** : écrire le test chiffré avant d'implémenter.
- **Stockage des totaux :** les tables stockent le **snapshot** calculé par le moteur (jamais un
  total calculé par l'UI).

## Domaine (Sénégal / OHADA)

- Référentiel **SYSCOHADA révisé**, devise **FCFA (XOF)**, **TVA 18 %**.
- Prévisionnel — 9 tableaux : T1 Investissements & financements · T2 Amortissements ·
  T3 Échéancier d'emprunt · T4 Salaires & charges sociales · T5 Compte de résultat 5 ans ·
  T6 SIG (% du CA) · T7 BFR · T8 Plan de financement 5 ans · T9 Budget de trésorerie 12 mois.
  Indicateurs : seuil de rentabilité, CAF, **DSCR**. Modèle d'entrée = `flux-questions-previsionnel-5ans.md`.

## Commandes

- `npm run dev` — lancer l'app raktak (Next.js) en local
- `npm run build` — build de production Next.js
- `npm start` — servir le build
- `npm test` — lancer tous les tests du moteur (Vitest)
- `npm run typecheck` — vérification de types (app + moteur)
- `npm run engine:demo` — exécuter le moteur sur un jeu d'exemple (prévisionnel)

## À ne pas faire

- Ne pas calculer de montants côté LLM/IA **ni côté frontend** (toujours via le moteur serveur).
- Ne pas coder de taux fiscaux/sociaux en dur (toujours via `src/config/parametres.ts`).
- Ne pas utiliser d'API WhatsApp non officielle.
- Ne pas ajouter une fonctionnalité sans test si elle touche un chiffre.
- Ne pas stocker en base un total calculé par l'UI (seulement le snapshot du moteur).

## Définition de « terminé »

Un module/calcul est terminé quand : la (les) fonction(s) de calcul sont pures et testées avec des
valeurs vérifiées à la main, tout arrondi/taux est documenté et paramétrable, l'UI collecte/affiche
sans calculer, et les données persistent correctement dans Supabase.
