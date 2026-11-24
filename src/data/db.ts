import Database from "better-sqlite3";

const DB_FILE = process.env.DB_FILE || "recif.db";

export const db = new Database(DB_FILE);
db.pragma("foreign_keys = ON");
