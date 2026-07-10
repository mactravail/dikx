/**
 * Etat de TRANSMISSION d'une saisie de l'entreprise vers le comptable (0013).
 *
 *   brouillon : saisi, encore prive (le comptable ne le voit pas).
 *   envoye    : transmis au comptable (verrouille cote entreprise ; rappel possible).
 *
 * `undefined` est traite comme `brouillon` (lignes en cours de saisie non encore
 * persistees). Type pur, importable cote client comme serveur.
 */
export type EtatTransmission = "brouillon" | "envoye";

/** true si la ligne est verrouillee pour l'entreprise (deja envoyee). */
export function estEnvoye(t: EtatTransmission | undefined): boolean {
  return t === "envoye";
}
