const Database = require('better-sqlite3');
const path = require('path');
const { runMigrations } = require('./migrations');
const { runSeeds } = require('./seed');

const DB_PATH = path.join(__dirname, '..', 'data.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL');

runMigrations(db);
runSeeds(db);

module.exports = db;
