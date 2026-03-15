import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.resolve('data', 'tasks.db');
const db = new Database(DB_PATH);

db.exec('DELETE FROM tasks;');
db.exec('DELETE FROM tokens;');
db.close();

console.log('Cleanup done: tasks and tokens cleared.');
