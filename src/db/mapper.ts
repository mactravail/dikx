/**
 * Mapper PUR : lignes Supabase -> DossierInput (consommable par le moteur).
 *
 * Pont entre la couche stockage (snake_case, bigint) et le domaine du moteur
 * (camelCase, number). Aucune I/O : n8n / l'Edge Function lit les lignes, appelle
 * ce mapper, puis genererDossier + genererPDF.
 */

import type {
  DossierInput,
  Investissement,
  NatureInvestissement,
  PostePersonnel,
  ProduitDetaille,
  OverrideParametres,
} from "../types/dossier-input.js";
import type {
  DossierRow,
  InvestissementRow,
  PostePersonnelRow,
  ProduitRow,
} from "./types.js";

const NATURE: Record<InvestissementRow["nature"], NatureInvestissement> = {
  terrain: "terrain",
  construction: "construction",
  materiel: "materiel",
  mobilier: "mobilier",
  informatique: "informatique",
  vehicule: "vehicule",
  frais_etablissement: "fraisEtablissement",
  autre: "autre",
};

export function construireDossierInput(
  d: DossierRow,
  investissements: InvestissementRow[],
  postes: PostePersonnelRow[],
  produits: ProduitRow[],
): DossierInput {
  return {
    // Bloc 0
    nomProjet: d.nom_projet ?? "",
    secteur: d.secteur ?? "",
    formeJuridique: d.forme_juridique,
    moisDemarrage: {
      mois: d.mois_demarrage_mois ?? 1,
      annee: d.mois_demarrage_annee ?? new Date().getFullYear(),
    },
    assujettiTVA: d.assujetti_tva,

    // Bloc 1
    investissements: trier(investissements).map(mapInvestissement),

    // Bloc 2
    financement: {
      apportCapital: nombre(d.apport_capital),
      apportCompteCourant: nombre(d.apport_compte_courant),
      subventionInvestissement: nombre(d.subvention_investissement),
      emprunt: d.emprunt_present
        ? {
            montant: nombre(d.emprunt_montant),
            tauxAnnuel: nombre(d.emprunt_taux_annuel),
            dureeAnnees: d.emprunt_duree_annees ?? 0,
            differeMois: d.emprunt_differe_mois ?? 0,
          }
        : null,
    },

    // Bloc 3
    chiffreAffaires: {
      mode: d.ca_mode,
      ...(d.ca_montant_annee1 != null ? { montantAnnee1: nombre(d.ca_montant_annee1) } : {}),
      ...(d.ca_mode === "detaille"
        ? { produits: trier(produits).map(mapProduit) }
        : {}),
      tauxCroissance: nombre(d.ca_taux_croissance),
      saisonnier: d.ca_saisonnier,
      ...(d.ca_repartition_mensuelle != null
        ? { repartitionMensuelle: d.ca_repartition_mensuelle.map(Number) }
        : {}),
    },

    // Bloc 4
    charges: {
      achatsMatieres: {
        mode: d.achats_mode === "pourcentage_ca" ? "pourcentageCA" : "montant",
        valeur: nombre(d.achats_valeur),
      },
      loyerMensuel: nombre(d.loyer_mensuel),
      eauElectriciteMensuel: nombre(d.eau_electricite_mensuel),
      telecomMensuel: nombre(d.telecom_mensuel),
      transportCarburantAnnuel: nombre(d.transport_carburant_annuel),
      assurancesAnnuel: nombre(d.assurances_annuel),
      honorairesAnnuel: nombre(d.honoraires_annuel),
      marketingAnnuel: nombre(d.marketing_annuel),
      entretienDiversAnnuel: nombre(d.entretien_divers_annuel),
      impotsTaxesAnnuel: nombre(d.impots_taxes_annuel),
    },

    // Bloc 5
    personnel: trier(postes).map(mapPoste),
    salaireDirigeant:
      d.salaire_dirigeant_mensuel != null
        ? { montantMensuel: nombre(d.salaire_dirigeant_mensuel) }
        : null,

    // Bloc 6
    delais: {
      delaiClientsJours: d.delai_clients_jours,
      delaiFournisseursJours: d.delai_fournisseurs_jours,
      delaiStockJours: d.delai_stock_jours,
    },

    // Bloc 7 — override seulement si au moins un taux est fourni
    ...mapOverrides(d),
  };
}

function mapInvestissement(i: InvestissementRow): Investissement {
  return {
    nature: NATURE[i.nature],
    ...(i.libelle != null ? { libelle: i.libelle } : {}),
    montantHT: nombre(i.montant_ht),
    ...(i.duree_amortissement != null ? { dureeAmortissement: i.duree_amortissement } : {}),
  };
}

function mapPoste(p: PostePersonnelRow): PostePersonnel {
  return {
    intitule: p.intitule,
    nombre: p.nombre,
    salaireBrutMensuel: nombre(p.salaire_brut_mensuel),
  };
}

function mapProduit(p: ProduitRow): ProduitDetaille {
  return {
    libelle: p.libelle,
    prixUnitaire: nombre(p.prix_unitaire),
    quantiteAnnee1: nombre(p.quantite_annee1),
  };
}

function mapOverrides(d: DossierRow): { parametres?: OverrideParametres } {
  const o: OverrideParametres = {};
  if (d.taux_tva_override != null) o.tauxTVA = nombre(d.taux_tva_override);
  if (d.taux_is_override != null) o.tauxIS = nombre(d.taux_is_override);
  if (d.taux_charges_sociales_override != null) {
    o.tauxChargesSocialesPatronales = nombre(d.taux_charges_sociales_override);
  }
  return Object.keys(o).length > 0 ? { parametres: o } : {};
}

/** Trie une liste d'elements de boucle par `ordre` croissant (copie). */
function trier<T extends { ordre: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.ordre - b.ordre);
}

/** Normalise un bigint/numeric (number ou string) en number. */
function nombre(v: number | string | null | undefined): number {
  if (v == null) return 0;
  return typeof v === "number" ? v : Number(v);
}
