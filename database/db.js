const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Ensure a persistent data folder exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'automation.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to SQLite database:', err);
  } else {
    console.log('Connected to SQLite database.');
    initializeDatabase();
  }
});


function initializeDatabase() {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        access_token TEXT UNIQUE
      )
    `, () => {
      // Add columns if they don't exist yet
      db.run(`ALTER TABLE users ADD COLUMN name TEXT`, () => {});
      db.run(`ALTER TABLE users ADD COLUMN fb_id TEXT`, () => {});
    });

    db.run(`
      CREATE TABLE IF NOT EXISTS pages (
        id TEXT PRIMARY KEY,
        name TEXT,
        access_token TEXT,
        category TEXT,
        folder_path TEXT,
        user_token TEXT
      )
    `);

    // Removed DROP TABLE IF EXISTS queue to ensure data persistence across server restarts

    db.run(`
      CREATE TABLE IF NOT EXISTS queue (
        id TEXT PRIMARY KEY,
        page_id TEXT,
        page_access_token TEXT,
        message TEXT,
        media_path TEXT,
        scheduled_time INTEGER,
        status TEXT DEFAULT 'pending',
        error_msg TEXT
      )
    `);

    // ═══════════════════════════════════════════════════════════════
    // AutoPilot Task System Tables
    // ═══════════════════════════════════════════════════════════════

    // Task presets (e.g. "Mexico 2026", "Universal")
    db.run(`
      CREATE TABLE IF NOT EXISTS autopilot_tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        folder_path TEXT NOT NULL,
        start_hour INTEGER DEFAULT 0,
        end_hour INTEGER DEFAULT 12,
        max_rounds INTEGER DEFAULT 5,
        gap_minutes INTEGER DEFAULT 2,
        rest_minutes INTEGER DEFAULT 60,
        custom_times TEXT DEFAULT '[]', -- JSON array of times (e.g. ["10:00", "15:00"])
        active INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s','now') * 1000)
      )
    `, () => {
      // Safe alters for backwards compatibility
      db.run("ALTER TABLE autopilot_tasks ADD COLUMN start_time TEXT DEFAULT '00:00'", (err) => {});
      db.run("ALTER TABLE autopilot_tasks ADD COLUMN end_time TEXT DEFAULT '23:59'", (err) => {});
      db.run("ALTER TABLE autopilot_tasks ADD COLUMN custom_times TEXT DEFAULT '[]'", (err) => {});
    });

    // Running state for the autopilot engine
    db.run(`
      CREATE TABLE IF NOT EXISTS autopilot_state (
        id INTEGER PRIMARY KEY DEFAULT 1,
        status TEXT DEFAULT 'idle',
        active_task_id INTEGER,
        current_round INTEGER DEFAULT 0,
        current_page_index INTEGER DEFAULT 0,
        total_pages INTEGER DEFAULT 0,
        videos_remaining INTEGER DEFAULT 0,
        round_started_at INTEGER,
        rest_until INTEGER,
        started_at INTEGER,
        completed_phases TEXT DEFAULT '[]',
        last_run_date TEXT,
        last_activity INTEGER
      )
    `, () => {
      db.run("ALTER TABLE autopilot_state ADD COLUMN completed_phases TEXT DEFAULT '[]'", (err) => {});
      db.run("ALTER TABLE autopilot_state ADD COLUMN last_run_date TEXT", (err) => {});
    });

    // Insert default state row if not exists
    db.run(`INSERT OR IGNORE INTO autopilot_state (id, status) VALUES (1, 'idle')`);

    // Detailed log of every post action
    db.run(`
      CREATE TABLE IF NOT EXISTS autopilot_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER,
        task_name TEXT,
        round INTEGER,
        page_id TEXT,
        page_name TEXT,
        video_path TEXT,
        video_name TEXT,
        caption TEXT,
        status TEXT DEFAULT 'pending',
        error_msg TEXT,
        retry_count INTEGER DEFAULT 0,
        fb_post_id TEXT,
        created_at INTEGER DEFAULT (strftime('%s','now') * 1000)
      )
    `);

    // Proxy configuration table
    db.run(`
      CREATE TABLE IF NOT EXISTS proxies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'http',
        host TEXT NOT NULL,
        port INTEGER NOT NULL,
        username TEXT,
        password TEXT,
        enabled INTEGER DEFAULT 1,
        created_at INTEGER DEFAULT (strftime('%s','now') * 1000)
      )
    `);

    // Page-to-proxy mapping table
    db.run(`
      CREATE TABLE IF NOT EXISTS page_proxy (
        page_id TEXT NOT NULL,
        proxy_id INTEGER NOT NULL,
        PRIMARY KEY (page_id, proxy_id)
      )
    `);

    // Posted video tracking for duplicate prevention
    db.run(`
      CREATE TABLE IF NOT EXISTS posted_videos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        video_name TEXT NOT NULL,
        video_size INTEGER,
        page_id TEXT NOT NULL,
        posted_at INTEGER DEFAULT (strftime('%s','now') * 1000),
        UNIQUE(video_name, page_id)
      )
    `);

    // Daily analytics snapshots per page
    db.run(`
      CREATE TABLE IF NOT EXISTS page_analytics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        page_id TEXT,
        page_name TEXT,
        date TEXT,
        reels_posted INTEGER DEFAULT 0,
        reels_success INTEGER DEFAULT 0,
        reels_failed INTEGER DEFAULT 0,
        reels_skipped INTEGER DEFAULT 0,
        UNIQUE(page_id, date)
      )
    `);

    // Add proxy_id column to pages if not exists
    db.run("ALTER TABLE pages ADD COLUMN proxy_id INTEGER", (err) => {});

    console.log('Database tables verified for AutoPilot Reel Blaster v4.0.');
  });
}

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function getQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function allQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

module.exports = {
  db,
  runQuery,
  getQuery,
  allQuery
};
