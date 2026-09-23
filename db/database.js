const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

let dbPath = path.resolve(__dirname, '../database.sqlite');
if (process.env.VERCEL) {
    dbPath = '/tmp/database.sqlite';
}

let dbInstance = null;
let initPromise = null;

async function getDbInstance() {
    if (dbInstance) return dbInstance;
    if (!initPromise) {
        initPromise = (async () => {
            const SQL = await initSqlJs();
            let fileData = null;

            const sourceDbPath = path.resolve(__dirname, '../database.sqlite');
            if (process.env.VERCEL) {
                if (fs.existsSync(dbPath) && fs.statSync(dbPath).size > 0) {
                    fileData = fs.readFileSync(dbPath);
                } else if (fs.existsSync(sourceDbPath) && fs.statSync(sourceDbPath).size > 0) {
                    fileData = fs.readFileSync(sourceDbPath);
                }
            } else {
                if (fs.existsSync(dbPath) && fs.statSync(dbPath).size > 0) {
                    fileData = fs.readFileSync(dbPath);
                }
            }

            if (fileData) {
                dbInstance = new SQL.Database(fileData);
            } else {
                dbInstance = new SQL.Database();
            }

            try {
                dbInstance.run('PRAGMA foreign_keys = ON;');
            } catch (e) {}

            return dbInstance;
        })();
    }
    return await initPromise;
}

function saveDb() {
    if (!dbInstance) return;
    try {
        const data = dbInstance.export();
        const buffer = Buffer.from(data);
        const dir = path.dirname(dbPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(dbPath, buffer);
    } catch (err) {
        console.error('Error saving SQLite database file:', err);
    }
}

async function run(sql, params = []) {
    const db = await getDbInstance();
    db.run(sql, params);
    
    let lastID = 0;
    try {
        const resId = db.exec("SELECT last_insert_rowid() as id");
        if (resId && resId[0] && resId[0].values && resId[0].values[0]) {
            lastID = resId[0].values[0][0];
        }
    } catch (e) {}

    let changes = 0;
    try {
        const resChanges = db.exec("SELECT changes() as changes");
        if (resChanges && resChanges[0] && resChanges[0].values && resChanges[0].values[0]) {
            changes = resChanges[0].values[0][0];
        }
    } catch (e) {}

    saveDb();
    return { id: lastID, changes };
}

async function get(sql, params = []) {
    const db = await getDbInstance();
    const stmt = db.prepare(sql);
    stmt.bind(params);
    let row = undefined;
    if (stmt.step()) {
        row = stmt.getAsObject();
    }
    stmt.free();
    return row;
}

async function all(sql, params = []) {
    const db = await getDbInstance();
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) {
        rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
}

async function exec(sql) {
    const db = await getDbInstance();
    db.run(sql);
    saveDb();
}

module.exports = {
    getDbInstance,
    saveDb,
    run,
    get,
    all,
    exec
};
