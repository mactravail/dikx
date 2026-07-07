# Flux de questions — Agent WhatsApp « Prévisionnel Financier 5 ans »

Document de conception (v1). C'est le squelette de l'agent : ce qu'il demande, dans quel ordre, et ce que chaque réponse sert à calculer.

---

## Rappel d'architecture (à ne jamais oublier)

L'agent fonctionne en **3 couches** :

1. **Collecte (IA)** — l'agent discute et pose les questions ci-dessous. *C'est la seule couche faite par l'IA.*
2. **Calcul (code déterministe dans n8n)** — formules fiables qui produisent les tableaux. **L'IA ne calcule jamais un chiffre du dossier.**
3. **Rendu (PDF + email)** — mise en forme et envoi.

Les réponses collectées sont stockées (Supabase) au fur et à mesure, pour que l'agent se souvienne où en est la personne entre deux messages WhatsApp.

---

## Les tableaux de sortie (couche 2)

Chaque question alimente un ou plusieurs de ces livrables :

| Réf | Tableau de sortie |
|-----|-------------------|
| T1 | Investissements & financements |
| T2 | Amortissements (détaillés par poste) |
| T3 | Emprunt — échéancier (annuités, intérêts, capital) |
| T4 | Salaires & charges sociales |
| T5 | Compte de résultat prévisionnel 5 ans |
| T6 | SIG (Soldes Intermédiaires de Gestion, en % du CA) |
| T7 | BFR (Besoin en Fonds de Roulement) |
| T8 | Plan de financement emplois/ressources 5 ans |
| T9 | Budget de trésorerie mensuel (12 mois) |
| IND | Indicateurs : seuil de rentabilité, CAF, DSCR, ratios |

---

## BLOC 0 — Identité du projet

L'agent ouvre simplement : *« On va construire ton dossier financier sur 5 ans ensemble. Je te pose des questions simples, tu réponds, et je calcule tout. C'est parti ? »*

| # | Ce que l'agent demande | Format | Défaut | Alimente |
|---|------------------------|--------|--------|----------|
| 0.1 | Nom du projet ou de l'entreprise | texte | — | Page de garde |
| 0.2 | Secteur d'activité | texte | — | Contexte / benchmarks |
| 0.3 | Forme juridique (SARL, SUARL, SA, GIE, entreprise individuelle) | choix | SARL | Régime IS |
| 0.4 | Mois de démarrage prévu | mois/année | — | Point de départ T9 et des 5 ans |
| 0.5 | Assujetti à la TVA (18 %) ? | oui/non | oui | TVA dans T5, T9 |

---

## BLOC 1 — Investissements de départ *(question en boucle)*

L'agent : *« Listons ce que tu dois acheter pour démarrer. On les prend un par un. »*
Pour **chaque** investissement, il répète :

| # | Ce que l'agent demande | Format | Défaut | Alimente |
|---|------------------------|--------|--------|----------|
| 1.1 | Nature (terrain, local/construction, matériel, mobilier, informatique, véhicule, frais d'établissement, autre) | choix | — | T1, T2 |
| 1.2 | Montant HT (FCFA) | nombre | — | T1, T2, T8 |
| 1.3 | Durée d'amortissement (années) | nombre | proposée selon nature* | T2, T5 |
| 1.4 | « Un autre investissement ? » | oui/non | — | (boucle) |

\* Défauts indicatifs à proposer automatiquement : informatique 3 ans · matériel/véhicule 5 ans · mobilier 10 ans · construction 20 ans · **terrain = non amortissable** · frais d'établissement 2–3 ans. *(À confirmer côté barème OHADA.)*

---

## BLOC 2 — Financement

L'agent : *« Comment finances-tu tout ça ? »*

| # | Ce que l'agent demande | Format | Défaut | Alimente |
|---|------------------------|--------|--------|----------|
| 2.1 | Apport personnel / capital (FCFA) | nombre | — | T1, T8 |
| 2.2 | Apport en compte courant d'associés ? | nombre | 0 | T8 |
| 2.3 | Subvention d'investissement ? | nombre | 0 | T8 |
| 2.4 | Emprunt bancaire prévu ? | oui/non | — | déclenche 2.5→2.8 |
| 2.5 | Montant de l'emprunt (FCFA) | nombre | — | T3, T8 |
| 2.6 | Taux d'intérêt annuel (%) | nombre | — | T3, T5 |
| 2.7 | Durée de remboursement (années) | nombre | — | T3 |
| 2.8 | Différé de remboursement ? (mois) | nombre | 0 | T3 |

> Contrôle automatique : **Total financement (2.1→2.5) doit couvrir Total investissements (bloc 1) + le BFR de départ**. Si ça ne boucle pas, l'agent le signale.

---

## BLOC 3 — Chiffre d'affaires prévisionnel

L'agent : *« Parlons de tes ventes. »* Deux modes possibles — l'agent propose le plus simple d'abord :

**Mode simple :** un CA global.
**Mode détaillé :** par produit/service *(boucle)*.

| # | Ce que l'agent demande | Format | Défaut | Alimente |
|---|------------------------|--------|--------|----------|
| 3.1 | CA prévu la 1ʳᵉ année (ou prix unitaire × quantités si mode détaillé) | nombre | — | T5, T6, T9, IND |
| 3.2 | Taux de croissance annuel du CA (%) | nombre | — | T5 (années 2→5) |
| 3.3 | Activité saisonnière ? | oui/non | non | T9 |
| 3.4 | Si oui : répartition sur les 12 mois | profil | égale | T9 |

---

## BLOC 4 — Charges d'exploitation

L'agent : *« Maintenant tes dépenses de fonctionnement. »*
**Important :** l'agent doit ranger chaque charge en **variable** (varie avec le CA) ou **fixe** — c'est indispensable au seuil de rentabilité.

| # | Ce que l'agent demande | Format | Défaut | Type | Alimente |
|---|------------------------|--------|--------|------|----------|
| 4.1 | Achats marchandises / matières (% du CA ou FCFA) | nombre | — | variable | T5, T6, IND |
| 4.2 | Loyer mensuel | nombre | 0 | fixe | T5, IND |
| 4.3 | Eau / électricité (mensuel) | nombre | — | fixe | T5 |
| 4.4 | Télécom / internet (mensuel) | nombre | — | fixe | T5 |
| 4.5 | Transport / carburant | nombre | — | variable | T5 |
| 4.6 | Assurances (annuel) | nombre | — | fixe | T5 |
| 4.7 | Honoraires (comptable, conseil) | nombre | — | fixe | T5 |
| 4.8 | Marketing / publicité | nombre | — | fixe | T5 |
| 4.9 | Entretien / fournitures / divers | nombre | — | fixe | T5 |
| 4.10 | Impôts & taxes (patente, etc.) | nombre | — | fixe | T5 |

---

## BLOC 5 — Personnel & masse salariale *(question en boucle)*

L'agent : *« Combien de personnes, et à quel salaire ? On les prend poste par poste. »*

| # | Ce que l'agent demande | Format | Défaut | Alimente |
|---|------------------------|--------|--------|----------|
| 5.1 | Intitulé du poste | texte | — | T4 |
| 5.2 | Nombre de personnes | nombre | 1 | T4 |
| 5.3 | Salaire brut mensuel / personne | nombre | — | T4, T5 |
| 5.4 | « Un autre poste ? » | oui/non | — | (boucle) |
| 5.5 | Le dirigeant se verse-t-il un salaire ? | oui/non + montant | — | T4, T5 |

> Les **charges patronales** (CSS, IPRES…) sont appliquées automatiquement par la couche calcul via un **taux paramétrable** — *à confirmer avec un expert paie sénégalais, ne pas coder un taux en dur.*

---

## BLOC 6 — Besoin en Fonds de Roulement (BFR)

L'agent : *« Dernières questions, sur tes délais de paiement. »*

| # | Ce que l'agent demande | Format | Défaut | Alimente |
|---|------------------------|--------|--------|----------|
| 6.1 | Tes clients te paient en moyenne sous combien de jours ? | nombre | 0 (comptant) | T7, T9 |
| 6.2 | Tu paies tes fournisseurs sous combien de jours ? | nombre | 30 | T7, T9 |
| 6.3 | Combien de jours de stock gardes-tu ? | nombre | 0 | T7 |

---

## BLOC 7 — Paramètres fiscaux *(l'agent confirme, ne demande pas de saisir)*

L'agent : *« Je pars sur les paramètres standards du Sénégal, tu me dis si on ajuste. »*

| # | Paramètre | Valeur par défaut | Statut |
|---|-----------|-------------------|--------|
| 7.1 | TVA | 18 % | confirmé |
| 7.2 | Impôt sur les sociétés (IS) | 30 % | **à confirmer** |
| 7.3 | Charges patronales globales | taux à fixer | **à confirmer (expert)** |

---

## Ce que la couche calcul produit ensuite (rappel — c'est du code, pas l'IA)

- **T2** Amortissement linéaire : `montant HT / durée` par an et par poste.
- **T3** Échéancier d'emprunt : annuités (constantes ou capital constant), part intérêts / part capital.
- **T5** Compte de résultat 5 ans : CA − charges variables − charges fixes − amortissements − charges financières − IS.
- **T6** SIG : marge commerciale, valeur ajoutée, **EBE**, résultat d'exploitation, résultat net (+ chaque ligne en % du CA).
- **CAF** : résultat net + amortissements.
- **T7** BFR : (stocks + créances clients) − dettes fournisseurs, à partir des délais du bloc 6.
- **Seuil de rentabilité** : `charges fixes / taux de marge sur coûts variables`.
- **T8** Plan de financement : emplois (investissements + BFR + remboursements) vs ressources (apports + emprunt + CAF) sur 5 ans.
- **T9** Budget de trésorerie 12 mois : encaissements − décaissements, mois par mois, en tenant compte des délais et de la saisonnalité.
- **DSCR** (le ratio que regarde le banquier) : `CAF / service de la dette`. Un DSCR ≥ 1,2 rassure la banque.

---

## Principes UX pour que ce soit « simple » (ta priorité)

- **Une question à la fois.** Jamais un pavé de 10 questions d'un coup sur WhatsApp.
- **Défauts intelligents.** L'agent propose toujours une valeur par défaut → la personne peut juste dire « ok ».
- **« Je ne sais pas » accepté.** L'agent propose alors une estimation raisonnable selon le secteur, et le signale dans le dossier.
- **Boucles fluides** pour les listes (investissements, produits, postes) : « Un autre ? Oui / Non ».
- **Garde-fous** : un taux d'intérêt à 200 % ou un CA négatif → l'agent redemande gentiment.
- **Récapitulatif avant génération** : l'agent réaffiche les réponses clés → la personne valide → *puis seulement* le PDF est généré et envoyé.

---

## Points à faire valider par un expert (ne pas inventer)

- Taux exacts des **charges sociales patronales** au Sénégal (CSS, IPRES, et cadres).
- **Taux IS** en vigueur et régimes particuliers.
- **Durées d'amortissement** admises fiscalement (barème OHADA / DGID).
- Traitement TVA des **investissements** (récupération).

*Je peux te faire une recherche à jour sur ces taux quand tu voudras les figer dans le moteur de calcul.*
