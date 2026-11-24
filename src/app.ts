import express from "express";
import { db } from "./data/db.js";
import { buildWhere } from "./utils/query-helper.js";
import { validate } from "./schemas/validation.js";
import { fishSchema } from "./schemas/fish.schema.js";
import parseId, { isAdminKeyValid } from "./schemas/common.js";

const DB_FILE = process.env.DB_FILE || "recif.db";

export function createApp() {
  const app = express();

  // ---------------------------------------------------------------- POISSONS

  // Liste des poissons, avec filtres ?species= et ?status=
  app.get("/fish", (req, res) => {
    try {
      const filters: any = {};
      if (req.query.species)
        filters.species = { op: "eq", value: req.query.species };
      if (req.query.status)
        filters.status = { op: "eq", value: req.query.status };
      const rows = db
        .prepare("SELECT * FROM fish " + buildWhere(filters) + " ORDER BY id")
        .all();
      res.status(200).json(rows);
    } catch (e) {
      console.log(e);
      res.status(500).send("Erreur");
    }
  });

  // Détail d'un poisson, avec ses demandes d'adoption
  app.get("/fish/:id", (req, res) => {
    let parsedId: number;

try {
  parsedId = parseId(req.params.id);
} catch {
  res.status(400).json({ message: "Identifiant invalide" });
  return;
}
    const fish: any = db
      .prepare("SELECT * FROM fish WHERE id = ?")
      .get(parsedId);
    if (!fish) {
      res.status(404).send("Poisson introuvable");
      return;
    }
    fish.requests = db
      .prepare("SELECT * FROM adoption_requests WHERE fish_id = ?")
      .all(parsedId);
    res.status(200).json(fish);
  });

  // Ajout d'un poisson (équipe du Récif)
  app.post("/fish", express.json(), (req, res) => {
    if (!isAdminKeyValid(req.get("X-Api-Key"))) {
      res.status(401).json({ error: "Clé API manquante" });
      return;
    }
    const b = validate(fishSchema, req.body);
    if (!b.ok) {
      res.status(400).json({ errors: b.errors });
      return;
    }

    const info = db
      .prepare(
        "INSERT INTO fish (name, species, breed, birth_date, description, internal_notes, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'disponible', ?)",
      )
      .run(
        b.data.name.trim(),
        b.data.species,
        b.data.breed || null,
        b.data.birthDate || null,
        b.data.description || "",
        b.data.internalNotes || "",
        new Date().toISOString(),
      );
    const fish = db
      .prepare("SELECT * FROM fish WHERE id = ?")
      .get(info.lastInsertRowid);

    res.status(201).json(fish);
  });

  // Modification d'un poisson (équipe du Récif)
  app.put("/fish/:id", express.json(), (req, res) => {
    if (!isAdminKeyValid(req.get("X-Api-Key"))) {
      res.status(401).json({ error: "Clé API manquante" });
      return;
    }

    let parsedId: number;

    try {
      parsedId = parseId(req.params.id);
    } catch {
      res.status(400).json({ message: "Identifiant invalide" });
      return;
    }

    const result = validate(fishSchema, req.body, {
      partial: true,
    });

    if (!result.ok) {
      res.status(400).json({ errors: result.errors });
      return;
    }

    const b = result.data;

    const existing = db
      .prepare("SELECT * FROM fish WHERE id = ?")
      .get(parsedId);
    if (!existing) {
      res.status(404).json({ error: "Poisson introuvable" });
      return;
    }
    // On met à jour tous les champs envoyés
    const keys = Object.keys(b);
    if (keys.length > 0) {
      const sets = keys
        .map((k) => k.replace(/[A-Z]/g, (m) => "_" + m.toLowerCase()) + " = ?")
        .join(", ");
      db.prepare("UPDATE fish SET " + sets + " WHERE id = ?").run(
        ...keys.map((k) => b[k]),
        parsedId,
      );
    }
    const fish = db
      .prepare("SELECT * FROM fish WHERE id = ?")
      .get(parsedId);

    res.status(200).json(fish);
  });

  // Suppression d'un poisson (équipe du Récif)
  app.delete("/fish/:id", (req, res) => {
    if (!isAdminKeyValid(req.get("X-Api-Key"))) {
      res.status(401).json({ error: "Clé API manquante" });
      return;
    }
    let parsedId: number;

try {
  parsedId = parseId(req.params.id);
} catch {
  res.status(400).json({ message: "Identifiant invalide" });
  return;
}
    const fish = db
      .prepare("SELECT * FROM fish WHERE id = ?")
      .get(parsedId);
    if (!fish) {
      res.status(404).json({ message: "Poisson introuvable" });
      return;
    }
    db.prepare("DELETE FROM adoption_requests WHERE fish_id = ?").run(
      parsedId,
    );
    db.prepare("DELETE FROM fish WHERE id = ?").run(parsedId);
    res.status(204).end();
  });

  // ---------------------------------------------------------------- ADOPTIONS

  // Demande d'adoption (public)
  app.post("/fish/:id/adoptions", express.json(), (req, res) => {
    let parsedId: number;

try {
  parsedId = parseId(req.params.id);
} catch {
  res.status(400).json({ message: "Identifiant invalide" });
  return;
}
    const b = req.body;
    if (
      !b.adopterName ||
      typeof b.adopterName !== "string" ||
      b.adopterName.trim().length === 0 ||
      b.adopterName.length > 80
    ) {
      res.status(400).json({ message: "Nom de l'adoptant invalide" });
      return;
    }
    if (
      !b.adopterEmail ||
      typeof b.adopterEmail !== "string" ||
      b.adopterEmail.indexOf("@") === -1
    ) {
      res.status(400).json({ message: "Email invalide" });
      return;
    }
    if (b.message && b.message.length > 500) {
      res.status(400).json({ message: "Message trop long" });
      return;
    }

    const fish: any = db
      .prepare("SELECT * FROM fish WHERE id = ?")
      .get(parsedId);
    if (!fish) {
      res.status(404).json({ message: "Poisson introuvable" });
      return;
    }
    if (fish.status !== "disponible") {
      res.status(409).json({ error: "Ce poisson n'est plus disponible" });
      return;
    }
    const info = db
      .prepare(
        "INSERT INTO adoption_requests (fish_id, adopter_name, adopter_email, message, status, created_at) VALUES (?, ?, ?, ?, 'en_attente', ?)",
      )
      .run(
        parsedId,
        b.adopterName.trim(),
        b.adopterEmail,
        b.message || "",
        new Date().toISOString(),
      );
    db.prepare("UPDATE fish SET status = 'reserve' WHERE id = ?").run(
      parsedId,
    );
    const request = db
      .prepare("SELECT * FROM adoption_requests WHERE id = ?")
      .get(info.lastInsertRowid);

    res.status(201).json(request);
  });

  // Liste des demandes (équipe du Récif), filtre ?status=
  app.get("/adoptions", (req, res) => {
    if (!isAdminKeyValid(req.get("X-Api-Key"))) {
      res.status(401).json({ error: "Clé API manquante" });
      return;
    }

    const filters: any = {};
    if (req.query.status)
      filters.status = { op: "eq", value: req.query.status };
    const rows = db
      .prepare(
        "SELECT * FROM adoption_requests " +
          buildWhere(filters) +
          " ORDER BY id",
      )
      .all();

    res.status(200).json(rows);
  });

  // Accepter une demande (équipe du Récif)
  app.post("/adoptions/:id/accept", (req, res) => {
    if (!isAdminKeyValid(req.get("X-Api-Key"))) {
      res.status(401).json({ error: "Clé API manquante" });
      return;
    }

        let parsedId: number;

try {
  parsedId = parseId(req.params.id);
} catch {
  res.status(400).json({ message: "Identifiant invalide" });
  return;
}

    const request: any = db
      .prepare("SELECT * FROM adoption_requests WHERE id = ?")
      .get(parsedId);
    if (!request) {
      res.status(404).json({ message: "Demande introuvable" });
      return;
    }
    if (request.status !== "en_attente") {
      res.status(409).json({ message: "Demande déjà traitée" });
      return;
    }
    db.prepare(
      "UPDATE adoption_requests SET status = 'acceptee', decided_at = ? WHERE id = ?",
    ).run(new Date().toISOString(), parsedId);
    db.prepare("UPDATE fish SET status = 'adopte' WHERE id = ?").run(
      parseId(request.fish_id),
    );
    const updated = db
      .prepare("SELECT * FROM adoption_requests WHERE id = ?")
      .get(parsedId);

    console.log(
      "Demande " +
        parseId(req.params.id) +
        " acceptée, il faudrait prévenir " +
        request.adopter_email,
    );
    res.status(200).json(updated);
  });

  // Refuser une demande (équipe du Récif)
  app.post("/adoptions/:id/refuse", (req, res) => {
    if (!isAdminKeyValid(req.get("X-Api-Key"))) {
      res.status(401).json({ error: "Clé API manquante" });
      return;
    }

    let parsedId: number;

try {
  parsedId = parseId(req.params.id);
} catch {
  res.status(400).json({ message: "Identifiant invalide" });
  return;
}

    const request: any = db
      .prepare("SELECT * FROM adoption_requests WHERE id = ?")
      .get(parsedId);
    if (!request) {
      res.status(404).json({ message: "Demande introuvable" });
      return;
    }
    if (request.status !== "en_attente") {
      res.status(409).json({ message: "Demande déjà traitée" });
      return;
    }
    db.prepare(
      "UPDATE adoption_requests SET status = 'refusee', decided_at = ? WHERE id = ?",
    ).run(new Date().toISOString(), parsedId);
    db.prepare("UPDATE fish SET status = 'disponible' WHERE id = ?").run(
      parseId(request.fish_id),
    );
    const updated = db
      .prepare("SELECT * FROM adoption_requests WHERE id = ?")
      .get(parsedId);

    console.log(
      "Demande " +
        parseId(req.params.id) +
        " refusée, il faudrait prévenir " +
        request.adopter_email,
    );
    res.status(200).json(updated);
  });

  return app;
}
