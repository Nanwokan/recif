export type Rule = (value: unknown) => string | null;
export type Schema = Record<string, Rule>; // nom du champ → sa règle

export const text =
  (min: number, max: number): Rule =>
  (value) =>
    typeof value === "string" &&
    value.trim().length >= min &&
    value.trim().length <= max
      ? null
      : `texte de ${min} à ${max} caractères attendu`;

export const oneOf =
  (values: readonly string[]): Rule =>
  (value) =>
    typeof value === "string" && values.includes(value)
      ? null
      : "valeur inconnue";

// Champ facultatif : absent ou null, il est accepté ; présent, il doit respecter la règle
export const optional =
  (rule: Rule): Rule =>
  (value) =>
    value === undefined || value === null ? null : rule(value);

// À vous : email (une regex simple suffit) et isoDate (AAAA-MM-JJ, date qui existe
export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; errors: string[] };
export const email = (): Rule => (value) =>
  typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
    ? null
    : "email invalide";
export const isoDate = (): Rule => (value) =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? null
    : "date au format AAAA-MM-JJ attendue";

export function validate<T = Record<string, any>>(
  schema: Schema,
  input: unknown,
  options: { partial?: boolean } = {}, // partial : pour une modification
): ValidationResult<T> {
  const data: Record<string, any> = {};
  const errors: Record<string, string> = {};

  // Pour chaque champ du schéma :
  for (const [champ, rule] of Object.entries(schema)) {
    const value = input[champ];
    const isAbsent = value === null || value === "";
    //  - absent et options.partial → on l'ignore ;
    if (value === undefined && options.partial) {
      continue;
    }

    //  - sinon on applique la règle : un message → on l'ajoute aux erreurs ;
    const error = rule(value);
    if (error) {
      errors[champ] = error;
    } else if (!isAbsent) {
    //  - valide → on le recopie dans data (texte nettoyé avec trim()).
      data[champ] = typeof value === "string" ? value.trim() : value;
    }
  }
  // Les champs qui ne sont PAS dans le schéma ne sont jamais recopiés.

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors: Object.entries(errors).map(([champ, message]) => `${champ} : ${message}`) };
  }
  return { ok: true, data: data as T };
}
