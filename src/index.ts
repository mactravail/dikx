/**
 * Point d'entree du moteur : DossierInput -> DossierOutput.
 *
 * Orchestration PURE (hors lecture optionnelle de l'horloge pour `dateGeneration`,
 * injectable via options). Resout les valeurs par defaut, appelle chaque calcul
 * dans l'ordre des dependances, assemble les 9 tableaux + indicateurs et produit
 * les avertissements de coherence. Aucun montant n'est calcule ici "a la main" :
 * tout vient des modules testes de /engine.
 */

import type { DossierInput } from "./types/dossier-input.js";
import type {
  DossierOutput,
  T3,
  MetaDossier,
  ParametresUtilises,
} from "./types/dossier-output.js";
import type { FCFA, Serie5FCFA, Serie12, Taux } from "./types/money.js";
import { PARAMETRES, type Parametres } from "./config/parametres.js";

import { arrondiFCFA, arrondiSerie12 } from "./engine/arrondi.js";
import { calculerAmortissements } from "./engine/amortissements.js";
import { calculerEmprunt } from "./engine/emprunt.js";
import { calculerChiffreAffaires } from "./engine/chiffre-affaires.js";
import { calculerCharges } from "./engine/charges.js";
import { calculerSalaires } from "./engine/salaires.js";
import { calculerResultat } from "./engine/resultat.js";
import { calculerSIG } from "./engine/sig.js";
import { calculerBFR } from "./engine/bfr.js";
import { calculerT1 } from "./engine/investissements-financement.js";
import { calculerIndicateurs } from "./engine/indicateurs.js";
import { calculerPlanFinancement } from "./engine/plan-financement.js";
import { calculerTresorerie } from "./engine/tresorerie.js";

export * from "./types/index.js";
export { PARAMETRES } from "./config/parametres.js";

export interface OptionsGeneration {
  /** Parametres de base (defaut : PARAMETRES). */
  parametres?: Parametres;
  /** Date de generation injectable (pour des sorties deterministes / tests). */
  dateGeneration?: Date;
}

const HORIZON = 5;
const SEUIL_DSCR_BANQUE = 1.2;
const TAUX_INTERET_SUSPECT = 0.35; // garde-fou : au-dela, on alerte

export function genererDossier(input: DossierInput, options: OptionsGeneration = {}): DossierOutput {
  const params = options.parametres ?? PARAMETRES;
  const avertissements: string[] = [];

  // --- Taux effectifs (override dossier > parametres). Aucun taux en dur. ---
  const tauxTVA: Taux = input.parametres?.tauxTVA ?? params.tva.taux;
  const tauxIS: Taux = input.parametres?.tauxIS ?? params.is.taux;
  const tauxChargesPatronales: Taux =
    input.parametres?.tauxChargesSocialesPatronales ?? params.chargesSocialesPatronales.taux;

  // --- Bloc 2 : valeurs par defaut du financement ---
  const apportCapital = input.financement.apportCapital ?? 0;
  const apportCompteCourant = input.financement.apportCompteCourant ?? 0;
  const subvention = input.financement.subventionInvestissement ?? 0;
  const emprunt = input.financement.emprunt ?? null;

  // --- Bloc 6 : delais par defaut ---
  const delaiClientsJours = input.delais?.delaiClientsJours ?? 0;
  const delaiFournisseursJours = input.delais?.delaiFournisseursJours ?? 30;
  const delaiStockJours = input.delais?.delaiStockJours ?? 0;

  // ===================== 1. Chiffre d'affaires =====================
  const ca = calculerChiffreAffaires(input.chiffreAffaires);
  if ((ca.caParAn[0] ?? 0) <= 0) {
    avertissements.push("Le chiffre d'affaires de l'annee 1 est nul ou negatif.");
  }

  // ===================== 2. Charges ================================
  const charges = calculerCharges(input.charges, ca.caParAn, {
    inflationChargesFixes: params.inflationChargesFixes,
  });

  // ===================== 3. Amortissements (T2) ====================
  const t2 = calculerAmortissements(input.investissements, {
    dureesDefaut: params.dureesAmortissementDefaut,
  });

  // ===================== 4. Emprunt (T3) ===========================
  let t3: T3 | null = null;
  if (emprunt && emprunt.montant > 0) {
    if (emprunt.tauxAnnuel > TAUX_INTERET_SUSPECT) {
      avertissements.push(
        `Taux d'interet eleve (${(emprunt.tauxAnnuel * 100).toFixed(1)} %) : a verifier.`,
      );
    }
    t3 = calculerEmprunt(emprunt, { methode: params.emprunt.methode });
  }
  const interetsParAn = t3 ? t3.interetsParAn : serieZero5();
  const capitalParAn = t3 ? t3.capitalParAn : serieZero5();
  const annuiteParAn = t3 ? t3.annuiteParAn : serieZero5();
  const serviceMensuelAnnee1: Serie12<FCFA> = t3 ? t3.serviceMensuelAnnee1 : serieZero12();

  // ===================== 5. Salaires (T4) ==========================
  const t4 = calculerSalaires(input.personnel, input.salaireDirigeant ?? null, {
    tauxChargesPatronales,
  });

  // ===================== 6. Compte de resultat (T5) ================
  const t5 = calculerResultat(
    {
      caParAn: ca.caParAn,
      achatsConsommes: charges.achatsConsommes,
      chargesExternes: charges.chargesExternes,
      impotsTaxes: charges.impotsTaxes,
      chargesPersonnel: t4.coutEmployeurParAn,
      dotations: t2.totalDotations,
      chargesFinancieres: interetsParAn,
    },
    { tauxIS },
  );

  // ===================== 7. SIG (T6) ===============================
  const t6 = calculerSIG(t5);

  // ===================== 8. BFR (T7) ===============================
  const t7 = calculerBFR(
    { caParAn: ca.caParAn, achatsParAn: charges.achatsConsommes },
    {
      delaiClientsJours,
      delaiFournisseursJours,
      delaiStockJours,
      tauxTVA,
      assujettiTVA: input.assujettiTVA,
      joursAnnee: params.bfr.joursAnnee,
    },
  );
  const bfrInitial = t7.bfr[0] ?? 0;

  // ===================== 9. Investissements & financement (T1) =====
  const t1 = calculerT1({
    investissements: input.investissements,
    bfrInitial,
    apportCapital,
    apportCompteCourant,
    subventionInvestissement: subvention,
    emprunt: emprunt?.montant ?? 0,
  });
  if (!t1.equilibre) {
    avertissements.push(
      `Financement insuffisant : il manque ${formaterFCFA(-t1.ecart)} FCFA pour couvrir ` +
        `les investissements et le BFR de depart.`,
    );
  }

  // ===================== 10. Indicateurs (IND) =====================
  const chargesFixes = assemblerChargesFixes(
    charges.chargesExternesFixes,
    charges.impotsTaxes,
    t4.coutEmployeurParAn,
    t2.totalDotations,
    interetsParAn,
  );
  const indicateurs = calculerIndicateurs({
    caParAn: ca.caParAn,
    chargesVariables: charges.chargesVariables,
    chargesFixes,
    resultatNet: t5.resultatNet,
    dotations: t2.totalDotations,
    serviceDette: annuiteParAn,
  });
  const dscr1 = indicateurs.dscr[0];
  if (dscr1 != null && dscr1 < SEUIL_DSCR_BANQUE) {
    avertissements.push(
      `DSCR de l'annee 1 faible (${dscr1.toFixed(2)} < ${SEUIL_DSCR_BANQUE}) : ` +
        `la banque pourrait juger le remboursement tendu.`,
    );
  }

  // ===================== 11. Plan de financement (T8) ==============
  const t8 = calculerPlanFinancement({
    investissementsAnnee1: t1.totalInvestissements,
    variationBFR: t7.variationBFR,
    remboursementsCapital: capitalParAn,
    caf: indicateurs.caf,
    apportsAnnee1: apportCapital + apportCompteCourant,
    subventionAnnee1: subvention,
    empruntAnnee1: emprunt?.montant ?? 0,
  });

  // ===================== 12. Tresorerie (T9) =======================
  const t9 = calculerTresorerie(
    {
      caMensuelAnnee1: ca.caMensuelAnnee1,
      achatsMensuelAnnee1: repartirSurCA(charges.achatsConsommes[0] ?? 0, ca),
      chargesExternesMensuelAnnee1: chargesExternesMensuelles(charges, ca),
      salairesMensuelAnnee1: mensualiserEgal(t4.coutEmployeurParAn[0] ?? 0),
      serviceEmpruntMensuelAnnee1: serviceMensuelAnnee1,
      investissementsTotalHT: t1.totalInvestissements,
      apportsTotal: apportCapital + apportCompteCourant,
      empruntMontant: emprunt?.montant ?? 0,
      subvention,
    },
    {
      assujettiTVA: input.assujettiTVA,
      tauxTVA,
      delaiClientsJours,
      delaiFournisseursJours,
    },
  );
  const moisNegatif = t9.soldeCumule.findIndex((s) => s < 0);
  if (moisNegatif >= 0) {
    avertissements.push(
      `Tresorerie negative au mois ${moisNegatif + 1} de l'annee 1 : prevoir un decouvert ou plus d'apport.`,
    );
  }

  // ===================== Meta & parametres =========================
  const meta: MetaDossier = {
    nomProjet: input.nomProjet,
    secteur: input.secteur,
    formeJuridique: input.formeJuridique,
    moisDemarrage: `${String(input.moisDemarrage.mois).padStart(2, "0")}/${input.moisDemarrage.annee}`,
    assujettiTVA: input.assujettiTVA,
    horizonAnnees: HORIZON,
    devise: "XOF",
    dateGeneration: (options.dateGeneration ?? new Date()).toISOString(),
  };

  const parametresUtilises: ParametresUtilises = {
    tauxTVA,
    tauxIS,
    tauxChargesSocialesPatronales: tauxChargesPatronales,
    methodeAmortissementEmprunt: params.emprunt.methode,
    joursAnnee: params.bfr.joursAnnee,
    inflationChargesFixes: params.inflationChargesFixes,
  };

  return {
    meta,
    t1,
    t2,
    t3,
    t4,
    t5,
    t6,
    t7,
    t8,
    t9,
    indicateurs,
    parametresUtilises,
    avertissements,
  };
}

/* ------------------------------------------------------------------ */
/* Helpers d'orchestration                                             */
/* ------------------------------------------------------------------ */

function assemblerChargesFixes(
  externesFixes: Serie5FCFA,
  impotsTaxes: Serie5FCFA,
  personnel: Serie5FCFA,
  dotations: Serie5FCFA,
  interets: Serie5FCFA,
): Serie5FCFA {
  const out: Serie5FCFA = [0, 0, 0, 0, 0];
  for (let i = 0; i < HORIZON; i++) {
    out[i] =
      (externesFixes[i] ?? 0) +
      (impotsTaxes[i] ?? 0) +
      (personnel[i] ?? 0) +
      (dotations[i] ?? 0) +
      (interets[i] ?? 0);
  }
  return out;
}

/** Repartit un montant annuel sur 12 mois au prorata du CA mensuel (somme conservee). */
function repartirSurCA(
  montantAnnuel: FCFA,
  ca: { caMensuelAnnee1: Serie12<FCFA>; caParAn: Serie5FCFA },
): Serie12<FCFA> {
  const caAnnuel = ca.caParAn[0] ?? 0;
  if (caAnnuel <= 0) return mensualiserEgal(montantAnnuel);
  let cumulPoids = 0;
  let cumulArrondiPrecedent = 0;
  const out = [] as unknown as Serie12<FCFA>;
  for (let m = 0; m < 12; m++) {
    cumulPoids += (ca.caMensuelAnnee1[m] ?? 0) / caAnnuel;
    const cumulArrondi = arrondiFCFA(montantAnnuel * cumulPoids);
    out[m] = cumulArrondi - cumulArrondiPrecedent;
    cumulArrondiPrecedent = cumulArrondi;
  }
  return out;
}

/** Repartit un montant annuel en 12 mensualites egales (somme conservee). */
function mensualiserEgal(montantAnnuel: FCFA): Serie12<FCFA> {
  const out = [] as unknown as Serie12<FCFA>;
  let cumulArrondiPrecedent = 0;
  for (let m = 0; m < 12; m++) {
    const cumulArrondi = arrondiFCFA((montantAnnuel * (m + 1)) / 12);
    out[m] = cumulArrondi - cumulArrondiPrecedent;
    cumulArrondiPrecedent = cumulArrondi;
  }
  return out;
}

/** Charges externes mensuelles an1 = part fixe egale + transport au prorata CA + impots egal. */
function chargesExternesMensuelles(
  charges: {
    chargesExternesFixes: Serie5FCFA;
    transport: Serie5FCFA;
    impotsTaxes: Serie5FCFA;
  },
  ca: { caMensuelAnnee1: Serie12<FCFA>; caParAn: Serie5FCFA },
): Serie12<FCFA> {
  const fixe = mensualiserEgal(charges.chargesExternesFixes[0] ?? 0);
  const impots = mensualiserEgal(charges.impotsTaxes[0] ?? 0);
  const transport = repartirSurCA(charges.transport[0] ?? 0, ca);
  const out = [] as unknown as Serie12<FCFA>;
  for (let m = 0; m < 12; m++) {
    out[m] = (fixe[m] ?? 0) + (impots[m] ?? 0) + (transport[m] ?? 0);
  }
  return out;
}

function serieZero5(): Serie5FCFA {
  return [0, 0, 0, 0, 0];
}

function serieZero12(): Serie12<FCFA> {
  return arrondiSerie12(new Array<number>(12).fill(0));
}

function formaterFCFA(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}
