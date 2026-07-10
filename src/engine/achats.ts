/**
 * Moteur ACHATS — totaux des commandes d'achat, receptions et encours
 * fournisseurs. Pur et deterministe (aucune I/O, aucun aleatoire).
 *
 * Pour chaque commande : HT / TVA deductible / TTC par ligne, reste a payer,
 * valeur receptionnee et valeur restant a recevoir ; puis les totaux (achats de
 * la periode, encours fournisseurs, valeur a recevoir). C'est le SEUL endroit ou
 * ces montants sont produits ; ni l'UI ni l'IA ne calculent un chiffre.
 *
 * Aucun taux en dur : le taux de TVA par defaut est injecte via les options
 * (l'appelant le lit dans `PARAMETRES.tva.taux`).
 *
 * Arrondi : le HT et la TVA sont arrondis a l'entier FCFA au moment de produire
 * chaque ligne ; les totaux sont la somme des lignes arrondies (Σ lignes = total).
 */

import type { FCFA, Taux } from "../types/money.js";
import type {
  CommandeAchatInput,
  CommandeAchatCalc,
  LigneCommandeCalc,
  ResultatAchats,
} from "../types/achats.js";
import { arrondiFCFA } from "./arrondi.js";

export interface OptionsAchats {
  /** Taux de TVA applique aux lignes sans taux explicite (vient de PARAMETRES). */
  tauxTVADefaut: Taux;
}

export function calculerAchats(
  commandes: CommandeAchatInput[],
  opts: OptionsAchats,
): ResultatAchats {
  const lignes: CommandeAchatCalc[] = commandes.map((c) =>
    calculerCommande(c, opts),
  );

  // L'encours et le reste a recevoir excluent les commandes annulees.
  const actives = lignes.filter((c) => c.statut !== "annulee");

  return {
    commandes: lignes,
    totalHT: somme(actives.map((c) => c.totalHT)),
    totalTVA: somme(actives.map((c) => c.totalTVA)),
    totalTTC: somme(actives.map((c) => c.totalTTC)),
    totalPaye: somme(actives.map((c) => c.montantPaye)),
    totalAPayer: somme(actives.map((c) => c.resteAPayer)),
    totalARecevoirHT: somme(actives.map((c) => c.valeurARecevoirHT)),
  };
}

/** Calcule les totaux d'une commande d'achat (SNAPSHOT). */
export function calculerCommande(
  commande: CommandeAchatInput,
  opts: OptionsAchats,
): CommandeAchatCalc {
  const assujetti = commande.assujettiTVA ?? true;

  const lignes: LigneCommandeCalc[] = commande.lignes.map((l) => {
    const remise = fraction(l.remisePct ?? 0);
    const tauxTVA = assujetti ? fraction(l.tauxTVA ?? opts.tauxTVADefaut) : 0;
    const quantite = quantiteValide(l.quantite);
    const quantiteRecue = Math.min(quantiteValide(l.quantiteRecue ?? 0), quantite);
    const prixUnitaireHT = montantValide(l.prixUnitaireHT);

    const puNet = prixUnitaireHT * (1 - remise);
    const htExact = quantite * puNet;

    const montantHT = arrondiFCFA(htExact);
    const montantTVA = arrondiFCFA(htExact * tauxTVA);

    return {
      designation: l.designation,
      quantite,
      quantiteRecue,
      prixUnitaireHT,
      tauxTVA,
      montantHT,
      montantTVA,
      montantTTC: montantHT + montantTVA,
      montantRecuHT: arrondiFCFA(quantiteRecue * puNet),
      resteARecevoir: quantite - quantiteRecue,
    };
  });

  const totalHT = somme(lignes.map((l) => l.montantHT));
  const totalTVA = somme(lignes.map((l) => l.montantTVA));
  const totalTTC = totalHT + totalTVA;
  const valeurRecueHT = somme(lignes.map((l) => l.montantRecuHT));

  const qteCommandee = lignes.reduce((s, l) => s + l.quantite, 0);
  const qteRecue = lignes.reduce((s, l) => s + l.quantiteRecue, 0);

  const montantPaye = Math.max(0, arrondiFCFA(commande.montantPaye ?? 0));

  return {
    fournisseur: commande.fournisseur,
    statut: commande.statut ?? "brouillon",
    lignes,
    totalHT,
    totalTVA,
    totalTTC,
    montantPaye,
    resteAPayer: totalTTC - montantPaye,
    valeurRecueHT,
    valeurARecevoirHT: totalHT - valeurRecueHT,
    tauxReception: qteCommandee > 0 ? qteRecue / qteCommandee : 0,
  };
}

function somme(xs: FCFA[]): FCFA {
  return xs.reduce((s, x) => s + x, 0);
}

/** Normalise une fraction dans [0, 1] (les valeurs invalides -> 0). */
function fraction(x: number): number {
  if (!Number.isFinite(x) || x <= 0) return 0;
  return x >= 1 ? 1 : x;
}

/** Normalise une quantite (les valeurs invalides / negatives -> 0). */
function quantiteValide(x: number): number {
  return Number.isFinite(x) && x > 0 ? x : 0;
}

/** Normalise un montant fini (les valeurs invalides / negatives -> 0). */
function montantValide(x: number): number {
  return Number.isFinite(x) && x > 0 ? x : 0;
}
