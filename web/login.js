/* dikx — page de connexion (aucune dépendance).
 *
 * Rôle : collecter email + mot de passe, les envoyer au serveur qui parle à
 * Supabase Auth (le navigateur ne voit JAMAIS de clé Supabase), puis rediriger
 * vers l'app en cas de succès. Aucun chiffre ni taux ici. */

"use strict";

const el = (id) => document.getElementById(id);

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
/* Bascule Connexion <-> Inscription                                   */
/* ------------------------------------------------------------------ */

let mode = "login"; // "login" | "signup"

const TEXTES = {
  login: {
    title: "Connexion",
    lead: "Accédez à vos dossiers prévisionnels et générez votre PDF.",
    submit: "Se connecter",
    switchText: "Pas encore de compte ?",
    switchLink: "Créer un compte",
    passAutocomplete: "current-password",
  },
  signup: {
    title: "Créer un compte",
    lead: "Créez votre compte dikx pour bâtir votre prévisionnel 5 ans.",
    submit: "Créer mon compte",
    switchText: "Vous avez déjà un compte ?",
    switchLink: "Se connecter",
    passAutocomplete: "new-password",
  },
};

function appliquerMode(m) {
  mode = m;
  const t = TEXTES[m];
  const signup = m === "signup";

  el("auth-title").textContent = t.title;
  el("auth-lead").textContent = t.lead;
  el("submit").textContent = t.submit;
  el("switch-text").textContent = t.switchText;
  el("switch-link").textContent = t.switchLink;
  el("password").setAttribute("autocomplete", t.passAutocomplete);

  // Champs propres à l'inscription
  el("field-nom").hidden = !signup;
  el("field-confirm").hidden = !signup;
  el("pass-help").hidden = !signup;
  // Options propres à la connexion
  el("row-options").hidden = signup;

  // Onglets
  el("tab-login").classList.toggle("is-active", !signup);
  el("tab-login").setAttribute("aria-selected", String(!signup));
  el("tab-signup").classList.toggle("is-active", signup);
  el("tab-signup").setAttribute("aria-selected", String(signup));
}

el("tab-login").addEventListener("click", () => appliquerMode("login"));
el("tab-signup").addEventListener("click", () => appliquerMode("signup"));
el("switch-link").addEventListener("click", (e) => {
  e.preventDefault();
  appliquerMode(mode === "login" ? "signup" : "login");
  el("email").focus();
});

/* ------------------------------------------------------------------ */
/* Afficher / masquer le mot de passe                                  */
/* ------------------------------------------------------------------ */

el("toggle-pass").addEventListener("click", () => {
  const input = el("password");
  const montre = input.type === "password";
  input.type = montre ? "text" : "password";
  el("toggle-pass").textContent = montre ? "Masquer" : "Afficher";
});

/* ------------------------------------------------------------------ */
/* Mot de passe oublié                                                 */
/* ------------------------------------------------------------------ */

el("link-forgot").addEventListener("click", (e) => {
  e.preventDefault();
  const email = el("email").value.trim();
  if (!email) {
    toast("Saisissez d'abord votre email, puis cliquez sur « Mot de passe oublié ».", true);
    el("email").focus();
    return;
  }
  envoyer("/api/auth/reset", { email }, () =>
    toast("Si un compte existe, un lien de réinitialisation a été envoyé à " + email + "."),
  );
});

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

function emailValide(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

/** Renvoie un message d'erreur, ou null si tout est valide. */
function valider() {
  const email = el("email").value.trim();
  const password = el("password").value;

  if (!emailValide(email)) return "Adresse email invalide.";
  if (!password) return "Le mot de passe est requis.";

  if (mode === "signup") {
    if (password.length < 8) return "Le mot de passe doit contenir au moins 8 caractères.";
    if (password !== el("confirm").value) return "Les deux mots de passe ne correspondent pas.";
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Envoi                                                               */
/* ------------------------------------------------------------------ */

/** POST JSON vers le serveur, gère erreurs réseau + réponses non-ok. */
async function envoyer(url, corps, onSucces) {
  const btn = el("submit");
  const libelle = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Un instant…";
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(corps),
    });
    let data = {};
    try {
      data = await res.json();
    } catch (_) {
      /* réponse sans corps JSON */
    }
    if (!res.ok || data.ok === false) {
      toast(data.error || "Échec (" + res.status + "). Réessayez.", true);
      return;
    }
    onSucces(data);
  } catch (_) {
    toast("Impossible de joindre le serveur. Vérifiez votre connexion.", true);
  } finally {
    btn.disabled = false;
    btn.textContent = libelle;
  }
}

el("auth-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const erreur = valider();
  if (erreur) {
    toast(erreur, true);
    return;
  }

  const corps = {
    email: el("email").value.trim(),
    password: el("password").value,
  };
  if (mode === "signup") corps.nom = el("nom").value.trim();

  const url = mode === "login" ? "/api/auth/login" : "/api/auth/signup";

  envoyer(url, corps, (data) => {
    if (mode === "signup" && data.confirmationRequise) {
      toast("Compte créé. Vérifiez votre email pour confirmer votre inscription.");
      appliquerMode("login");
      return;
    }
    toast(mode === "login" ? "Connexion réussie." : "Compte créé.");
    // Redirection vers l'app (le serveur a posé le cookie de session).
    window.location.assign("/app");
  });
});

// Etat initial explicite (connexion), puis focus.
appliquerMode("login");
el("email").focus();
