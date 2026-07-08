/**
 * Pont vers le moteur de calcul deterministe (src/). Le reste de l'app Next
 * n'importe le moteur QUE via ce fichier — un seul point d'entree, cote serveur.
 *
 * Regle non negociable : aucun montant du dossier n'est calcule dans l'UI.
 * On appelle `genererDossier` (pur, teste) et on affiche ce qu'il renvoie.
 */

export { genererDossier } from "../src/index.js";
export type { OptionsGeneration } from "../src/index.js";
export { genererHTML } from "../src/pdf/template.js";
export { PARAMETRES } from "../src/config/parametres.js";
export { exempleBoulangerie } from "../src/examples/boulangerie.js";

export type { DossierInput } from "../src/types/dossier-input.js";
export type { DossierOutput } from "../src/types/dossier-output.js";

// --- Entreprise (multi-tenant : cabinet -> entreprises clientes) -----------
export {
  regimeParDefaut,
  normaliserRegime,
  estComptabiliteTresorerie,
  LIBELLE_REGIME_COMPTABLE,
  LIBELLE_REGIME_FISCAL,
  LIBELLE_FORME_JURIDIQUE,
} from "../src/types/entreprise.js";
export type {
  RegimeComptable,
  RegimeFiscal,
  FormeJuridique,
  ProfilEntreprise,
  Entreprise,
} from "../src/types/entreprise.js";

// --- Module Facturation ---------------------------------------------------
export { calculerDocument } from "../src/engine/facturation.js";
export type { OptionsFacturation } from "../src/engine/facturation.js";
export type {
  TypeDocument,
  LigneDocumentInput,
  DocumentInput,
  LigneDocumentCalc,
  VentilationTVA,
  DocumentCalc,
} from "../src/types/facturation.js";

// --- Module Ventes & CRM --------------------------------------------------
export { calculerPipeline } from "../src/engine/crm.js";
export type {
  OpportuniteInput,
  EtapePipeline,
  ResultatPipeline,
} from "../src/engine/crm.js";

// --- Module Comptabilite --------------------------------------------------
export { calculerComptabilite } from "../src/engine/comptabilite.js";
export { calculerEtatsFinanciers } from "../src/engine/etats-financiers.js";
export type {
  CompteComptable,
  LigneEcritureInput,
  EcritureInput,
  EcritureCalc,
  LigneBalance,
  ResultatComptabilite,
  PosteEtat,
  CompteResultat,
  Bilan,
  EtatsFinanciers,
} from "../src/types/comptabilite.js";

// --- Module Rapport financier ---------------------------------------------
export { calculerRapportFinancier } from "../src/engine/rapport-financier.js";
export type {
  ComparatifRapport,
  RapportFinancierInput,
  Variation,
  SyntheseRapport,
  RatiosRapport,
  LigneComparee,
  RapportFinancier,
} from "../src/types/rapport-financier.js";

// --- Module Tresorerie (comptes de disponibilites) ------------------------
export { calculerTresorerie } from "../src/engine/tresorerie-comptes.js";
export type {
  TypeCompteTresorerie,
  SensMouvement,
  CompteTresorerieInput,
  MouvementTresorerieInput,
  SoldeCompte,
  RepartitionType,
  RepartitionFlux,
  ResultatTresorerie,
} from "../src/types/tresorerie.js";

// --- Module Charges & Depenses --------------------------------------------
export { calculerDepenses } from "../src/engine/depenses.js";
export type { OptionsDepenses } from "../src/engine/depenses.js";
export type {
  CategorieDepense,
  Recurrence,
  DepenseInput,
  DepenseCalc,
  RepartitionCategorie,
  ResultatDepenses,
} from "../src/types/depenses.js";

// --- Module RH (paie) -----------------------------------------------------
export { calculerPaie } from "../src/engine/paie.js";
export type { OptionsPaie } from "../src/engine/paie.js";
export type {
  BulletinInput,
  BulletinCalc,
  ResultatPaie,
} from "../src/types/rh.js";

// --- Module Projets & Taches ----------------------------------------------
export { calculerProjets } from "../src/engine/projets.js";
export type {
  StatutTache,
  TacheInput,
  AvancementProjet,
  ResultatProjets,
} from "../src/types/projets.js";

// --- Module Stocks --------------------------------------------------------
export { calculerStock } from "../src/engine/stocks.js";
export type {
  TypeArticle,
  TypeMouvement,
  MouvementStock,
  ArticleStockInput,
  ArticleStockCalc,
  ResultatStock,
} from "../src/types/stocks.js";

// --- Module Achats --------------------------------------------------------
export { calculerAchats, calculerCommande } from "../src/engine/achats.js";
export type { OptionsAchats } from "../src/engine/achats.js";
export type {
  StatutCommande,
  LigneCommandeInput,
  CommandeAchatInput,
  LigneCommandeCalc,
  CommandeAchatCalc,
  ResultatAchats,
} from "../src/types/achats.js";

// --- Module Fournisseurs --------------------------------------------------
export { calculerFournisseurs } from "../src/engine/fournisseurs.js";
export type {
  FournisseurInput,
  FournisseurCalc,
  ResultatFournisseurs,
} from "../src/types/fournisseurs.js";

// --- Module Production / MRP ----------------------------------------------
export { calculerProduction } from "../src/engine/production.js";
export type {
  ComposantBOM,
  NomenclatureInput,
  OrdreFabricationInput,
  StockComposant,
  BesoinComposant,
  CoutOrdre,
  ResultatProduction,
} from "../src/types/production.js";
