const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DB_DIR, 'gallery.db');

// Ensure DB directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const db = new sqlite3.Database(DB_PATH);

function initDb() {
  return new Promise((resolve, reject) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS gallery (
        id TEXT PRIMARY KEY,
        prompt TEXT NOT NULL,
        seed INTEGER,
        width INTEGER NOT NULL,
        height INTEGER NOT NULL,
        filepath TEXT NOT NULL,
        style TEXT,
        created_at TEXT NOT NULL
      )
    `, (err) => {
      if (err) {
        console.error('Failed to initialize database:', err);
        reject(err);
      } else {
        console.log('Database initialized successfully.');
        resolve();
      }
    });
  });
}

function saveGeneration({ id, prompt, seed, width, height, filepath, style }) {
  return new Promise((resolve, reject) => {
    const createdAt = new Date().toISOString();
    db.run(`
      INSERT INTO gallery (id, prompt, seed, width, height, filepath, style, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, prompt, seed, width, height, filepath, style, createdAt], function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ id, prompt, seed, width, height, filepath, style, created_at: createdAt });
      }
    });
  });
}

function getAllGenerations() {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT * FROM gallery ORDER BY created_at DESC
    `, [], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

function getGenerationById(id) {
  return new Promise((resolve, reject) => {
    db.get(`
      SELECT * FROM gallery WHERE id = ?
    `, [id], (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

function deleteGeneration(id) {
  return new Promise((resolve, reject) => {
    db.run(`
      DELETE FROM gallery WHERE id = ?
    `, [id], function(err) {
      if (err) {
        reject(err);
      } else {
        resolve(this.changes > 0);
      }
    });
  });
}

module.exports = {
  initDb,
  saveGeneration,
  getAllGenerations,
  getGenerationById,
  deleteGeneration
};
