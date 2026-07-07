/**
 * Ports (interfaces) de la couche API — architecture ports & adapters.
 *
 * L'orchestrateur `produireDossier` ne depend QUE de ces interfaces ; les
 * implementations reelles (Supabase, email) sont injectees. Cela garde la
 * logique testable sans service externe.
 */

import type { DossierOutput } from "../types/dossier-output.js";
import type {
  DossierRow,
  InvestissementRow,
  PostePersonnelRow,
  ProduitRow,
} from "../db/types.js";

export type StatutGeneration = "en_attente" | "genere" | "envoye" | "erreur";

/** Toutes les lignes d'un dossier, lues depuis le stockage. */
export interface DonneesDossier {
  dossier: DossierRow;
  investissements: InvestissementRow[];
  postes: PostePersonnelRow[];
  produits: ProduitRow[];
}

/** Ligne `generations` a inserer. */
export interface GenerationAEnregistrer {
  dossierId: string;
  statut: StatutGeneration;
  sortie: DossierOutput | null;
  avertissements: string[];
  pdfPath: string | null;
  emailDestinataire: string | null;
  emailEnvoyeAt: string | null;
  erreur: string | null;
}

/** Acces aux donnees (lecture dossier, ecriture generation/statut). */
export interface DossierRepository {
  chargerDossier(dossierId: string): Promise<DonneesDossier | null>;
  enregistrerGeneration(g: GenerationAEnregistrer): Promise<{ id: string }>;
  marquerStatutDossier(dossierId: string, statut: StatutGeneration): Promise<void>;
}

/** Conversion DossierOutput -> PDF. */
export interface PdfRenderer {
  rendre(dossier: DossierOutput): Promise<Uint8Array>;
}

/** Stockage du PDF (Supabase Storage). */
export interface StorageGateway {
  televerserPDF(chemin: string, pdf: Uint8Array): Promise<{ chemin: string; url: string | null }>;
}

/** Piece jointe email. */
export interface PieceJointe {
  nom: string;
  contenu: Uint8Array;
  type: string;
}

/** Message email a envoyer. */
export interface EmailMessage {
  destinataire: string;
  sujet: string;
  html: string;
  pieceJointe?: PieceJointe;
}

/** Envoi d'email. */
export interface Mailer {
  envoyer(message: EmailMessage): Promise<void>;
}
