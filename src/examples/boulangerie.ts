/**
 * Jeu de donnees d'exemple (sans effet de bord) reutilise par dev.ts et pdf-dev.ts.
 */

import type { DossierInput } from "../types/dossier-input.js";

export const exempleBoulangerie: DossierInput = {
  nomProjet: "Boulangerie La Teranga",
  secteur: "Boulangerie - patisserie",
  formeJuridique: "SARL",
  moisDemarrage: { mois: 1, annee: 2026 },
  assujettiTVA: true,

  investissements: [
    { nature: "construction", libelle: "Amenagement du local", montantHT: 8_000_000 },
    { nature: "materiel", libelle: "Four + petrin", montantHT: 6_000_000 },
    { nature: "mobilier", libelle: "Comptoir + vitrines", montantHT: 1_500_000 },
    { nature: "vehicule", libelle: "Tricycle de livraison", montantHT: 2_000_000 },
    { nature: "fraisEtablissement", libelle: "Frais de creation", montantHT: 500_000 },
  ],

  financement: {
    apportCapital: 8_000_000,
    apportCompteCourant: 2_000_000,
    subventionInvestissement: 0,
    emprunt: { montant: 12_000_000, tauxAnnuel: 0.09, dureeAnnees: 5, differeMois: 6 },
  },

  chiffreAffaires: {
    mode: "simple",
    montantAnnee1: 48_000_000,
    tauxCroissance: 0.08,
    saisonnier: false,
  },

  charges: {
    achatsMatieres: { mode: "pourcentageCA", valeur: 0.42 },
    loyerMensuel: 350_000,
    eauElectriciteMensuel: 250_000,
    telecomMensuel: 30_000,
    transportCarburantAnnuel: 1_200_000,
    assurancesAnnuel: 400_000,
    honorairesAnnuel: 600_000,
    marketingAnnuel: 300_000,
    entretienDiversAnnuel: 500_000,
    impotsTaxesAnnuel: 350_000,
  },

  personnel: [
    { intitule: "Boulanger", nombre: 2, salaireBrutMensuel: 200_000 },
    { intitule: "Vendeur", nombre: 2, salaireBrutMensuel: 120_000 },
    { intitule: "Livreur", nombre: 1, salaireBrutMensuel: 110_000 },
  ],
  salaireDirigeant: { montantMensuel: 400_000 },

  delais: {
    delaiClientsJours: 15,
    delaiFournisseursJours: 30,
    delaiStockJours: 20,
  },
};
