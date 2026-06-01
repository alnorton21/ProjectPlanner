import Database from 'better-sqlite3';
import path from 'path';
import { initSchema } from './schema';

const DB_PATH = path.join(__dirname, '../../data/planner.db');

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema(db);
  }
  return db;
}
