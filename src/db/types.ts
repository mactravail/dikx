/**
 * Interfaces des lignes telles que retournees par Supabase (cles snake_case).
 * Servent d'entree au mapper qui reconstruit un DossierInput pour le moteur.
 *
 * Les montants bigint peuvent arriver en number ou en string selon le client ;
 * le mapper les normalise (voir mapper.ts). On type donc en `number | string`.
 */

type Montant = number | string;

export interface DossierRow {
  id: string;
  conversation_id: string | null;

  nom_projet: string | null;
  secteur: string | null;
  forme_juridique: "SARL" | "SUARL" | "SA" | "GIE" | "EI";
  mois_demarrage_mois: number | null;
  mois_demarrage_annee: number | null;
  assujetti_tva: boolean;

  apport_capital: Montant;
  apport_compte_courant: Montant;
  subvention_investissement: Montant;
  emprunt_present: boolean;
  emprunt_montant: Montant | null;
  emprunt_taux_annuel: number | string | null;
  emprunt_duree_annees: number | null;
  emprunt_differe_mois: number;

  ca_mode: "simple" | "detaille";
  ca_montant_annee1: Montant | null;
  ca_taux_croissance: number | string;
  ca_saisonnier: boolean;
  ca_repartition_mensuelle: number[] | null;

  achats_mode: "pourcentage_ca" | "montant";
  achats_valeur: number | string;
  loyer_mensuel: Montant;
  eau_electricite_mensuel: Montant;
  telecom_mensuel: Montant;
  transport_carburant_annuel: Montant;
  assurances_annuel: Montant;
  honoraires_annuel: Montant;
  marketing_annuel: Montant;
  entretien_divers_annuel: Montant;
  impots_taxes_annuel: Montant;

  salaire_dirigeant_mensuel: Montant | null;

  delai_clients_jours: number;
  delai_fournisseurs_jours: number;
  delai_stock_jours: number;

  taux_tva_override: number | string | null;
  taux_is_override: number | string | null;
  taux_charges_sociales_override: number | string | null;
}

export interface InvestissementRow {
  dossier_id: string;
  ordre: number;
  nature:
    | "terrain"
    | "construction"
    | "materiel"
    | "mobilier"
    | "informatique"
    | "vehicule"
    | "frais_etablissement"
    | "autre";
  libelle: string | null;
  montant_ht: Montant;
  duree_amortissement: number | null;
}

export interface PostePersonnelRow {
  dossier_id: string;
  ordre: number;
  intitule: string;
  nombre: number;
  salaire_brut_mensuel: Montant;
}

export interface ProduitRow {
  dossier_id: string;
  ordre: number;
  libelle: string;
  prix_unitaire: Montant;
  quantite_annee1: number | string;
}
