import { describe, expect, it } from "vitest";
import { genererDashboardHTML, type DashboardData } from "../src/dashboard/template.js";

const donnees: DashboardData = {
  supabaseConfigure: true,
  erreur: null,
  dossiers: [
    {
      id: "11111111-1111-1111-1111-111111111111",
      nomProjet: "Boulangerie <Teranga>",
      secteur: "Boulangerie",
      formeJuridique: "SARL",
      statut: "genere",
      telephone: "+221770000000",
      creeLe: "2026-06-15T08:47:00.000Z",
    },
  ],
  conversations: [
    {
      id: "22222222-2222-2222-2222-222222222222",
      telephone: "+221770000000",
      statut: "en_cours",
      etapeCourante: "3.2",
      dernierMessage: "2026-06-15T09:10:00.000Z",
      creeLe: "2026-06-15T08:00:00.000Z",
    },
  ],
  generations: [
    {
      id: "33333333-3333-3333-3333-333333333333",
      dossierNom: "Boulangerie <Teranga>",
      statut: "envoye",
      emailDestinataire: "client@example.com",
      emailEnvoyeAt: "2026-06-15T09:30:00.000Z",
      erreur: null,
      creeLe: "2026-06-15T09:29:00.000Z",
    },
  ],
};

describe("genererDashboardHTML", () => {
  it("produit un document HTML complet", () => {
    const html = genererDashboardHTML(donnees);
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("Tableau de bord");
    expect(html).toContain("</html>");
  });

  it("affiche les trois sections avec leurs comptes", () => {
    const html = genererDashboardHTML(donnees);
    expect(html).toContain("Dossiers");
    expect(html).toContain("Conversations WhatsApp");
    expect(html).toContain("Générations");
  });

  it("echappe le HTML des donnees (anti-injection)", () => {
    const html = genererDashboardHTML(donnees);
    expect(html).toContain("Boulangerie &lt;Teranga&gt;");
    expect(html).not.toContain("<Teranga>");
  });

  it("lie chaque dossier vers son apercu, son PDF et son JSON", () => {
    const html = genererDashboardHTML(donnees);
    const id = "11111111-1111-1111-1111-111111111111";
    expect(html).toContain(`/dossier/${id}`);
    expect(html).toContain(`/dossier/${id}.pdf`);
    expect(html).toContain(`/dossier/${id}.json`);
  });

  it("formate les dates en JJ/MM/AAAA HH:mm (UTC)", () => {
    const html = genererDashboardHTML(donnees);
    expect(html).toContain("15/06/2026 08:47");
  });

  it("affiche l'encart de configuration quand Supabase n'est pas configure", () => {
    const html = genererDashboardHTML({
      dossiers: [],
      conversations: [],
      generations: [],
      supabaseConfigure: false,
    });
    expect(html).toContain("Supabase non configuré");
    expect(html).toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("affiche un message quand une liste est vide", () => {
    const html = genererDashboardHTML({
      dossiers: [],
      conversations: [],
      generations: [],
      supabaseConfigure: true,
      erreur: null,
    });
    expect(html).toContain("Aucun dossier.");
    expect(html).toContain("Aucune conversation.");
    expect(html).toContain("Aucune génération.");
  });

  it("affiche l'erreur de lecture si presente", () => {
    const html = genererDashboardHTML({
      dossiers: [],
      conversations: [],
      generations: [],
      supabaseConfigure: true,
      erreur: "Supabase 401 Unauthorized",
    });
    expect(html).toContain("Erreur de lecture Supabase");
    expect(html).toContain("Supabase 401 Unauthorized");
  });
});
