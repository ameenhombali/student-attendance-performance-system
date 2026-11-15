const db = require('../db/database');

async function logAudit(req, action, details = '', recordId = null) {
    try {
        const user = req && req.user ? req.user : null;
        const userId = user ? user.id : null;
        const userName = user ? (user.full_name || user.username) : 'System';
        const userRole = user ? user.role : 'system';
        const ip = req ? (req.headers && req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0].trim() : (req.socket ? req.socket.remoteAddress : '127.0.0.1')) : '127.0.0.1';

        await db.run(
            `INSERT INTO audit_logs (user_id, user_name, user_role, action, details, record_id, ip_address)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [userId, userName, userRole, action, typeof details === 'object' ? JSON.stringify(details) : String(details), recordId, ip]
        );
    } catch (err) {
        console.error('Audit logging error:', err);
    }
}

module.exports = { logAudit };
