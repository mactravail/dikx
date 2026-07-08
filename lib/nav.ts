/**
 * Configuration de la navigation de l'ERP raktak.
 * Une seule source de verite pour la sidebar, le fil d'Ariane et la home.
 *
 * `statut` :
 *   - "actif"   : module operationnel (page fonctionnelle).
 *   - "bientot" : module planifie, page de presentation (roadmap) en attendant.
 */
import type { IconName } from "../components/icons";

export type ModuleStatut = "actif" | "bientot";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  statut: ModuleStatut;
  /** Courte description (home + placeholder). */
  description: string;
  /** Fonctionnalites prevues (page placeholder). */
  fonctionnalites?: string[];
}

export interface NavGroup {
  titre: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    titre: "Pilotage",
    items: [
      {
        href: "/",
        label: "Tableau de bord",
        icon: "dashboard",
        statut: "actif",
        description: "Vue d'ensemble de l'activite et acces a tous les modules.",
      },
      {
        href: "/entreprises",
        label: "Entreprises",
        icon: "entreprise",
        statut: "actif",
        description:
          "Portefeuille des entreprises clientes (formelles et informelles) gerees par le cabinet.",
        fonctionnalites: [
          "Liste des dossiers clients",
          "Creation d'une entreprise (formel / informel)",
          "Regime comptable et fiscal par entreprise",
          "Selection de l'entreprise active",
        ],
      },
      {
        href: "/previsionnel",
        label: "Previsionnel 5 ans",
        icon: "chart",
        statut: "actif",
        description:
          "Genere les 9 tableaux financiers (compte de resultat, tresorerie, plan de financement) et les indicateurs bancaires.",
        fonctionnalites: [
          "Saisie guidee du projet",
          "9 tableaux SYSCOHADA calcules par le moteur",
          "Indicateurs : seuil de rentabilite, CAF, DSCR",
          "Export PDF pret pour la banque",
        ],
      },
      {
        href: "/rapports",
        label: "Rapport financier",
        icon: "rapports",
        statut: "actif",
        description:
          "Assemble un rapport financier complet de l'exercice a partir des donnees de tous les modules (compte de resultat, bilan, tresorerie) et des indicateurs de pilotage.",
        fonctionnalites: [
          "En-tete entreprise (raison sociale, NINEA, RCCM, coordonnees)",
          "Synthese : CA, resultat, marge, FDR, BFR, tresorerie nette (moteur)",
          "Ratios : autonomie, endettement, liquidite, delais clients/fournisseurs",
          "Comparaison N-1 et budget vs realise",
          "Zones redigees par le comptable + export PDF (impression)",
        ],
      },
    ],
  },
  {
    titre: "Ventes",
    items: [
      {
        href: "/facturation",
        label: "Facturation",
        icon: "invoice",
        statut: "actif",
        description: "Devis, factures, avoirs et encaissements.",
        fonctionnalites: [
          "Devis -> facture -> avoir",
          "TVA 18 % et mentions legales SYSCOHADA",
          "Export PDF et envoi par email",
          "Suivi des encaissements et des impayes",
        ],
      },
      {
        href: "/clients",
        label: "Clients",
        icon: "clients",
        statut: "actif",
        description: "Fiches clients, historique et encours.",
        fonctionnalites: [
          "Repertoire clients (NINEA, contacts)",
          "Encours et delai de paiement",
          "Historique des factures et reglements",
        ],
      },
      {
        href: "/crm",
        label: "Ventes & CRM",
        icon: "crm",
        statut: "actif",
        description: "Pipeline commercial, opportunites et relances.",
        fonctionnalites: [
          "Pipeline d'opportunites (kanban)",
          "Relances et activites planifiees",
          "Taux de conversion et prevision de ventes",
        ],
      },
    ],
  },
  {
    titre: "Achats & Stock",
    items: [
      {
        href: "/achats",
        label: "Achats",
        icon: "achats",
        statut: "actif",
        description: "Commandes d'achat et receptions.",
        fonctionnalites: [
          "Demandes et commandes d'achat",
          "Receptions et mise en stock",
          "Suivi des couts d'approvisionnement",
        ],
      },
      {
        href: "/fournisseurs",
        label: "Fournisseurs",
        icon: "fournisseurs",
        statut: "actif",
        description: "Repertoire fournisseurs, encours et delais.",
        fonctionnalites: [
          "Fiches fournisseurs et conditions",
          "Encours et echeances de paiement",
          "Historique des commandes",
        ],
      },
      {
        href: "/stocks",
        label: "Stocks",
        icon: "stocks",
        statut: "actif",
        description: "Matieres premieres, produits finis et valorisation.",
        fonctionnalites: [
          "Stock matieres premieres et produits finis",
          "Mouvements (entrees / sorties / inventaire)",
          "Valorisation (CUMP) calculee par le moteur",
          "Alertes de seuil de reappro",
        ],
      },
      {
        href: "/production",
        label: "Production / MRP",
        icon: "production",
        statut: "actif",
        description: "Nomenclatures, ordres de fabrication et planification MRP.",
        fonctionnalites: [
          "Nomenclatures (BOM) et gammes",
          "Ordres de fabrication",
          "Calcul des besoins (MRP) a partir des ventes",
        ],
      },
    ],
  },
  {
    titre: "Finance",
    items: [
      {
        href: "/tresorerie",
        label: "Tresorerie",
        icon: "tresorerie",
        statut: "actif",
        description: "Banques, caisses et mobile money (Wave, Orange Money...) : ou est l'argent et pourquoi.",
        fonctionnalites: [
          "Comptes : banques, caisses, mobile money (Wave, Orange Money, Ria...)",
          "Mouvements : encaissements / depenses avec motif et categorie",
          "Solde par compte et disponible total (calcules par le moteur)",
          "Repartition des sorties : qu'a-t-on depense et pourquoi",
        ],
      },
      {
        href: "/comptabilite",
        label: "Comptabilite",
        icon: "comptabilite",
        statut: "actif",
        description: "Plan comptable SYSCOHADA, journal, grand livre, balance, bilan.",
        fonctionnalites: [
          "Plan comptable SYSCOHADA revise",
          "Journaux et ecritures (double partie)",
          "Grand livre, balance, compte de resultat, bilan (actif/passif)",
          "Ecritures generees depuis ventes/achats/paie",
        ],
      },
      {
        href: "/charges",
        label: "Charges & Depenses",
        icon: "charges",
        statut: "actif",
        description: "Depenses, categories et recurrences.",
        fonctionnalites: [
          "Saisie des depenses et justificatifs",
          "Categories de charges (loyer, energie, transport...)",
          "Charges recurrentes et repartition analytique",
        ],
      },
    ],
  },
  {
    titre: "Organisation",
    items: [
      {
        href: "/rh",
        label: "Ressources humaines",
        icon: "rh",
        statut: "actif",
        description: "Employes, contrats et paie.",
        fonctionnalites: [
          "Registre du personnel et contrats",
          "Paie : cotisations, net a payer, masse salariale (moteur)",
          "Charges sociales parametrables (a valider par un expert)",
        ],
      },
      {
        href: "/projets",
        label: "Projets & Taches",
        icon: "projets",
        statut: "actif",
        description: "Projets, taches (kanban) et feuilles de temps.",
        fonctionnalites: [
          "Projets et taches (kanban)",
          "Affectation et echeances",
          "Feuilles de temps et suivi d'avancement (moteur)",
        ],
      },
    ],
  },
];

/** Tous les items a plat (recherche d'un module par href). */
export const ALL_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

export function findItem(href: string): NavItem | undefined {
  return ALL_ITEMS.find((i) => i.href === href);
}
