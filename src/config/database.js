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
      attendance_no INTEGER,
      name TEXT NOT NULL,
      gender TEXT,
      class_id TEXT NOT NULL,
      category TEXT NOT NULL,
      sub_option TEXT,
      style TEXT,
      challenge TEXT,
      feeling TEXT,
      answers_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(class_id) REFERENCES classes(id)
    );

    -- Tabel Live Sesi Pemantauan Real-Time Siswa
    CREATE TABLE IF NOT EXISTS student_live_sessions (
      session_id TEXT PRIMARY KEY,
      attendance_no INTEGER,
      student_name TEXT NOT NULL,
      gender TEXT,
      class_id TEXT NOT NULL,
      current_step INTEGER DEFAULT 1,
      total_steps INTEGER DEFAULT 10,
      current_category TEXT,
      status TEXT DEFAULT 'in_progress',
      last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
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

    -- Tabel Portofolio & Rekam Jejak Karya Siswa Sepanjang Semester (Tahap 9 CRUD)
    CREATE TABLE IF NOT EXISTS portfolios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id TEXT NOT NULL,
      student_id INTEGER,
      student_name TEXT,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      score REAL DEFAULT 85,
      semester TEXT DEFAULT 'Semester Ganjil',
      notes TEXT,
      image_data TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed default portfolio items if empty
  try {
    const pCount = db.prepare('SELECT COUNT(*) as count FROM portfolios').get().count;
    if (pCount === 0) {
      const insertP = db.prepare(`
        INSERT INTO portfolios (class_id, student_name, title, category, score, semester, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      insertP.run('VII-A', 'Linely', 'Eksplorasi Sketsa Karakter', 'KARYA 2D DRAWING', 88, 'Semester Ganjil', 'Gagasan proporsi karakter sangat matang.');
      insertP.run('VII-A', 'Bima Satria', 'Miniatur Kerajinan Clay Fauna', 'KARYA 3D KRIYA', 85, 'Semester Ganjil', 'Tekstur clay rapi dan komposisi bentuk seimbang.');
      console.log('[DB Seed] Initialized default portfolio items for VII-A');
    }
  } catch (pErr) {
    console.warn('[DB Portfolio Init Warning]', pErr.message);
  }

  // Migration: Add columns if table already existed without them
  try {
    const studentCols = db.prepare('PRAGMA table_info(students)').all().map(c => c.name);
    if (!studentCols.includes('attendance_no')) {
      db.exec('ALTER TABLE students ADD COLUMN attendance_no INTEGER;');
      console.log('[DB Migration] Added column attendance_no to students');
    }
    if (!studentCols.includes('gender')) {
      db.exec('ALTER TABLE students ADD COLUMN gender TEXT;');
      console.log('[DB Migration] Added column gender to students');
    }
    if (!studentCols.includes('updated_at')) {
      db.exec('ALTER TABLE students ADD COLUMN updated_at DATETIME;');
      db.exec('UPDATE students SET updated_at = created_at WHERE updated_at IS NULL;');
      console.log('[DB Migration] Added column updated_at to students');
    }

    const sessionCols = db.prepare('PRAGMA table_info(student_live_sessions)').all().map(c => c.name);
    if (!sessionCols.includes('attendance_no')) {
      db.exec('ALTER TABLE student_live_sessions ADD COLUMN attendance_no INTEGER;');
      console.log('[DB Migration] Added column attendance_no to student_live_sessions');
    }
    if (!sessionCols.includes('gender')) {
      db.exec('ALTER TABLE student_live_sessions ADD COLUMN gender TEXT;');
      console.log('[DB Migration] Added column gender to student_live_sessions');
    }
    if (!sessionCols.includes('created_at')) {
      db.exec('ALTER TABLE student_live_sessions ADD COLUMN created_at DATETIME;');
      db.exec('UPDATE student_live_sessions SET created_at = last_active WHERE created_at IS NULL;');
      console.log('[DB Migration] Added column created_at to student_live_sessions');
    }
    if (!sessionCols.includes('updated_at')) {
      db.exec('ALTER TABLE student_live_sessions ADD COLUMN updated_at DATETIME;');
      db.exec('UPDATE student_live_sessions SET updated_at = last_active WHERE updated_at IS NULL;');
      console.log('[DB Migration] Added column updated_at to student_live_sessions');
    }
  } catch (err) {
    console.warn('[DB Migration Warning]', err.message);
  }

  console.log('[DB] Database schema verified & ready.');
}

initSchema();

module.exports = db;
