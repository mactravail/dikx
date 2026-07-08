/**
 * Types du module Production / MRP (nomenclatures, ordres de fabrication,
 * calcul des besoins).
 *
 * Ces types decrivent l'ENTREE collectee par l'UI (des nomenclatures, des ordres
 * de fabrication et le stock disponible des composants) et la SORTIE produite par
 * le moteur (`src/engine/production.ts`). Regle non negociable (CLAUDE.md) : le
 * calcul des besoins (MRP) et le cout matiere ne sont jamais calcules dans le
 * navigateur ; tout vient du moteur deterministe et teste, cote serveur.
 *
 * Argent : FCFA (XOF) entiers. Les quantites (composant par produit, a produire)
 * ne sont pas monetaires et peuvent etre decimales.
 */

import type { FCFA } from "./money.js";

/** Un composant d'une nomenclature (BOM) : un article et sa quantite unitaire. */
export interface ComposantBOM {
  /** Reference de l'article composant. */
  ref: string;
  /** Quantite de composant par unite de produit fini. */
  quantite: number;
  /** Cout unitaire du composant (FCFA). Defaut 0. */
  coutUnitaire?: FCFA;
}

/** Nomenclature (BOM) d'un produit fini (SAISIE). */
export interface NomenclatureInput {
  /** Reference du produit fini fabrique. */
  produit: string;
  composants: ComposantBOM[];
}

/** Un ordre de fabrication : produire une quantite d'un produit (SAISIE). */
export interface OrdreFabricationInput {
  /** Reference du produit a fabriquer (doit avoir une nomenclature). */
  produit: string;
  /** Quantite a produire. */
  quantite: number;
}

/** Stock disponible d'un composant, pour le calcul des besoins nets (SAISIE). */
export interface StockComposant {
  ref: string;
  quantite: number;
}

/** Besoin agrege d'un composant (SNAPSHOT moteur). */
export interface BesoinComposant {
  ref: string;
  /** Besoin brut = Σ (quantite OF x quantite unitaire du composant). */
  besoinBrut: number;
  /** Stock disponible du composant. */
  disponible: number;
  /** Besoin net = max(0, brut − disponible) : quantite a approvisionner. */
  besoinNet: number;
  coutUnitaire: FCFA;
  /** Valeur a acheter = besoinNet x coutUnitaire (FCFA, arrondi). */
  valeurAAcheter: FCFA;
}

/** Cout matiere d'un ordre de fabrication (SNAPSHOT moteur). */
export interface CoutOrdre {
  produit: string;
  quantite: number;
  /** Cout matiere = quantite OF x Σ (composant.quantite x coutUnitaire), arrondi. */
  coutMatiere: FCFA;
  /** Vrai si le produit n'a pas de nomenclature (cout matiere non calculable). */
  sansNomenclature: boolean;
}

/** Resultat du calcul de production / MRP (SNAPSHOT). */
export interface ResultatProduction {
  /** Besoins nets par composant, tries par valeur a acheter decroissante. */
  besoins: BesoinComposant[];
  ordres: CoutOrdre[];
  /** Cout matiere total de tous les ordres (FCFA). */
  coutMatiereTotal: FCFA;
  /** Valeur totale des approvisionnements a declencher (Σ valeurAAcheter). */
  valeurAAcheterTotale: FCFA;
  nbOrdres: number;
}
