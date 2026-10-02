import { DatabaseSync } from "node:sqlite";

export type Db = DatabaseSync;

const MIGRATIONS = [
  `CREATE TABLE IF NOT EXISTS qbo_connections (
     realm_id                  TEXT PRIMARY KEY,
     access_token              TEXT NOT NULL,
     refresh_token             TEXT NOT NULL,
     access_token_expires_at   INTEGER NOT NULL,
     refresh_token_expires_at  INTEGER NOT NULL,
     created_at                INTEGER NOT NULL,
     updated_at                INTEGER NOT NULL
   )`,
];

export function openDb(path: string): Db {
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL");
  for (const sql of MIGRATIONS) db.exec(sql);
  return db;
}
