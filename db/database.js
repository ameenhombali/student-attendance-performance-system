const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

let dbPath = path.resolve(__dirname, '../database.sqlite');

if (process.env.VERCEL) {
    const tmpDbPath = '/tmp/database.sqlite';
    if (!fs.existsSync(tmpDbPath)) {
        try {
            if (fs.existsSync(dbPath)) {
                fs.copyFileSync(dbPath, tmpDbPath);
            }
        } catch (err) {
            console.error('Failed to copy database to /tmp:', err);
        }
    }
    dbPath = tmpDbPath;
}

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error connecting to SQLite database:', err.message);
    } else {
        console.log('Connected to SQLite database at:', dbPath);
        db.run('PRAGMA foreign_keys = ON;');
    }
});

// Helper wrapper for db.run (INSERT, UPDATE, DELETE) returning Promise
function run(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) return reject(err);
            resolve({ id: this.lastID, changes: this.changes });
        });
    });
}

// Helper wrapper for db.get (single row result)
function get(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) return reject(err);
            resolve(row);
        });
    });
}

// Helper wrapper for db.all (multiple rows result)
function all(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });
}

// Helper for executing batch SQL scripts (schema setup)
function exec(sql) {
    return new Promise((resolve, reject) => {
        db.exec(sql, (err) => {
            if (err) return reject(err);
            resolve();
        });
    });
}

module.exports = {
    db,
    run,
    get,
    all,
    exec
};
