# CLAUDE.md — App « dikx » : Prévisionnel Financier 5 ans

## Vue d'ensemble

Produit : **dikx**, une **application** qui génère un **dossier financier prévisionnel sur 5 ans**
pour des entrepreneurs au **Sénégal**. L'utilisateur saisit ses réponses **soit dans l'app dikx
(web/mobile)** — interface principale — **soit via WhatsApp** (canal secondaire). Le système
produit un **PDF** (les 9 tableaux financiers), consultable dans l'app et envoyé par **email**.

Périmètre **v1** = UNIQUEMENT ce générateur de prévisionnel, livré comme une **app** avec deux
canaux de collecte (app + WhatsApp).
**Hors scope v1** (ne PAS construire) : l'ERP comptable, la paie, les modules fiscaux,
la comptabilité quotidienne. On ne touche pas à ça pour l'instant.

## Règles critiques (non négociables)

1. **Ni l'IA ni le frontend ne calculent JAMAIS un chiffre du dossier.** L'IA sert à la
   conversation WhatsApp, l'app sert à la saisie ; TOUS les montants viennent du **moteur de
   calcul déterministe et testé** (backend).
2. **L'argent est manipulé en FCFA entiers** (XOF, 0 décimale). Pas de float naïf pour les
   sommes finales. Politique d'arrondi définie et centralisée (voir Conventions).
3. **Aucun taux fiscal ou social en dur dans le code.** Tout taux (TVA, IS, charges sociales,
   durées d'amortissement) vit dans `src/config/parametres.ts`, paramétrable, marqué
   « à valider par un expert ». Le frontend n'embarque aucun taux : il lit ce que le backend expose.
4. **WhatsApp = API officielle Business Cloud uniquement.** Jamais de solution non officielle
   (risque de bannissement du numéro).
5. **Tout calcul financier doit avoir des tests unitaires** avec des cas d'entrée/sortie connus.

## Architecture

L'app dikx a **deux canaux de collecte** qui alimentent **un seul moteur de calcul**.

1. **Collecte — 2 canaux :**
   - **App dikx (web/mobile) — interface principale (CE REPO)** : formulaire guidé, saisie des
     réponses, suivi de l'avancement, consultation et téléchargement du PDF.
   - **WhatsApp (via n8n) — canal secondaire** : conversation IA qui collecte les mêmes réponses.
     Le workflow est construit dans n8n, pas ici.
2. **Calcul (CE REPO)** — moteur déterministe : entrée = JSON des réponses, sortie = JSON des
   9 tableaux. **Partagé par les deux canaux.** C'est le cœur du produit.
3. **Rendu (CE REPO)** — données → PDF → email, + affichage dans l'app.

L'app et n8n appellent le même moteur via une **API HTTP** (ou Edge Function Supabase). Les
comptes utilisateurs, l'état des dossiers et des conversations sont stockés dans **Supabase**
(Postgres + Auth).

**Ce que Claude Code construit dans ce repo :**
- le **frontend de l'app dikx** (web/mobile) — saisie, suivi, consultation du PDF
- l'**API HTTP** qui expose le moteur (appelée par l'app ET par n8n)
- le modèle de données (types entrée/sortie)
- le moteur de calcul + ses tests
- la génération PDF
- le schéma Supabase (SQL) pour stocker réponses, état de conversation, comptes
- (optionnel) le prompt système de l'agent WhatsApp

**Ce que Claude Code ne construit PAS :** le workflow n8n lui-même (fait dans l'UI n8n).

## Stack

- **Langage : TypeScript** (backend), **HTML/CSS/JS** (frontend), cohérent avec n8n/Node et Supabase.
- **Frontend app (v1) : statique, zéro dépendance** (HTML/CSS/JS dans `/web`), servi par le
  serveur Node. App web **responsive** couvrant desktop et mobile. Migration vers React/Next.js
  ou app native (React Native / Expo) possible plus tard si le besoin le justifie.
- **Backend / API :** Node.js LTS — serveur `src/web-server.ts` (module http natif) qui sert le
  frontend ET expose l'API du moteur. Une Edge Function Supabase peut prendre le relais en prod.
- **Tests :** Vitest.
- **Base : Supabase** (Postgres + Auth). Schéma versionné en SQL.
- **PDF :** template HTML → PDF.

## Structure du projet

```
/web           frontend statique de l'app dikx : index.html, app.js, styles.css
               (formulaire guidé -> résultats -> PDF ; n'embarque aucun taux, ne calcule rien)
/src
  /types         interfaces TypeScript : DossierInput, DossierOutput, les 9 tableaux
  /config        parametres.ts — TOUS les taux paramétrables (TVA, IS, social, amortissement)
  /engine        un fichier par calcul :
                   amortissements.ts, emprunt.ts, resultat.ts, sig.ts,
                   bfr.ts, tresorerie.ts, indicateurs.ts
  /api           ports (interfaces) de la couche API — ports & adapters
  /pdf           génération du PDF
  web-server.ts  serveur : sert /web + API HTTP du moteur (/api/dossier[/html|/pdf])
  index.ts       point d'entrée : DossierInput -> DossierOutput
/tests           tests unitaires par calcul
/db              migrations SQL Supabase
```

## Conventions

- **Code en anglais** (noms de variables, fonctions), **commentaires en français** acceptés.
- **Argent :** un type `FCFA = number` représentant des entiers. Les calculs intermédiaires
  (intérêts, amortissements) peuvent produire des décimales ; on arrondit à l'entier FCFA
  **uniquement au moment de produire chaque ligne de sortie**, via une fonction unique
  `arrondiFCFA()`. Documenter chaque endroit où un arrondi a lieu.
- **Pur et déterministe :** les fonctions du moteur ne font pas d'I/O, pas d'appel réseau,
  pas d'aléatoire. Entrée -> sortie, point. Le **frontend ne fait aucun calcul financier** : il
  envoie les réponses au moteur et affiche les résultats reçus.
- **Tests d'abord pour les calculs financiers** : pour chaque calcul, écrire un test avec un
  exemple chiffré validé à la main AVANT d'implémenter.

## Domaine (Sénégal / OHADA)

- Référentiel **SYSCOHADA révisé**, devise **FCFA (XOF)**, **TVA 18 %**.
- Les 9 tableaux de sortie : T1 Investissements & financements · T2 Amortissements ·
  T3 Échéancier d'emprunt · T4 Salaires & charges sociales · T5 Compte de résultat 5 ans ·
  T6 SIG (% du CA) · T7 BFR · T8 Plan de financement 5 ans · T9 Budget de trésorerie 12 mois.
- Indicateurs : seuil de rentabilité, CAF, **DSCR** (le ratio que regarde le banquier), ratios.
- **La liste exacte des questions et ce que chacune alimente est dans
  `docs/flux-questions-previsionnel-5ans.md`.** Le modèle d'entrée (`DossierInput`) DOIT
  correspondre à ce document.

## Commandes

- `npm test` — lancer tous les tests
- `npm run dev` — exécuter le moteur sur un jeu de données d'exemple
- `npm run dev:web` — lancer l'app dikx (frontend) en local
- `npm run build` — compiler

## À ne pas faire

- Ne pas calculer de montants côté LLM/IA **ni côté frontend**.
- Ne pas coder de taux fiscaux/sociaux en dur (toujours via `src/config/parametres.ts`) — le
  frontend non plus.
- Ne pas commencer l'ERP, la paie ou les modules fiscaux (hors scope v1).
- Ne pas utiliser d'API WhatsApp non officielle.
- Ne pas ajouter une fonctionnalité sans test si elle touche un chiffre du dossier.

## Définition de « terminé »

Une tâche de calcul est terminée quand : la fonction est pure, ses tests passent avec des
valeurs attendues vérifiées à la main, et tout arrondi/taux est documenté et paramétrable.
