"use server";

/**
 * Server actions du portefeuille d'entreprises (CRUD + entreprise active).
 * Deleguent a lib/entreprise-serveur.ts (client session -> RLS). Ne calculent
 * aucun montant : ce ne sont que des identites/parametres d'entreprise.
 */
import { revalidatePath } from "next/cache";
import type { Entreprise } from "@/lib/engine";
import type { EntrepriseBrouillon } from "@/lib/entreprise-store";
import {
  creerEntreprise,
  modifierEntreprise,
  supprimerEntreprise,
  ecrireEntrepriseActiveId,
} from "@/lib/entreprise-serveur";

export async function creerEntrepriseAction(b: EntrepriseBrouillon): Promise<Entreprise> {
  const e = await creerEntreprise(b);
  revalidatePath("/", "layout");
  return e;
}

export async function modifierEntrepriseAction(
  id: string,
  patch: Partial<Entreprise>,
): Promise<Entreprise> {
  const e = await modifierEntreprise(id, patch);
  revalidatePath("/", "layout");
  return e;
}

export async function supprimerEntrepriseAction(id: string): Promise<void> {
  await supprimerEntreprise(id);
  revalidatePath("/", "layout");
}

export async function definirEntrepriseActiveAction(id: string | null): Promise<void> {
  await ecrireEntrepriseActiveId(id);
}
