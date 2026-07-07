/**
 * Generation du document HTML du dossier previsionnel (couche Rendu).
 *
 * Fonction PURE : DossierOutput -> string HTML. Aucun I/O, aucun calcul.
 * Le HTML est optimise pour l'impression A4 (converti ensuite en PDF par
 * src/pdf/index.ts). Tous les nombres viennent du moteur ; ici on ne fait que
 * mettre en forme.
 */

import type {
  DossierOutput,
  SoldeSIG,
  T2LignePoste,
  T3LigneAnnuelle,
  T4LignePoste,
} from "../types/dossier-output.js";
import type { Serie5, Serie5FCFA, Serie12 } from "../types/money.js";
import { echapperHTML, formatFCFA, formatNombre, formatPct } from "./format.js";

const ANNEES = ["An 1", "An 2", "An 3", "An 4", "An 5"];

export function genererHTML(d: DossierOutput): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>Previsionnel financier 5 ans - ${echapperHTML(d.meta.nomProjet)}</title>
<style>${CSS}</style>
</head>
<body>
${pageDeGarde(d)}
${sectionSynthese(d)}
${sectionT1(d)}
${sectionT2(d)}
${sectionT3(d)}
${sectionT4(d)}
${sectionT5(d)}
${sectionT6(d)}
${sectionT7(d)}
${sectionT8(d)}
${sectionT9(d)}
${sectionIndicateurs(d)}
${sectionAvertissements(d)}
${piedDeParametres(d)}
</body>
</html>`;
}

/* ------------------------------------------------------------------ */
/* Sections                                                            */
/* ------------------------------------------------------------------ */

function pageDeGarde(d: DossierOutput): string {
  const m = d.meta;
  return `<header class="cover">
  <div class="cover-badge">Dossier previsionnel financier &mdash; 5 ans</div>
  <h1>${echapperHTML(m.nomProjet)}</h1>
  <p class="cover-sub">${echapperHTML(m.secteur)}</p>
  <dl class="cover-meta">
    <div><dt>Forme juridique</dt><dd>${escapeForme(m.formeJuridique)}</dd></div>
    <div><dt>Demarrage</dt><dd>${echapperHTML(m.moisDemarrage)}</dd></div>
    <div><dt>Assujetti TVA</dt><dd>${m.assujettiTVA ? "Oui" : "Non"}</dd></div>
    <div><dt>Devise</dt><dd>${m.devise}</dd></div>
    <div><dt>Horizon</dt><dd>${m.horizonAnnees} ans</dd></div>
    <div><dt>Genere le</dt><dd>${echapperHTML(m.dateGeneration.slice(0, 10))}</dd></div>
  </dl>
  <p class="cover-note">Tous les montants sont en FCFA (XOF). Document genere automatiquement &mdash;
  les taux fiscaux et sociaux utilises sont a faire valider par un expert.</p>
</header>`;
}

function sectionSynthese(d: DossierOutput): string {
  const ind = d.indicateurs;
  const rn = d.t5.resultatNet;
  const cartes = [
    carte("Chiffre d'affaires An 1", formatFCFA(d.t5.chiffreAffaires[0] ?? 0)),
    carte("Resultat net An 5", formatFCFA(rn[4] ?? 0), (rn[4] ?? 0) < 0),
    carte("CAF An 1", formatFCFA(ind.caf[0] ?? 0), (ind.caf[0] ?? 0) < 0),
    carte("DSCR An 1", dscrTexte(ind.dscr[0] ?? null)),
    carte("Seuil rentabilite An 1", formatFCFA(ind.seuilRentabilite[0] ?? 0)),
    carte("BFR de depart", formatFCFA(d.t7.bfr[0] ?? 0)),
  ].join("\n");
  return `<section class="synthese">
  <h2>Synthese</h2>
  <div class="cartes">${cartes}</div>
</section>`;
}

function sectionT1(d: DossierOutput): string {
  const t = d.t1;
  const invest = t.investissements
    .map((i) => ligneSimple(echapperHTML(i.libelle), formatNombre(i.montantHT)))
    .join("\n");
  return section(
    "T1",
    "Investissements & financements",
    `<div class="deux-colonnes">
    <table class="tbl">
      <thead><tr><th>Emplois</th><th class="num">FCFA</th></tr></thead>
      <tbody>
        ${invest}
        ${ligneSimple("<strong>Total investissements</strong>", formatNombre(t.totalInvestissements), true)}
        ${ligneSimple("BFR de depart", formatNombre(t.bfrInitial))}
        ${ligneSimple("<strong>Total emplois</strong>", formatNombre(t.totalEmplois), true)}
      </tbody>
    </table>
    <table class="tbl">
      <thead><tr><th>Ressources</th><th class="num">FCFA</th></tr></thead>
      <tbody>
        ${ligneSimple("Apport capital", formatNombre(t.apportCapital))}
        ${ligneSimple("Compte courant associes", formatNombre(t.apportCompteCourant))}
        ${ligneSimple("Subvention", formatNombre(t.subventionInvestissement))}
        ${ligneSimple("Emprunt", formatNombre(t.emprunt))}
        ${ligneSimple("<strong>Total ressources</strong>", formatNombre(t.totalRessources), true)}
      </tbody>
    </table>
  </div>
  <p class="equilibre ${t.equilibre ? "ok" : "ko"}">
    ${t.equilibre ? "&#10003; Financement equilibre" : "&#10007; Financement insuffisant"}
    &mdash; ecart ${formatFCFA(t.ecart)}
  </p>`,
  );
}

function sectionT2(d: DossierOutput): string {
  const lignes = d.t2.postes.map(ligneT2Poste).join("\n");
  return section(
    "T2",
    "Amortissements",
    tableAnnees(
      ["Poste", "Duree"],
      `${lignes}
      ${ligneTotale("Total dotations", d.t2.totalDotations, 2)}`,
    ),
  );
}

function ligneT2Poste(p: T2LignePoste): string {
  const cellules = p.dotations.map(cellNum).join("");
  return `<tr><td>${echapperHTML(p.libelle)}</td><td class="num">${p.amortissable ? p.dureeAmortissement + " ans" : "&mdash;"}</td>${cellules}</tr>`;
}

function sectionT3(d: DossierOutput): string {
  if (!d.t3) {
    return section("T3", "Emprunt", `<p class="vide">Pas d'emprunt dans ce dossier.</p>`);
  }
  const t = d.t3;
  const lignes = t.lignes.map(ligneT3).join("\n");
  return section(
    "T3",
    "Emprunt &mdash; echeancier",
    `<p class="legende">${formatFCFA(t.montant)} au taux de ${formatPct(t.tauxAnnuel)} sur ${t.dureeAnnees} ans
     ${t.differeMois > 0 ? `&mdash; differe ${t.differeMois} mois` : ""}
     &mdash; methode : ${t.methode === "annuites_constantes" ? "annuites constantes" : "capital constant"}</p>
    <table class="tbl">
      <thead><tr>
        <th>Annee</th><th class="num">Capital debut</th><th class="num">Interets</th>
        <th class="num">Capital rembourse</th><th class="num">Annuite</th><th class="num">Restant du</th>
      </tr></thead>
      <tbody>${lignes}</tbody>
    </table>`,
  );
}

function ligneT3(l: T3LigneAnnuelle): string {
  return `<tr>
    <td>An ${l.annee}</td>
    <td class="num">${formatNombre(l.capitalDebutPeriode)}</td>
    <td class="num">${formatNombre(l.interets)}</td>
    <td class="num">${formatNombre(l.capitalRembourse)}</td>
    <td class="num">${formatNombre(l.annuite)}</td>
    <td class="num">${formatNombre(l.capitalRestantDu)}</td>
  </tr>`;
}

function sectionT4(d: DossierOutput): string {
  const t = d.t4;
  const lignes = [...t.postes, ...(t.dirigeant ? [t.dirigeant] : [])].map(ligneT4).join("\n");
  return section(
    "T4",
    "Salaires & charges sociales",
    `<p class="legende">Charges patronales : ${formatPct(t.tauxChargesPatronales)} (a valider par un expert paie)</p>
    <table class="tbl">
      <thead><tr>
        <th>Poste</th><th class="num">Nb</th><th class="num">Brut annuel</th>
        <th class="num">Charges patronales</th><th class="num">Cout employeur</th>
      </tr></thead>
      <tbody>
        ${lignes}
        <tr class="total">
          <td><strong>Total</strong></td><td class="num"></td>
          <td class="num">${formatNombre(t.totalBrutAnnuel)}</td>
          <td class="num">${formatNombre(t.totalChargesPatronales)}</td>
          <td class="num">${formatNombre(t.totalCoutEmployeur)}</td>
        </tr>
      </tbody>
    </table>`,
  );
}

function ligneT4(l: T4LignePoste): string {
  return `<tr>
    <td>${echapperHTML(l.intitule)}</td>
    <td class="num">${l.nombre}</td>
    <td class="num">${formatNombre(l.salaireBrutAnnuel)}</td>
    <td class="num">${formatNombre(l.chargesPatronales)}</td>
    <td class="num">${formatNombre(l.coutTotalAnnuel)}</td>
  </tr>`;
}

function sectionT5(d: DossierOutput): string {
  const t = d.t5;
  const corps = [
    ligne5("Chiffre d'affaires", t.chiffreAffaires),
    ligne5("&minus; Achats consommes", t.achatsConsommes),
    ligne5("= Marge brute", t.margeBrute, true),
    ligne5("&minus; Charges externes", t.chargesExternes),
    ligne5("= Valeur ajoutee", t.valeurAjoutee, true),
    ligne5("&minus; Charges de personnel", t.chargesPersonnel),
    ligne5("&minus; Impots & taxes", t.impotsTaxes),
    ligne5("= Excedent brut d'exploitation", t.excedentBrutExploitation, true),
    ligne5("&minus; Dotations amortissements", t.dotationsAmortissements),
    ligne5("= Resultat d'exploitation", t.resultatExploitation, true),
    ligne5("&minus; Charges financieres", t.chargesFinancieres),
    ligne5("= Resultat avant impot", t.resultatAvantImpot, true),
    ligne5("&minus; Impot societes (IS)", t.impotSocietes),
    ligne5("= Resultat net", t.resultatNet, true),
  ].join("\n");
  return section("T5", "Compte de resultat previsionnel 5 ans", tableAnnees(["Poste"], corps));
}

function sectionT6(d: DossierOutput): string {
  const t = d.t6;
  const corps = [
    ligneSIG("Marge commerciale", t.margeCommerciale),
    ligneSIG("Valeur ajoutee", t.valeurAjoutee),
    ligneSIG("Excedent brut d'exploitation", t.excedentBrutExploitation),
    ligneSIG("Resultat d'exploitation", t.resultatExploitation),
    ligneSIG("Resultat courant", t.resultatCourant),
    ligneSIG("Resultat net", t.resultatNet),
  ].join("\n");
  return section(
    "T6",
    "SIG &mdash; Soldes Intermediaires de Gestion (% du CA)",
    tableAnnees(["Solde"], corps),
  );
}

function ligneSIG(label: string, s: SoldeSIG): string {
  const cellules = s.valeur
    .map((v, i) => {
      const pct = formatPct(s.pourcentageCA[i] ?? 0);
      return `<td class="num${v < 0 ? " neg" : ""}">${formatNombre(v)}<span class="pct">${pct}</span></td>`;
    })
    .join("");
  return `<tr><td>${label}</td>${cellules}</tr>`;
}

function sectionT7(d: DossierOutput): string {
  const t = d.t7;
  const corps = [
    ligne5("Stocks", t.stocks),
    ligne5("+ Creances clients", t.creancesClients),
    ligne5("&minus; Dettes fournisseurs", t.dettesFournisseurs),
    ligne5("= BFR", t.bfr, true),
    ligne5("Variation du BFR", t.variationBFR),
  ].join("\n");
  return section("T7", "Besoin en Fonds de Roulement", tableAnnees(["Poste"], corps));
}

function sectionT8(d: DossierOutput): string {
  const t = d.t8;
  const corps = [
    ligne5("Investissements", t.investissements),
    ligne5("Variation du BFR", t.variationBFR),
    ligne5("Remboursements capital", t.remboursementsCapital),
    ligne5("= Total emplois", t.totalEmplois, true),
    ligne5("Capacite d'autofinancement", t.capaciteAutofinancement),
    ligne5("Apports", t.apports),
    ligne5("Subventions", t.subventions),
    ligne5("Emprunts", t.emprunts),
    ligne5("= Total ressources", t.totalRessources, true),
    ligne5("Solde annuel", t.soldeAnnuel, true),
    ligne5("Solde cumule", t.soldeCumule, true),
  ].join("\n");
  return section("T8", "Plan de financement 5 ans", tableAnnees(["Poste"], corps));
}

function sectionT9(d: DossierOutput): string {
  const t = d.t9;
  const enTetes = Array.from({ length: 12 }, (_, i) => `<th class="num">M${i + 1}</th>`).join("");
  const corps = [
    ligne12("Encaissements", t.totalEncaissements),
    ligne12("Decaissements", t.totalDecaissements),
    ligne12("Solde du mois", t.soldeMensuel, true),
    ligne12("Solde cumule", t.soldeCumule, true),
  ].join("\n");
  return section(
    "T9",
    "Budget de tresorerie 12 mois (annee 1)",
    `<div class="scroll-x"><table class="tbl tbl-mois">
      <thead><tr><th>Flux</th>${enTetes}</tr></thead>
      <tbody>${corps}</tbody>
    </table></div>`,
  );
}

function sectionIndicateurs(d: DossierOutput): string {
  const ind = d.indicateurs;
  const corps = [
    ligne5("Charges fixes", ind.chargesFixes),
    ligne5pct("Taux de marge / couts variables", ind.tauxMargeSurCoutsVariables),
    ligne5("Seuil de rentabilite", ind.seuilRentabilite),
    ligne5num("Point mort (mois)", ind.pointMortMois, 1),
    ligne5("CAF", ind.caf, true),
    ligne5("Service de la dette", ind.serviceDette),
    ligneDSCR("DSCR", ind.dscr),
  ].join("\n");
  return section(
    "IND",
    "Indicateurs",
    tableAnnees(["Indicateur"], corps) +
      `<p class="legende">DSCR = CAF / service de la dette. Un DSCR &ge; 1,2 rassure la banque.</p>`,
  );
}

function sectionAvertissements(d: DossierOutput): string {
  if (d.avertissements.length === 0) return "";
  const items = d.avertissements.map((a) => `<li>${echapperHTML(a)}</li>`).join("\n");
  return `<section class="avertissements">
    <h2>Avertissements</h2>
    <ul>${items}</ul>
  </section>`;
}

function piedDeParametres(d: DossierOutput): string {
  const p = d.parametresUtilises;
  return `<footer class="parametres">
    <h2>Parametres utilises</h2>
    <p class="legende">A faire valider par un expert (fiscalite et paie au Senegal).</p>
    <ul class="params">
      <li>TVA : ${formatPct(p.tauxTVA)}</li>
      <li>Impot societes (IS) : ${formatPct(p.tauxIS)}</li>
      <li>Charges patronales : ${formatPct(p.tauxChargesSocialesPatronales)}</li>
      <li>Methode emprunt : ${p.methodeAmortissementEmprunt === "annuites_constantes" ? "annuites constantes" : "capital constant"}</li>
      <li>Convention BFR : ${p.joursAnnee} jours / an</li>
      <li>Inflation charges fixes : ${formatPct(p.inflationChargesFixes)}</li>
    </ul>
  </footer>`;
}

/* ------------------------------------------------------------------ */
/* Helpers de rendu                                                   */
/* ------------------------------------------------------------------ */

function section(ref: string, titre: string, contenu: string): string {
  return `<section class="tableau">
  <h2><span class="ref">${ref}</span> ${titre}</h2>
  ${contenu}
</section>`;
}

function tableAnnees(colonnes: string[], corps: string): string {
  const enTetesAnnees = ANNEES.map((a) => `<th class="num">${a}</th>`).join("");
  const enTetesCol = colonnes.map((c) => `<th>${c}</th>`).join("");
  return `<table class="tbl">
    <thead><tr>${enTetesCol}${enTetesAnnees}</tr></thead>
    <tbody>${corps}</tbody>
  </table>`;
}

function ligne5(label: string, serie: Serie5FCFA, fort = false): string {
  const cellules = serie.map(cellNum).join("");
  return `<tr class="${fort ? "fort" : ""}"><td>${label}</td>${cellules}</tr>`;
}

function ligne5num(label: string, serie: Serie5, decimales: number): string {
  const cellules = serie
    .map((v) => `<td class="num">${v.toFixed(decimales).replace(".", ",")}</td>`)
    .join("");
  return `<tr><td>${label}</td>${cellules}</tr>`;
}

function ligne5pct(label: string, serie: Serie5): string {
  const cellules = serie.map((v) => `<td class="num">${formatPct(v)}</td>`).join("");
  return `<tr><td>${label}</td>${cellules}</tr>`;
}

function ligneDSCR(label: string, serie: Array<number | null>): string {
  const cellules = serie.map((v) => `<td class="num">${dscrTexte(v)}</td>`).join("");
  return `<tr class="fort"><td>${label}</td>${cellules}</tr>`;
}

function ligne12(label: string, serie: Serie12<number>, fort = false): string {
  const cellules = serie.map(cellNum).join("");
  return `<tr class="${fort ? "fort" : ""}"><td>${label}</td>${cellules}</tr>`;
}

function ligneTotale(label: string, serie: Serie5FCFA, decalage: number): string {
  const vides = Array.from({ length: decalage - 1 }, () => `<td class="num"></td>`).join("");
  const cellules = serie.map(cellNum).join("");
  return `<tr class="total"><td><strong>${label}</strong></td>${vides}${cellules}</tr>`;
}

function ligneSimple(label: string, valeur: string, fort = false): string {
  return `<tr class="${fort ? "fort" : ""}"><td>${label}</td><td class="num">${valeur}</td></tr>`;
}

function cellNum(v: number): string {
  return `<td class="num${v < 0 ? " neg" : ""}">${formatNombre(v)}</td>`;
}

function carte(titre: string, valeur: string, neg = false): string {
  return `<div class="carte"><span class="carte-titre">${titre}</span><span class="carte-valeur${neg ? " neg" : ""}">${valeur}</span></div>`;
}

function dscrTexte(v: number | null): string {
  if (v == null) return "&mdash;";
  return v.toFixed(2).replace(".", ",");
}

function escapeForme(forme: string): string {
  return echapperHTML(forme);
}

/* ------------------------------------------------------------------ */
/* Styles (impression A4)                                             */
/* ------------------------------------------------------------------ */

const CSS = `
:root { --bleu:#1d4e89; --gris:#5b6b7b; --bord:#d6dde5; --rouge:#c0392b; --vert:#1e8449; }
* { box-sizing: border-box; }
body { font-family: "Segoe UI", Arial, sans-serif; color:#1c2733; font-size:11px; margin:0; }
h1 { font-size:30px; margin:0 0 4px; color:var(--bleu); }
h2 { font-size:15px; color:var(--bleu); border-bottom:2px solid var(--bleu); padding-bottom:3px; margin:0 0 8px; }
.ref { display:inline-block; background:var(--bleu); color:#fff; border-radius:3px; padding:0 6px; font-size:11px; margin-right:6px; }
section.tableau, section.synthese, section.avertissements, footer.parametres { padding:14px 18px; }
section.tableau { page-break-inside: avoid; }
.cover { padding:60px 40px 30px; border-bottom:4px solid var(--bleu); }
.cover-badge { text-transform:uppercase; letter-spacing:2px; font-size:11px; color:var(--gris); margin-bottom:14px; }
.cover-sub { font-size:15px; color:var(--gris); margin:0 0 20px; }
.cover-meta { display:grid; grid-template-columns:repeat(3,1fr); gap:8px 18px; margin:0 0 18px; }
.cover-meta dt { font-size:10px; text-transform:uppercase; color:var(--gris); }
.cover-meta dd { margin:0; font-weight:600; font-size:13px; }
.cover-note { font-size:10px; color:var(--gris); font-style:italic; }
.cartes { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; }
.carte { border:1px solid var(--bord); border-radius:6px; padding:10px 12px; display:flex; flex-direction:column; }
.carte-titre { font-size:10px; text-transform:uppercase; color:var(--gris); }
.carte-valeur { font-size:16px; font-weight:700; color:var(--bleu); margin-top:4px; }
.carte-valeur.neg, .num.neg, td.neg { color:var(--rouge); }
table.tbl { width:100%; border-collapse:collapse; margin:0 0 6px; }
.tbl th, .tbl td { border:1px solid var(--bord); padding:4px 7px; text-align:left; }
.tbl thead th { background:#eef3f8; color:var(--bleu); font-weight:600; }
.tbl td.num, .tbl th.num { text-align:right; font-variant-numeric:tabular-nums; }
.tbl tr.fort td, .tbl tr.total td { background:#f4f8fc; font-weight:700; }
.tbl tr:nth-child(even) td { background:#fbfcfe; }
.tbl tr.fort:nth-child(even) td { background:#f4f8fc; }
.pct { display:block; font-size:9px; color:var(--gris); font-weight:400; }
.deux-colonnes { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
.equilibre { font-weight:700; padding:6px 10px; border-radius:4px; display:inline-block; }
.equilibre.ok { background:#e7f6ed; color:var(--vert); }
.equilibre.ko { background:#fdecea; color:var(--rouge); }
.legende { font-size:10px; color:var(--gris); margin:0 0 8px; }
.vide { color:var(--gris); font-style:italic; }
.avertissements ul { margin:0; padding-left:18px; }
.avertissements li { color:var(--rouge); margin-bottom:3px; }
.params { columns:2; font-size:11px; }
.tbl-mois th, .tbl-mois td { padding:3px 4px; font-size:9.5px; }
@page { size:A4; margin:14mm; }
`;
