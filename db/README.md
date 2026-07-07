# Base de données (Supabase / Postgres)

Schéma versionné qui stocke l'état des conversations WhatsApp (collecte par n8n)
et les réponses qui alimentent le moteur de calcul.

## Migrations

- `migrations/0001_init.sql` — schéma initial.

Les migrations sont **idempotentes par ordre** : appliquer dans l'ordre numérique.

### Appliquer

**Avec le CLI Supabase** (recommandé) — copier/lier le dossier dans `supabase/migrations`
puis :
```bash
supabase db push
```

**Avec psql** (sur la base directement) :
```bash
psql "$DATABASE_URL" -f db/migrations/0001_init.sql
```

## Modèle

```
conversations 1 ──── 0..1 dossiers ──┬── n investissements   (boucle bloc 1)
       │                             ├── n postes_personnel  (boucle bloc 5)
       │                             ├── n produits_ca        (boucle bloc 3 détaillé)
       │                             └── n generations        (PDF + email)
       └── n messages (journal WhatsApp optionnel)
```

- **`dossiers`** est le miroir de `DossierInput` (un champ par réponse des blocs 0,2,3,4,6,7).
- Les **boucles** (investissements, personnel, produits) sont des tables filles
  triées par `ordre`.
- **`generations`** garde une trace de chaque production (snapshot `DossierOutput`,
  chemin du PDF dans Supabase Storage, état d'envoi email).

## Conventions

- **Montants FCFA** : `bigint` (entiers ; un projet peut dépasser la borne d'`int4`).
- **Taux** : `numeric` en fraction (`0.18` = 18 %).
- **Enums** en `snake_case` côté DB ; le mapper TypeScript traduit vers le domaine
  (`frais_etablissement` → `fraisEtablissement`).

## Du stockage au moteur

n8n (ou une Edge Function) lit les lignes, appelle le mapper puis le moteur :

```ts
import { construireDossierInput } from "./src/db/index.js";
import { genererDossier } from "./src/index.js";
import { genererPDF } from "./src/pdf/index.js";

const input = construireDossierInput(dossierRow, investissements, postes, produits);
const dossier = genererDossier(input);
const pdf = await genererPDF(dossier);
// -> écrire `pdf` dans Supabase Storage, insérer une ligne `generations`.
```

## Sécurité

RLS activée sur toutes les tables, **sans policy publique** : seul le backend
(`service_role`, qui contourne la RLS) accède aux données. Les rôles `anon` /
`authenticated` n'ont aucun accès.

## À valider

Les **taux** (IS, charges patronales, durées d'amortissement) restent dans
`src/config/parametres.ts` ; les colonnes `*_override` du dossier ne servent qu'à
forcer un taux différent du défaut pour un dossier précis.
