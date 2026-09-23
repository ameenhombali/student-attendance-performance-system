const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const seedDatabase = require('./db/seed');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure DB initialization completes BEFORE handling any API requests
let dbInitPromise = null;
app.use(async (req, res, next) => {
    if (!dbInitPromise) {
        dbInitPromise = seedDatabase().catch(err => {
            console.error('Database initialization error:', err);
            dbInitPromise = null;
            throw err;
        });
    }
    try {
        await dbInitPromise;
        next();
    } catch (err) {
        return res.status(500).json({ error: 'Database initialization failed: ' + err.message });
    }
});

// Serve static frontend files from 'public'
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/student', require('./routes/student'));
app.use('/api/faculty', require('./routes/faculty'));
app.use('/api/settings', require('./routes/settings'));

// Single Page Application Fallback
app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'API endpoint not found' });
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start local server if not running on Vercel
if (!process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`=======================================================`);
        console.log(`🚀 Smart Student Attendance System running on port ${PORT}`);
        console.log(`🌐 Local URL: http://localhost:${PORT}`);
        console.log(`=======================================================`);
    });
}

module.exports = app;
