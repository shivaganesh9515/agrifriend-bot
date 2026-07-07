import initSqlJs from "sql.js";
import type { Database as SqlJsDatabase } from "sql.js";
import { config } from "../config";
import path from "path";
import fs from "fs";

export interface UserRecord {
  id: string;
  name: string;
  groupId: string;
  plants: string;
  issues: string;
  location: string;
  firstSeen: string;
  lastSeen: string;
}

export interface Interaction {
  id: number;
  userId: string;
  groupId: string;
  userName: string;
  message: string;
  response: string;
  hasImage: boolean;
  timestamp: string;
}

let db: SqlJsDatabase;
let dbPath: string;

export async function initDB(): Promise<void> {
  const dir = path.dirname(config.dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  dbPath = config.dbPath;
  const SQL = await initSqlJs();

  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      groupId TEXT NOT NULL,
      plants TEXT DEFAULT '',
      issues TEXT DEFAULT '',
      location TEXT DEFAULT '',
      firstSeen TEXT NOT NULL,
      lastSeen TEXT NOT NULL
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS interactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL,
      groupId TEXT NOT NULL,
      userName TEXT NOT NULL,
      message TEXT NOT NULL,
      response TEXT NOT NULL,
      hasImage INTEGER DEFAULT 0,
      timestamp TEXT NOT NULL
    );
  `);

  saveDB();
}

function saveDB(): void {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

export function upsertUser(
  id: string,
  name: string,
  groupId: string,
  extra?: Partial<Pick<UserRecord, "plants" | "issues" | "location">>
): void {
  const now = new Date().toISOString();
  const existing = db.exec("SELECT * FROM users WHERE id = ?", [id]);

  if (existing.length > 0 && existing[0].values.length > 0) {
    const row = existing[0].values[0];
    const plants = extra?.plants ?? (row[3] as string);
    const issues = extra?.issues ?? (row[4] as string);
    const location = extra?.location ?? (row[5] as string);
    db.run("UPDATE users SET name = ?, plants = ?, issues = ?, location = ?, lastSeen = ? WHERE id = ?", [
      name, plants, issues, location, now, id,
    ]);
  } else {
    db.run(
      "INSERT INTO users (id, name, groupId, plants, issues, location, firstSeen, lastSeen) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [id, name, groupId, extra?.plants || "", extra?.issues || "", extra?.location || "", now, now]
    );
  }

  saveDB();
}

export function getUser(id: string): UserRecord | undefined {
  const result = db.exec("SELECT * FROM users WHERE id = ?", [id]);
  if (result.length === 0 || result[0].values.length === 0) return undefined;

  const row = result[0].values[0];
  return {
    id: row[0] as string,
    name: row[1] as string,
    groupId: row[2] as string,
    plants: row[3] as string,
    issues: row[4] as string,
    location: row[5] as string,
    firstSeen: row[6] as string,
    lastSeen: row[7] as string,
  };
}

export function saveInteraction(
  userId: string,
  groupId: string,
  userName: string,
  message: string,
  response: string,
  hasImage: boolean
): void {
  db.run(
    "INSERT INTO interactions (userId, groupId, userName, message, response, hasImage, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [userId, groupId, userName, message, response, hasImage ? 1 : 0, new Date().toISOString()]
  );
  saveDB();
}

export function getRecentInteractions(userId: string, limit = 5): Interaction[] {
  const result = db.exec(
    "SELECT * FROM interactions WHERE userId = ? ORDER BY timestamp DESC LIMIT ?",
    [userId, limit]
  );

  if (result.length === 0) return [];

  return result[0].values.map((row: any[]) => ({
    id: row[0] as number,
    userId: row[1] as string,
    groupId: row[2] as string,
    userName: row[3] as string,
    message: row[4] as string,
    response: row[5] as string,
    hasImage: (row[6] as number) === 1,
    timestamp: row[7] as string,
  }));
}
