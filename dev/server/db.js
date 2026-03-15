import Database from 'better-sqlite3';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve('data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'tasks.db');
const db = new Database(DB_PATH);

// Performance pragmas
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Schema ──────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin','leader','teacher')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tokens (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    acceptance_criteria TEXT,
    deadline TEXT,
    priority TEXT NOT NULL DEFAULT 'medium',
    status TEXT NOT NULL DEFAULT 'pending',
    creator_id INTEGER NOT NULL,
    assignee_name TEXT,
    conversation TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (creator_id) REFERENCES users(id)
  );
`);

// ── Migration: add creator_name column ──────────────────────────────────────
try {
  db.exec(`ALTER TABLE tasks ADD COLUMN creator_name TEXT`);
} catch (e) {
  // Column already exists
}

// ── Migration: add progress tracking columns ────────────────────────────────
try {
  db.exec(`ALTER TABLE tasks ADD COLUMN progress_note TEXT DEFAULT ''`);
} catch (e) {
  // Column already exists
}
try {
  db.exec(`ALTER TABLE tasks ADD COLUMN progress_percent INTEGER DEFAULT 0`);
} catch (e) {
  // Column already exists
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// ── Seed users ──────────────────────────────────────────────────────────────

const seedUsers = [
  { username: 'admin',      display_name: '管理员',    password: 'admin123',     role: 'admin'  },
  { username: 'yuanzhang',  display_name: '院长',      password: 'changeme123',  role: 'leader' },
  { username: 'fuyanzhang', display_name: '副院长',    password: 'changeme123',  role: 'leader' },
  { username: 'zhurenA',    display_name: '软工主任',  password: 'changeme123',  role: 'leader' },
  { username: 'software',   display_name: '软件学院',  password: 'b316_318',     role: 'leader' },
];

const insertUser = db.prepare(`
  INSERT OR IGNORE INTO users (username, display_name, password_hash, role)
  VALUES (@username, @display_name, @password_hash, @role)
`);

const seedTransaction = db.transaction(() => {
  for (const u of seedUsers) {
    insertUser.run({
      username: u.username,
      display_name: u.display_name,
      password_hash: hashPassword(u.password),
      role: u.role,
    });
  }
});

seedTransaction();

// Ensure seed user passwords stay in sync with hashPassword()
const updatePasswordHash = db.prepare(
  'UPDATE users SET password_hash = ? WHERE username = ?'
);
db.transaction(() => {
  for (const u of seedUsers) {
    updatePasswordHash.run(hashPassword(u.password), u.username);
  }
})();

// ── Prepared statements ─────────────────────────────────────────────────────

const stmts = {
  getUserByUsername: db.prepare('SELECT * FROM users WHERE username = ?'),
  getUserById:      db.prepare('SELECT * FROM users WHERE id = ?'),
  createToken:      db.prepare('INSERT INTO tokens (token, user_id) VALUES (?, ?)'),
  getTokenUser:     db.prepare(`
    SELECT u.id, u.username, u.display_name, u.role
    FROM tokens t JOIN users u ON t.user_id = u.id
    WHERE t.token = ?
  `),
  deleteToken:      db.prepare('DELETE FROM tokens WHERE token = ?'),
  createTask:       db.prepare(`
    INSERT INTO tasks (title, description, acceptance_criteria, deadline, priority, status, creator_id, creator_name, assignee_name, conversation)
    VALUES (@title, @description, @acceptance_criteria, @deadline, @priority, @status, @creator_id, @creator_name, @assignee_name, @conversation)
  `),
  getAllTasks:       db.prepare(`
    SELECT t.*, COALESCE(t.creator_name, u.display_name) AS creator_name
    FROM tasks t LEFT JOIN users u ON t.creator_id = u.id
    ORDER BY t.created_at DESC
  `),
  getTaskById:      db.prepare(`
    SELECT t.*, COALESCE(t.creator_name, u.display_name) AS creator_name
    FROM tasks t LEFT JOIN users u ON t.creator_id = u.id
    WHERE t.id = ?
  `),
};

// ── Exported functions ──────────────────────────────────────────────────────

export function getUserByUsername(username) {
  return stmts.getUserByUsername.get(username);
}

export function getUserById(id) {
  return stmts.getUserById.get(id);
}

export function createToken(token, userId) {
  stmts.createToken.run(token, userId);
}

export function getTokenUser(token) {
  return stmts.getTokenUser.get(token);
}

export function deleteToken(token) {
  stmts.deleteToken.run(token);
}

export function createTask({ title, description, acceptance_criteria = null, deadline = null, priority = 'medium', status = 'pending', creator_id, creator_name = null, assignee_name = null, conversation = null }) {
  const result = stmts.createTask.run({
    title,
    description,
    acceptance_criteria,
    deadline,
    priority,
    status,
    creator_id,
    creator_name,
    assignee_name,
    conversation,
  });
  return getTaskById(result.lastInsertRowid);
}

export function getAllTasks() {
  return stmts.getAllTasks.all();
}

export function getTaskById(id) {
  return stmts.getTaskById.get(id);
}

export function updateTaskStatus(id, { status, progress_note, progress_percent }) {
  const task = stmts.getTaskById.get(id);
  if (!task) return null;
  db.prepare(`
    UPDATE tasks
    SET status = ?, progress_note = ?, progress_percent = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(status, progress_note ?? task.progress_note, progress_percent ?? task.progress_percent, id);
  return stmts.getTaskById.get(id);
}

export { hashPassword };
export default db;
