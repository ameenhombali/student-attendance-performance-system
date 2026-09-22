const express = require('express');
const router = express.Router();
const db = require('../db/database');
const seedDatabase = require('../db/seed');
const { authenticateToken } = require('../middleware/auth');

// GET /api/settings
router.get('/', async (req, res) => {
    try {
        const settingsRows = await db.all('SELECT key, value FROM settings');
        const settingsObj = {};
        settingsRows.forEach(row => {
            settingsObj[row.key] = row.value;
        });
        return res.json({ settings: settingsObj });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to fetch settings.' });
    }
});

// POST /api/settings
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { key, value } = req.body;
        if (!key || value === undefined) {
            return res.status(400).json({ error: 'Key and value are required.' });
        }

        await db.run(
            `INSERT INTO settings (key, value) VALUES (?, ?)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
            [key, String(value)]
        );

        return res.json({ message: 'Setting updated successfully.', key, value });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to update setting.' });
    }
});

// POST /api/settings/reset-demo (Reset / Repopulate Demo Data)
router.post('/reset-demo', async (req, res) => {
    try {
        await seedDatabase(true);
        return res.json({ message: 'Demo database has been cleanly reset and repopulated with sample accounts, historical logs, and marks.' });
    } catch (err) {
        console.error('Error resetting demo database:', err);
        return res.status(500).json({ error: 'Failed to reset demo database.' });
    }
});

module.exports = router;
