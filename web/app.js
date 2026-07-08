/* raktak — logique de l'app web (aucune dépendance).
 *
 * Rôle : collecter les réponses, construire le DossierInput, l'envoyer au moteur
 * via l'API, et afficher ce qu'il renvoie. AUCUN chiffre du dossier n'est calculé ici. */

"use strict";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const el = (id) => document.getElementById(id);

function numEl(elm) {
  const v = (elm.value || "").trim();
  if (v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
const optNum = (id) => numEl(el(id));
const optPct = (id) => {
  const n = optNum(id);
  return n === undefined ? undefined : n / 100;
};
function setOpt(o, k, v) {
  if (v !== undefined) o[k] = v;
}
function setVal(id, v) {
  const e = el(id);
  if (e) e.value = v == null ? "" : String(v);
}
function setRadio(name, val) {
  const r = document.querySelector(`input[name="${name}"][value="${val}"]`);
  if (r) r.checked = true;
}
/** fraction (0.08) -> valeur d'input en % (8), sans bruit flottant. */
const pctToInput = (f) => (f == null ? "" : Number((f * 100).toFixed(4)));

function formatNombre(n) {
  const e = Math.round(n);
  const signe = e < 0 ? "-" : "";
  return signe + Math.abs(e).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}
const fcfa = (n) => formatNombre(n) + " FCFA";
const pct = (f) => `${(f * 100).toFixed(1).replace(".", ",")} %`;

function esc(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}

let toastTimer;
function toast(msg, err) {
  const t = el("toast");
  t.textContent = msg;
  t.className = "toast" + (err ? " err" : "");
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 5000);
}

/* ------------------------------------------------------------------ */
/* Lignes répétables                                                  */
/* ------------------------------------------------------------------ */

const NATURES = [
  { v: "terrain", t: "Terrain" },
  { v: "construction", t: "Construction / aménagement" },
  { v: "materiel", t: "Matériel" },
  { v: "mobilier", t: "Mobilier" },
  { v: "informatique", t: "Informatique" },
  { v: "vehicule", t: "Véhicule" },
  { v: "fraisEtablissement", t: "Frais d'établissement" },
  { v: "autre", t: "Autre" },
];

function ajouterInvestissement(data) {
  data = data || {};
  const row = document.createElement("div");
  row.className = "repeat-row inv";
  row.innerHTML = `
    <label>Nature<select data-f="nature">${NATURES.map((n) => `<option value="${n.v}">${n.t}</option>`).join("")}</select></label>
    <label>Libellé<input type="text" data-f="libelle" placeholder="Ex. Four + pétrin" /></label>
    <label>Montant HT<input type="number" data-f="montant" min="0" placeholder="FCFA" /></label>
    <label>Durée amort.<input type="number" data-f="duree" min="0" placeholder="ans" /></label>
    <button type="button" class="btn-del" title="Supprimer">&times;</button>`;
  el("liste-investissements").appendChild(row);
  row.querySelector('[data-f="nature"]').value = data.nature || "materiel";
  if (data.libelle) row.querySelector('[data-f="libelle"]').value = data.libelle;
  if (data.montantHT != null) row.querySelector('[data-f="montant"]').value = data.montantHT;
  if (data.dureeAmortissement != null)
    row.querySelector('[data-f="duree"]').value = data.dureeAmortissement;
  row.querySelector(".btn-del").addEventListener("click", () => row.remove());
}

function ajouterPersonnel(data) {
  data = data || {};
  const row = document.createElement("div");
  row.className = "repeat-row perso";
  row.innerHTML = `
    <label>Intitulé du poste<input type="text" data-f="intitule" placeholder="Ex. Vendeur" /></label>
    <label>Nombre<input type="number" data-f="nombre" min="1" placeholder="1" /></label>
    <label>Salaire brut mensuel<input type="number" data-f="salaire" min="0" placeholder="FCFA / mois" /></label>
    <button type="button" class="btn-del" title="Supprimer">&times;</button>`;
  el("liste-personnel").appendChild(row);
  if (data.intitule) row.querySelector('[data-f="intitule"]').value = data.intitule;
  if (data.nombre != null) row.querySelector('[data-f="nombre"]').value = data.nombre;
  if (data.salaireBrutMensuel != null)
    row.querySelector('[data-f="salaire"]').value = data.salaireBrutMensuel;
  row.querySelector(".btn-del").addEventListener("click", () => row.remove());
}

function ajouterProduit(data) {
  data = data || {};
  const row = document.createElement("div");
  row.className = "repeat-row prod";
  row.innerHTML = `
    <label>Produit / service<input type="text" data-f="libelle" placeholder="Ex. Pain" /></label>
    <label>Prix unitaire HT<input type="number" data-f="prix" min="0" placeholder="FCFA" /></label>
    <label>Quantité / an<input type="number" data-f="qte" min="0" placeholder="unités" /></label>
    <button type="button" class="btn-del" title="Supprimer">&times;</button>`;
  el("liste-produits").appendChild(row);
  if (data.libelle) row.querySelector('[data-f="libelle"]').value = data.libelle;
  if (data.prixUnitaire != null) row.querySelector('[data-f="prix"]').value = data.prixUnitaire;
  if (data.quantiteAnnee1 != null) row.querySelector('[data-f="qte"]').value = data.quantiteAnnee1;
  row.querySelector(".btn-del").addEventListener("click", () => row.remove());
}

function construireRepartition() {
  const g = el("repartition-mois");
  g.innerHTML = "";
  const noms = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
  noms.forEach((n, i) => {
    const l = document.createElement("label");
    l.innerHTML = `${n}<input type="number" data-mois="${i}" min="0" step="0.1" />`;
    g.appendChild(l);
  });
}
const lireRepartition = () =>
  [...el("repartition-mois").querySelectorAll("input")].map((inp) => Number(inp.value) || 0);
function setRepartition(arr) {
  el("repartition-mois")
    .querySelectorAll("input")
    .forEach((inp, i) => {
      if (arr[i] != null) inp.value = arr[i];
    });
}

/* ------------------------------------------------------------------ */
/* Affichages conditionnels                                           */
/* ------------------------------------------------------------------ */

const toggleEmprunt = () => (el("bloc-emprunt").hidden = !el("empruntActif").checked);
const toggleDirigeant = () => (el("bloc-dirigeant").hidden = !el("dirigeantActif").checked);
const toggleSaison = () => (el("bloc-saison").hidden = !el("caSaisonnier").checked);
function toggleCA() {
  const mode = document.querySelector('input[name="caMode"]:checked').value;
  el("ca-simple").hidden = mode !== "simple";
  el("ca-detaille").hidden = mode !== "detaille";
  if (mode === "detaille" && !el("liste-produits").children.length) ajouterProduit();
}

/* ------------------------------------------------------------------ */
/* Construction du DossierInput à partir du formulaire                */
/* ------------------------------------------------------------------ */

function lireInvestissements() {
  return [...el("liste-investissements").querySelectorAll(".repeat-row")]
    .map((row) => {
      const o = {
        nature: row.querySelector('[data-f="nature"]').value,
        montantHT: numEl(row.querySelector('[data-f="montant"]')) ?? 0,
      };
      const lib = row.querySelector('[data-f="libelle"]').value.trim();
      if (lib) o.libelle = lib;
      const dur = numEl(row.querySelector('[data-f="duree"]'));
      if (dur !== undefined) o.dureeAmortissement = dur;
      return o;
    })
    .filter((o) => o.montantHT > 0);
}

function lirePersonnel() {
  return [...el("liste-personnel").querySelectorAll(".repeat-row")]
    .map((row) => {
      const o = {
        intitule: row.querySelector('[data-f="intitule"]').value.trim(),
        salaireBrutMensuel: numEl(row.querySelector('[data-f="salaire"]')) ?? 0,
      };
      const nb = numEl(row.querySelector('[data-f="nombre"]'));
      if (nb !== undefined) o.nombre = nb;
      return o;
    })
    .filter((o) => o.intitule && o.salaireBrutMensuel > 0);
}

function lireProduits() {
  return [...el("liste-produits").querySelectorAll(".repeat-row")]
    .map((row) => ({
      libelle: row.querySelector('[data-f="libelle"]').value.trim(),
      prixUnitaire: numEl(row.querySelector('[data-f="prix"]')) ?? 0,
      quantiteAnnee1: numEl(row.querySelector('[data-f="qte"]')) ?? 0,
    }))
    .filter((p) => p.prixUnitaire > 0 && p.quantiteAnnee1 > 0);
}

function lireFinancement() {
  const f = { apportCapital: optNum("apportCapital") ?? 0 };
  setOpt(f, "apportCompteCourant", optNum("apportCompteCourant"));
  setOpt(f, "subventionInvestissement", optNum("subvention"));
  if (el("empruntActif").checked) {
    f.emprunt = {
      montant: optNum("empruntMontant") ?? 0,
      tauxAnnuel: optPct("empruntTaux") ?? 0,
      dureeAnnees: optNum("empruntDuree") ?? 0,
    };
    setOpt(f.emprunt, "differeMois", optNum("empruntDiffere"));
  } else {
    f.emprunt = null;
  }
  return f;
}

function lireCA() {
  const mode = document.querySelector('input[name="caMode"]:checked').value;
  const ca = { mode, tauxCroissance: optPct("caCroissance") ?? 0 };
  if (mode === "simple") ca.montantAnnee1 = optNum("caMontant") ?? 0;
  else ca.produits = lireProduits();
  if (el("caSaisonnier").checked) {
    ca.saisonnier = true;
    ca.repartitionMensuelle = lireRepartition();
  }
  return ca;
}

function lireCharges() {
  const mode = el("achatsMode").value;
  const brut = optNum("achatsValeur") ?? 0;
  const c = {
    achatsMatieres: { mode, valeur: mode === "pourcentageCA" ? brut / 100 : brut },
  };
  [
    "loyerMensuel",
    "eauElectriciteMensuel",
    "telecomMensuel",
    "transportCarburantAnnuel",
    "assurancesAnnuel",
    "honorairesAnnuel",
    "marketingAnnuel",
    "entretienDiversAnnuel",
    "impotsTaxesAnnuel",
  ].forEach((k) => setOpt(c, k, optNum(k)));
  return c;
}

function construireInput() {
  const input = {
    nomProjet: el("nomProjet").value.trim(),
    secteur: el("secteur").value.trim(),
    formeJuridique: el("formeJuridique").value,
    moisDemarrage: {
      mois: Number(el("mois").value),
      annee: optNum("annee") ?? new Date().getFullYear(),
    },
    assujettiTVA: el("assujettiTVA").checked,
    investissements: lireInvestissements(),
    financement: lireFinancement(),
    chiffreAffaires: lireCA(),
    charges: lireCharges(),
    personnel: lirePersonnel(),
    delais: {},
  };
  setOpt(input.delais, "delaiClientsJours", optNum("delaiClients"));
  setOpt(input.delais, "delaiFournisseursJours", optNum("delaiFournisseurs"));
  setOpt(input.delais, "delaiStockJours", optNum("delaiStock"));

  input.salaireDirigeant = el("dirigeantActif").checked
    ? { montantMensuel: optNum("dirigeantMontant") ?? 0 }
    : null;

  const p = {};
  setOpt(p, "tauxTVA", optPct("tauxTVA"));
  setOpt(p, "tauxIS", optPct("tauxIS"));
  setOpt(p, "tauxChargesSocialesPatronales", optPct("tauxCharges"));
  if (Object.keys(p).length) input.parametres = p;

  return input;
}

/* ------------------------------------------------------------------ */
/* Préremplissage depuis un DossierInput                              */
/* ------------------------------------------------------------------ */

function remplir(ex) {
  setVal("nomProjet", ex.nomProjet);
  setVal("secteur", ex.secteur);
  el("formeJuridique").value = ex.formeJuridique || "EI";
  el("mois").value = String(ex.moisDemarrage?.mois || 1);
  setVal("annee", ex.moisDemarrage?.annee);
  el("assujettiTVA").checked = !!ex.assujettiTVA;

  el("liste-investissements").innerHTML = "";
  (ex.investissements || []).forEach(ajouterInvestissement);
  if (!el("liste-investissements").children.length) ajouterInvestissement();

  const fin = ex.financement || {};
  setVal("apportCapital", fin.apportCapital);
  setVal("apportCompteCourant", fin.apportCompteCourant);
  setVal("subvention", fin.subventionInvestissement);
  el("empruntActif").checked = !!fin.emprunt;
  toggleEmprunt();
  if (fin.emprunt) {
    setVal("empruntMontant", fin.emprunt.montant);
    setVal("empruntTaux", pctToInput(fin.emprunt.tauxAnnuel));
    setVal("empruntDuree", fin.emprunt.dureeAnnees);
    setVal("empruntDiffere", fin.emprunt.differeMois);
  }

  const ca = ex.chiffreAffaires || { mode: "simple" };
  setRadio("caMode", ca.mode || "simple");
  el("liste-produits").innerHTML = "";
  (ca.produits || []).forEach(ajouterProduit);
  toggleCA();
  setVal("caMontant", ca.montantAnnee1);
  setVal("caCroissance", pctToInput(ca.tauxCroissance));
  el("caSaisonnier").checked = !!ca.saisonnier;
  toggleSaison();
  if (ca.repartitionMensuelle) setRepartition(ca.repartitionMensuelle);

  const c = ex.charges || { achatsMatieres: { mode: "pourcentageCA", valeur: 0 } };
  el("achatsMode").value = c.achatsMatieres.mode;
  setVal(
    "achatsValeur",
    c.achatsMatieres.mode === "pourcentageCA"
      ? pctToInput(c.achatsMatieres.valeur)
      : c.achatsMatieres.valeur,
  );
  [
    "loyerMensuel",
    "eauElectriciteMensuel",
    "telecomMensuel",
    "transportCarburantAnnuel",
    "assurancesAnnuel",
    "honorairesAnnuel",
    "marketingAnnuel",
    "entretienDiversAnnuel",
    "impotsTaxesAnnuel",
  ].forEach((k) => setVal(k, c[k]));

  el("liste-personnel").innerHTML = "";
  (ex.personnel || []).forEach(ajouterPersonnel);
  if (!el("liste-personnel").children.length) ajouterPersonnel();
  el("dirigeantActif").checked = !!ex.salaireDirigeant;
  toggleDirigeant();
  if (ex.salaireDirigeant) setVal("dirigeantMontant", ex.salaireDirigeant.montantMensuel);

  const d = ex.delais || {};
  setVal("delaiClients", d.delaiClientsJours);
  setVal("delaiFournisseurs", d.delaiFournisseursJours);
  setVal("delaiStock", d.delaiStockJours);

  const par = ex.parametres || {};
  setVal("tauxTVA", par.tauxTVA != null ? pctToInput(par.tauxTVA) : "");
  setVal("tauxIS", par.tauxIS != null ? pctToInput(par.tauxIS) : "");
  setVal(
    "tauxCharges",
    par.tauxChargesSocialesPatronales != null ? pctToInput(par.tauxChargesSocialesPatronales) : "",
  );
}

/* ------------------------------------------------------------------ */
/* Résultats                                                          */
/* ------------------------------------------------------------------ */

function kpi(lbl, val, neg, sub) {
  return `<div class="kpi"><div class="lbl">${esc(lbl)}</div><div class="val${
    neg ? " neg" : ""
  }">${esc(val)}</div>${sub ? `<div class="sub">${esc(sub)}</div>` : ""}</div>`;
}

function afficherResultats(o) {
  const ind = o.indicateurs,
    t5 = o.t5,
    t9 = o.t9;
  const dscr1 = ind.dscr[0];
  const treso = Math.min(...t9.soldeCumule);

  el("res-titre").textContent = "Résultats — " + (o.meta.nomProjet || "Projet");
  el("res-cartes").innerHTML = [
    kpi("Chiffre d'affaires — An 1", fcfa(t5.chiffreAffaires[0])),
    kpi("Résultat net — An 1", fcfa(t5.resultatNet[0]), t5.resultatNet[0] < 0),
    kpi("Résultat net — An 5", fcfa(t5.resultatNet[4]), t5.resultatNet[4] < 0),
    kpi("CAF — An 1", fcfa(ind.caf[0])),
    kpi("Seuil de rentabilité — An 1", fcfa(ind.seuilRentabilite[0])),
    kpi(
      "DSCR — An 1",
      dscr1 == null ? "—" : dscr1.toFixed(2),
      dscr1 != null && dscr1 < 1.2,
      dscr1 == null ? "pas de dette" : dscr1 < 1.2 ? "sous le seuil banque (1,20)" : "au-dessus du seuil banque",
    ),
    kpi("Trésorerie mini — An 1", fcfa(treso), treso < 0),
  ].join("");

  const av = o.avertissements || [];
  el("res-alertes").innerHTML = av.length
    ? `<div class="alerte"><strong>Points de vigilance</strong><ul>${av
        .map((a) => `<li>${esc(a)}</li>`)
        .join("")}</ul></div>`
    : `<div class="alerte" style="background:#e9f6ef;border-color:#bfe3cd;color:#1a7f52"><strong style="color:#1a7f52">Cohérence OK</strong>Aucune alerte détectée sur ce prévisionnel.</div>`;

  const pu = o.parametresUtilises;
  el("res-note").textContent =
    `Taux appliqués — TVA ${pct(pu.tauxTVA)}, IS ${pct(pu.tauxIS)}, charges patronales ${pct(
      pu.tauxChargesSocialesPatronales,
    )}. Généré le ${new Date(o.meta.dateGeneration).toLocaleDateString("fr-FR")}.`;

  el("resultats").hidden = false;
  el("resultats").scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ------------------------------------------------------------------ */
/* Appels API                                                         */
/* ------------------------------------------------------------------ */

async function poster(url, input) {
  return fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}

async function generer(e) {
  e.preventDefault();
  const btn = e.submitter || document.querySelector('#form-dossier button[type="submit"]');
  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Calcul en cours…";
  try {
    const r = await poster("/api/dossier", construireInput());
    const j = await r.json();
    if (!j.ok) {
      toast(j.error || "Entrée invalide.", true);
      return;
    }
    afficherResultats(j.output);
  } catch (err) {
    toast("Serveur injoignable : " + err.message, true);
  } finally {
    btn.disabled = false;
    btn.textContent = label;
  }
}

async function ouvrirHTML() {
  try {
    const r = await poster("/api/dossier/html", construireInput());
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      toast(j.error || "Impossible de générer le dossier.", true);
      return;
    }
    const url = URL.createObjectURL(new Blob([await r.text()], { type: "text/html" }));
    window.open(url, "_blank");
  } catch (err) {
    toast("Serveur injoignable : " + err.message, true);
  }
}

async function telechargerPDF() {
  const btn = el("btn-pdf");
  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Génération du PDF…";
  try {
    const r = await poster("/api/dossier/pdf", construireInput());
    const ct = r.headers.get("content-type") || "";
    if (!ct.includes("pdf")) {
      const j = await r.json().catch(() => ({}));
      toast(j.error || "PDF indisponible.", true);
      return;
    }
    const url = URL.createObjectURL(await r.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = "previsionnel-raktak.pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    toast("Serveur injoignable : " + err.message, true);
  } finally {
    btn.disabled = false;
    btn.textContent = label;
  }
}

/* ------------------------------------------------------------------ */
/* Initialisation                                                     */
/* ------------------------------------------------------------------ */

function brancherEvenements() {
  document.querySelectorAll("[data-add]").forEach((b) =>
    b.addEventListener("click", () => {
      const kind = b.getAttribute("data-add");
      if (kind === "investissement") ajouterInvestissement();
      if (kind === "personnel") ajouterPersonnel();
      if (kind === "produit") ajouterProduit();
    }),
  );
  el("empruntActif").addEventListener("change", toggleEmprunt);
  el("dirigeantActif").addEventListener("change", toggleDirigeant);
  el("caSaisonnier").addEventListener("change", toggleSaison);
  document
    .querySelectorAll('input[name="caMode"]')
    .forEach((r) => r.addEventListener("change", toggleCA));
  el("form-dossier").addEventListener("submit", generer);
  el("btn-html").addEventListener("click", ouvrirHTML);
  el("btn-pdf").addEventListener("click", telechargerPDF);
  el("btn-exemple").addEventListener("click", chargerExemple);
}

async function chargerExemple() {
  try {
    const r = await fetch("/api/exemple");
    remplir(await r.json());
    toast("Exemple chargé : Boulangerie La Teranga.");
  } catch {
    toast("Impossible de charger l'exemple.", true);
  }
}

async function init() {
  construireRepartition();
  brancherEvenements();
  try {
    const r = await fetch("/api/exemple");
    remplir(await r.json());
  } catch {
    // pas d'exemple : formulaire vide avec une ligne par liste
    ajouterInvestissement();
    ajouterPersonnel();
    toggleCA();
  }
}

init();
