const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, 'Back-end', '.env') });

// server.js

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const passport = require('passport');

// Load model BEFORE route setup
global.LearningModels = require('./Back-end/models/projectModels');

// Load routes
const registerRoutes = require('./Back-end/routes/projectsRoutes');
const authRoutes = require('./Back-end/routes/authRoutes');

// App + Port
const app = express();
const port = process.env.PORT || 3000;

// --- Middleware ---
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(passport.initialize());

// --- MongoDB Connection ---
mongoose.set('strictQuery', true);

const URI = process.env.MONGO_URI;

if (!URI) {
    throw new Error('MONGO_URI is not defined in the environment.');
}

mongoose
    .connect(URI)
    .then(() => console.log('✅ Connected to MongoDB Atlas'))
    .catch(err => console.error('❌ MongoDB connection error:', err));

// Auto-seed admin if environment variables are provided
const { ensureAdminExists } = require('./Back-end/controllers/projectController');
mongoose.connection.once('open', async () => {
    try {
        await ensureAdminExists();
    } catch (err) {
        console.error('Error running admin seed:', err.message || err);
    }
});

// --- Routes ---
app.use('/api/auth', authRoutes);
registerRoutes(app);

// --- 404 Handler ---
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found.' });
});

// --- Start Server ---
app.listen(port, () => {
    console.log(`🚀 Learning Support Server running at http://localhost:${port}/`);
});