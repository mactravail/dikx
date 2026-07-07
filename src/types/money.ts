/**
 * Type monetaire du moteur.
 *
 * Toute somme finale du dossier est un ENTIER de FCFA (XOF, 0 decimale).
 * Les calculs intermediaires (interets, amortissements, %) peuvent produire
 * des decimales ; on arrondit a l'entier FCFA UNIQUEMENT au moment de produire
 * une ligne de sortie, via la fonction unique `arrondiFCFA()` (voir engine/arrondi.ts).
 *
 * `FCFA` reste un alias de `number` : le compilateur ne distingue pas un entier
 * d'un decimal. La discipline est donc : ne jamais stocker dans un champ de sortie
 * une valeur qui n'est pas passee par `arrondiFCFA()`.
 */
export type FCFA = number;

/** Un pourcentage exprime en fraction : 0.18 = 18 %. */
export type Taux = number;

/** Serie d'une valeur sur l'horizon (5 ans). Index 0 = annee 1. */
export type Serie5 = [number, number, number, number, number];

/** Serie monetaire sur l'horizon (5 ans), en FCFA entiers. */
export type Serie5FCFA = [FCFA, FCFA, FCFA, FCFA, FCFA];

/** Serie mensuelle sur 12 mois. Index 0 = mois 1. */
export type Serie12<T = number> = [T, T, T, T, T, T, T, T, T, T, T, T];
