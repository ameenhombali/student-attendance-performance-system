const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

// GET /api/notices - List all visible notices
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { category, search } = req.query;
        const today = new Date().toISOString().split('T')[0];

        let sql = `
            SELECT n.id, n.title, n.description, n.category, n.is_important, n.attachment_name, 
                   n.published_by, n.published_role, n.publish_date, n.expiry_date, n.created_at,
                   u.full_name as publisher_name,
                   CASE WHEN nr.id IS NOT NULL THEN 1 ELSE 0 END as is_read
            FROM notices n
            JOIN users u ON n.published_by = u.id
            LEFT JOIN notice_reads nr ON n.id = nr.notice_id AND nr.user_id = ?
            WHERE (n.expiry_date IS NULL OR n.expiry_date = '' OR n.expiry_date >= ?)
        `;
        const params = [req.user.id, today];

        if (category && category !== 'All') {
            sql += ` AND n.category = ?`;
            params.push(category);
        }

        if (search) {
            sql += ` AND (LOWER(n.title) LIKE LOWER(?) OR LOWER(n.description) LIKE LOWER(?))`;
            params.push(`%${search}%`, `%${search}%`);
        }

        sql += ` ORDER BY n.is_important DESC, n.publish_date DESC, n.created_at DESC`;

        const notices = await db.all(sql, params);
        return res.json({ notices });
    } catch (err) {
        console.error('Error fetching notices:', err);
        return res.status(500).json({ error: 'Failed to fetch notices.' });
    }
});

// GET /api/notices/:id - View single notice (including attachment data)
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const notice = await db.get(
            `SELECT n.*, u.full_name as publisher_name
             FROM notices n
             JOIN users u ON n.published_by = u.id
             WHERE n.id = ?`,
            [req.params.id]
        );

        if (!notice) {
            return res.status(404).json({ error: 'Notice not found.' });
        }

        // Auto mark as read
        try {
            await db.run(
                `INSERT OR IGNORE INTO notice_reads (notice_id, user_id) VALUES (?, ?)`,
                [notice.id, req.user.id]
            );
        } catch (e) {}

        return res.json({ notice });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to fetch notice details.' });
    }
});

// POST /api/notices/:id/read - Mark notice as read
router.post('/:id/read', authenticateToken, async (req, res) => {
    try {
        await db.run(
            `INSERT OR IGNORE INTO notice_reads (notice_id, user_id) VALUES (?, ?)`,
            [req.params.id, req.user.id]
        );
        return res.json({ message: 'Notice marked as read.' });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to mark notice as read.' });
    }
});

// POST /api/notices - Publish Notice (Admin & Faculty)
router.post('/', authenticateToken, requireRole(['admin', 'faculty']), async (req, res) => {
    try {
        const { title, description, category, is_important, attachment_name, attachment_data, expiry_date } = req.body;

        if (!title || !description || !category) {
            return res.status(400).json({ error: 'Title, description, and category are required.' });
        }

        const validCategories = ['Academic', 'Examination', 'Events', 'Holidays', 'General'];
        if (!validCategories.includes(category)) {
            return res.status(400).json({ error: `Category must be one of: ${validCategories.join(', ')}` });
        }

        const publishDate = new Date().toISOString().split('T')[0];
        const resNotice = await db.run(
            `INSERT INTO notices 
             (title, description, category, is_important, attachment_name, attachment_data, published_by, published_role, publish_date, expiry_date)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                title.trim(),
                description.trim(),
                category,
                is_important ? 1 : 0,
                attachment_name || null,
                attachment_data || null,
                req.user.id,
                req.user.role,
                publishDate,
                expiry_date || null
            ]
        );

        await logAudit(req, 'NOTICE_CREATED', `Published notice: "${title.trim()}" in category ${category}.`, resNotice.id);

        return res.status(201).json({
            message: 'Notice published successfully.',
            noticeId: resNotice.id
        });
    } catch (err) {
        console.error('Error creating notice:', err);
        return res.status(500).json({ error: 'Failed to publish notice.' });
    }
});

// DELETE /api/notices/:id - Delete Notice (Admin or publisher)
router.delete('/:id', authenticateToken, requireRole(['admin', 'faculty']), async (req, res) => {
    try {
        const notice = await db.get('SELECT * FROM notices WHERE id = ?', [req.params.id]);
        if (!notice) {
            return res.status(404).json({ error: 'Notice not found.' });
        }

        if (req.user.role !== 'admin' && notice.published_by !== req.user.id) {
            return res.status(403).json({ error: 'You are only authorized to delete your own notices.' });
        }

        await db.run('DELETE FROM notices WHERE id = ?', [req.params.id]);
        await logAudit(req, 'NOTICE_DELETED', `Deleted notice: "${notice.title}" (ID: ${notice.id}).`, notice.id);

        return res.json({ message: 'Notice deleted successfully.' });
    } catch (err) {
        console.error('Error deleting notice:', err);
        return res.status(500).json({ error: 'Failed to delete notice.' });
    }
});

module.exports = router;
