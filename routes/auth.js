const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const { JWT_SECRET, authenticateToken } = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { usernameOrId, password, portalType } = req.body;

        if (!usernameOrId || !password) {
            return res.status(400).json({ error: 'Username/ID and password are required.' });
        }

        let user = null;

        if (portalType === 'student') {
            // Search by username or student USN (case-insensitive)
            user = await db.get(
                `SELECT u.*, s.id as student_id, s.usn, s.department_id, s.semester, s.section, d.name as department_name
                 FROM users u
                 JOIN students s ON u.id = s.user_id
                 JOIN departments d ON s.department_id = d.id
                 WHERE (LOWER(u.username) = LOWER(?) OR LOWER(s.usn) = LOWER(?)) AND u.role = 'student'`,
                [usernameOrId, usernameOrId]
            );
        } else if (portalType === 'faculty') {
            // Search by username, faculty ID, or email (case-insensitive)
            user = await db.get(
                `SELECT u.*, f.id as faculty_id, f.faculty_id as fid_code, f.department_id, f.designation, d.name as department_name
                 FROM users u
                 JOIN faculty f ON u.id = f.user_id
                 JOIN departments d ON f.department_id = d.id
                 WHERE (LOWER(u.username) = LOWER(?) OR LOWER(f.faculty_id) = LOWER(?) OR LOWER(u.email) = LOWER(?)) AND u.role = 'faculty'`,
                [usernameOrId, usernameOrId, usernameOrId]
            );
        } else {
            // Generic lookup
            user = await db.get(`SELECT * FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)`, [usernameOrId, usernameOrId]);
        }

        const authErrorMessage = portalType === 'student' ? 'Invalid USN or password.' : 'Invalid credentials.';

        if (!user) {
            return res.status(401).json({ error: authErrorMessage });
        }

        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: authErrorMessage });
        }

        const tokenPayload = {
            id: user.id,
            username: user.username,
            role: user.role,
            full_name: user.full_name,
            email: user.email,
            student_id: user.student_id || null,
            faculty_id: user.faculty_id || null
        };

        const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '24h' });

        return res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                full_name: user.full_name,
                email: user.email,
                usn: user.usn || user.fid_code || null,
                department_name: user.department_name || null,
                semester: user.semester || null,
                section: user.section || null,
                designation: user.designation || null,
                student_id: user.student_id || null,
                faculty_id: user.faculty_id || null
            }
        });
    } catch (err) {
        console.error('Login error:', err);
        return res.status(500).json({ error: 'Internal server error during login.' });
    }
});

// GET /api/auth/me
router.get('/me', authenticateToken, async (req, res) => {
    try {
        let userDetails = null;
        if (req.user.role === 'student') {
            userDetails = await db.get(
                `SELECT u.id, u.username, u.full_name, u.email, u.role, s.id as student_id, s.usn, s.semester, s.section, d.name as department_name, d.code as department_code
                 FROM users u
                 JOIN students s ON u.id = s.user_id
                 JOIN departments d ON s.department_id = d.id
                 WHERE u.id = ?`,
                [req.user.id]
            );
        } else if (req.user.role === 'faculty') {
            userDetails = await db.get(
                `SELECT u.id, u.username, u.full_name, u.email, u.role, f.id as faculty_id, f.faculty_id as fid_code, f.designation, d.name as department_name, d.code as department_code
                 FROM users u
                 JOIN faculty f ON u.id = f.user_id
                 JOIN departments d ON f.department_id = d.id
                 WHERE u.id = ?`,
                [req.user.id]
            );
        }

        if (!userDetails) {
            return res.status(404).json({ error: 'User profile not found.' });
        }

        return res.json({ user: userDetails });
    } catch (err) {
        return res.status(500).json({ error: 'Error fetching user profile.' });
    }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
    const { identifier } = req.body;
    if (!identifier) {
        return res.status(400).json({ error: 'Please provide USN, Faculty ID, or Email address.' });
    }
    // Simulate reset link email dispatch
    return res.json({
        message: `Password reset instructions have been sent to the registered email associated with '${identifier}'.`
    });
});

module.exports = router;
