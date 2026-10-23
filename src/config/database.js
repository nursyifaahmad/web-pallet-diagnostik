const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

// Determine database path
const dataDir = process.env.DB_DIR || path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = process.env.DB_PATH || path.join(dataDir, 'pallet.db');
console.log(`[DB] SQLite database file: ${dbPath}`);

const rawDb = new DatabaseSync(dbPath);
rawDb.exec('PRAGMA journal_mode = WAL;');
rawDb.exec('PRAGMA foreign_keys = ON;');

// Create a robust better-sqlite3 compatible interface
const db = {
  prepare: (sql) => {
    const stmt = rawDb.prepare(sql);
    return {
      run: (...params) => {
        const flat = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
        const info = stmt.run(...flat);
        return {
          changes: info ? info.changes : 0,
          lastInsertRowid: info ? info.lastInsertRowid : 0
        };
      },
      get: (...params) => {
        const flat = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
        return stmt.get(...flat);
      },
      all: (...params) => {
        const flat = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
        return stmt.all(...flat);
      }
    };
  },
  exec: (sql) => rawDb.exec(sql),
  pragma: (sql) => rawDb.exec(`PRAGMA ${sql};`)
};

function initSchema() {
  db.exec(`
    -- Tabel Guru / Users
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT DEFAULT 'teacher',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Tabel Rombel / 27 Kelas (VII-A s.d IX-I)
    CREATE TABLE IF NOT EXISTS classes (
      id TEXT PRIMARY KEY,
      grade INTEGER NOT NULL,
      section TEXT NOT NULL,
      description TEXT
    );

    -- Tabel Soal Diagnostik (Bisa di-CRUD oleh Guru)
    CREATE TABLE IF NOT EXISTS diagnostic_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_num INTEGER NOT NULL,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      subtitle TEXT,
      options_json TEXT NOT NULL,
      is_media_selector INTEGER DEFAULT 0,
      reason_label TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Tabel Siswa & Data Asesmen Permanen
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      class_id TEXT NOT NULL,
      category TEXT NOT NULL,
      sub_option TEXT,
      style TEXT,
      challenge TEXT,
      feeling TEXT,
      answers_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(class_id) REFERENCES classes(id)
    );

    -- Tabel Live Sesi Pemantauan Real-Time Siswa
    CREATE TABLE IF NOT EXISTS student_live_sessions (
      session_id TEXT PRIMARY KEY,
      student_name TEXT NOT NULL,
      class_id TEXT NOT NULL,
      current_step INTEGER DEFAULT 1,
      total_steps INTEGER DEFAULT 10,
      current_category TEXT,
      status TEXT DEFAULT 'in_progress',
      last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
      answers_json TEXT
    );

    -- Tabel Kalender Akademik Seni
    CREATE TABLE IF NOT EXISTS calendar_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id TEXT,
      title TEXT NOT NULL,
      event_date DATE NOT NULL,
      type TEXT DEFAULT 'asesmen',
      completed INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Tabel Penilaian Rubrik Autentik
    CREATE TABLE IF NOT EXISTS rubric_assessments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      process_score REAL NOT NULL,
      product_score REAL NOT NULL,
      total_score REAL NOT NULL,
      predicate TEXT NOT NULL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(student_id) REFERENCES students(id)
    );
  `);
  console.log('[DB] Database schema verified & ready.');
}

initSchema();

module.exports = db;
