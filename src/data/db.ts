import Database from "better-sqlite3";
import { config } from "../config.js";

const DB_FILE = config.dbFile;

export const db = new Database(DB_FILE);
db.pragma("foreign_keys = ON");
