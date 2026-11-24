import { config } from "../config.js";

// Un identifiant invalide (abc, 0, 1.5) donne 400 sur toutes les routes (aujourd'hui : 404, 500 ou rien)
export default function parseId(raw : unknown) : number {
    const id = Number(raw);
    if (Number.isNaN(id)) throw new Error(`Identifiant invalide : ${raw}`);
    if (!Number.isInteger(id)) throw new Error(`Identifiant invalide : ${raw}`);
    if (id <= 0) throw new Error(`Identifiant invalide : ${raw}`);
    return id;
}

// une seule fonction qui compare req.get("X-Api-Key") à config.adminApiKey
export function isAdminKeyValid(key: unknown): boolean {
    return key === config.adminApiKey;
}

// une seule fonction paramétrée par la décision ("acceptee" ou "refusee").
export function isAdoptionDecisionValid(decision: unknown): boolean {
    return decision === "acceptee" || decision === "refusee";
}