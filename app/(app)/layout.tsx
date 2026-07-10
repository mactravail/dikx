import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { EntrepriseProvider } from "@/lib/entreprise-context";
import { SessionProvider, type AppRole, type SessionValeur } from "@/lib/session-context";
import { creerClientServeur } from "@/lib/supabase/server";
import {
  chargerEntreprises,
  lireEntrepriseActiveId,
  resoudreEntrepriseActive,
} from "@/lib/entreprise-serveur";

/**
 * Layout de l'ERP. Composant SERVEUR : exige une session (sinon -> /login),
 * garantit l'existence du profil (role), charge le portefeuille (Supabase/RLS)
 * et l'entreprise active (cookie), puis injecte session + entreprise dans la coque.
 */
export default async function AppGroupLayout({ children }: { children: React.ReactNode }) {
  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Profil (role) : cree paresseusement au 1er acces (cas confirmation email),
  // a partir des metadonnees d'inscription. Insert autorise par profil_insert_self.
  const { data: profilExistant } = await supabase
    .from("profil")
    .select("role, nom, email")
    .eq("id", user.id)
    .maybeSingle();

  let role: AppRole;
  let nom: string | null;

  if (profilExistant) {
    role = profilExistant.role as AppRole;
    nom = (profilExistant.nom as string | null) ?? null;
  } else {
    role = (user.user_metadata?.role as string | undefined) === "entreprise" ? "entreprise" : "comptable";
    nom = (user.user_metadata?.nom as string | undefined) ?? null;
    await supabase.from("profil").insert({ id: user.id, role, nom, email: user.email });
  }

  const session: SessionValeur = {
    userId: user.id,
    email: user.email ?? "",
    role,
    nom,
  };

  // Portefeuille + entreprise active. Un utilisateur « entreprise » est verrouille
  // sur son unique entreprise (RLS ne lui renvoie que la sienne).
  const entreprises = await chargerEntreprises();
  const cookieId = await lireEntrepriseActiveId();
  const activeId =
    role === "entreprise"
      ? entreprises[0]?.id ?? null
      : resoudreEntrepriseActive(entreprises, cookieId);

  return (
    <SessionProvider valeur={session}>
      <EntrepriseProvider
        initialEntreprises={entreprises}
        initialActiveId={activeId}
        verrouille={role === "entreprise"}
      >
        <AppShell>{children}</AppShell>
      </EntrepriseProvider>
    </SessionProvider>
  );
}
