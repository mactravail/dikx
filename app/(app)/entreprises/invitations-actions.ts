"use server";

/**
 * Invitations : le COMPTABLE invite l'utilisateur d'une entreprise par email ;
 * l'invite accepte via un lien, choisit son mot de passe et est rattache a SON
 * entreprise (role « entreprise »).
 *
 * Regle : une entreprise ne rejoint que le cabinet qui l'a invitee — materialise
 * par la ligne `invitation` (couple cabinet_id / entreprise_id).
 *
 * Le client ADMIN (service_role) est requis (creation d'utilisateur + envoi de
 * l'email + ecriture profil/rattachement). Necessite SUPABASE_SERVICE_ROLE_KEY.
 */
import { headers } from "next/headers";
import { creerClientServeur } from "@/lib/supabase/server";
import { creerClientAdmin } from "@/lib/supabase/admin";
import { ecrireEntrepriseActiveId } from "@/lib/entreprise-serveur";

export interface InvitationVue {
  id: string;
  email: string;
  statut: string;
  createdAt: string;
}

export type ResultatInvitation = { ok: true; message: string } | { ok: false; erreur: string };

async function origine(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

const JOURS_VALIDITE = 7;

/** Le comptable invite un utilisateur pour une de SES entreprises. */
export async function inviterEntrepriseAction(
  entrepriseId: string,
  email: string,
): Promise<ResultatInvitation> {
  const courriel = email.trim().toLowerCase();
  if (!courriel || !courriel.includes("@")) {
    return { ok: false, erreur: "Adresse email invalide." };
  }

  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, erreur: "Non authentifie." };

  // Verifie que le comptable possede bien cette entreprise (RLS : ne renvoie que
  // les entreprises dont il est le cabinet).
  const { data: ent } = await supabase
    .from("entreprise")
    .select("id, raison_sociale")
    .eq("id", entrepriseId)
    .maybeSingle();
  if (!ent) return { ok: false, erreur: "Entreprise introuvable ou acces refuse." };

  const token = crypto.randomUUID();
  const next = `/accepter-invitation?token=${token}`;
  const redirectTo = `${await origine()}/auth/callback?next=${encodeURIComponent(next)}`;

  let admin;
  try {
    admin = creerClientAdmin();
  } catch (e) {
    return { ok: false, erreur: (e as Error).message };
  }

  // Envoi de l'invitation (cree l'utilisateur Auth si nouveau).
  const { data: invite, error: errInvite } = await admin.auth.admin.inviteUserByEmail(courriel, {
    data: { role: "entreprise" },
    redirectTo,
  });

  let inviteeUserId: string | null = invite?.user?.id ?? null;
  let message = `Invitation envoyee a ${courriel}.`;

  if (errInvite) {
    // Email deja enregistre : on cree quand meme l'invitation ; la personne
    // ouvrira le lien en etant connectee a son compte existant.
    const dejaInscrit = /already|registered|exist/i.test(errInvite.message);
    if (!dejaInscrit) {
      return { ok: false, erreur: errInvite.message };
    }
    message =
      `Cet email a deja un compte. Une invitation a ete creee : transmettez le lien d'acceptation ` +
      `ou demandez-lui de se connecter puis d'ouvrir ${next}.`;
  }

  const expires = new Date(Date.now() + JOURS_VALIDITE * 24 * 3600 * 1000).toISOString();
  const { error: errInsert } = await admin.from("invitation").insert({
    entreprise_id: entrepriseId,
    cabinet_id: user.id,
    email: courriel,
    token,
    statut: "en_attente",
    invitee_user_id: inviteeUserId,
    expires_at: expires,
  });
  if (errInsert) return { ok: false, erreur: errInsert.message };

  return { ok: true, message };
}

/** Invitations d'une entreprise (pour affichage cote comptable). */
export async function listerInvitationsAction(entrepriseId: string): Promise<InvitationVue[]> {
  const supabase = await creerClientServeur();
  const { data, error } = await supabase
    .from("invitation")
    .select("id, email, statut, created_at")
    .eq("entreprise_id", entrepriseId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return (data as Array<{ id: string; email: string; statut: string; created_at: string }>).map(
    (r) => ({ id: r.id, email: r.email, statut: r.statut, createdAt: r.created_at }),
  );
}

export async function revoquerInvitationAction(id: string): Promise<void> {
  const supabase = await creerClientServeur();
  await supabase.from("invitation").update({ statut: "revoquee" }).eq("id", id);
}

/**
 * L'invite (authentifie via le lien) accepte : mot de passe + rattachement.
 * Ecritures via le client ADMIN (profil/rattachement/statut), sous controle du
 * token d'invitation.
 */
export async function accepterInvitationAction(
  token: string,
  motDePasse: string,
): Promise<ResultatInvitation> {
  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, erreur: "Lien invalide ou session expiree. Rouvrez le lien recu par email." };

  if (motDePasse.length < 8) {
    return { ok: false, erreur: "Le mot de passe doit contenir au moins 8 caracteres." };
  }

  let admin;
  try {
    admin = creerClientAdmin();
  } catch (e) {
    return { ok: false, erreur: (e as Error).message };
  }

  const { data: inv } = await admin
    .from("invitation")
    .select("id, entreprise_id, statut, expires_at")
    .eq("token", token)
    .maybeSingle();
  if (!inv) return { ok: false, erreur: "Invitation introuvable." };
  if (inv.statut !== "en_attente") return { ok: false, erreur: "Cette invitation n'est plus valide." };
  if (inv.expires_at && new Date(inv.expires_at).getTime() < Date.now()) {
    await admin.from("invitation").update({ statut: "expiree" }).eq("id", inv.id);
    return { ok: false, erreur: "Cette invitation a expire." };
  }

  // Mot de passe (client session : agit sur l'utilisateur connecte).
  const { error: errPwd } = await supabase.auth.updateUser({ password: motDePasse });
  if (errPwd) return { ok: false, erreur: errPwd.message };

  // Profil (role entreprise) + rattachement, idempotents.
  const { error: errProfil } = await admin
    .from("profil")
    .upsert({ id: user.id, role: "entreprise", email: user.email }, { onConflict: "id" });
  if (errProfil) return { ok: false, erreur: errProfil.message };

  const { error: errMembre } = await admin
    .from("membre_entreprise")
    .upsert(
      { user_id: user.id, entreprise_id: inv.entreprise_id },
      { onConflict: "user_id,entreprise_id" },
    );
  if (errMembre) return { ok: false, erreur: errMembre.message };

  await admin
    .from("invitation")
    .update({ statut: "acceptee", invitee_user_id: user.id, accepted_at: new Date().toISOString() })
    .eq("id", inv.id);

  await ecrireEntrepriseActiveId(inv.entreprise_id);

  return { ok: true, message: "Votre acces est configure." };
}
