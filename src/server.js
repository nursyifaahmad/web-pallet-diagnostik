const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const cors = require('cors');
require('dotenv').config();

// Ensure DB is initialized
require('./config/database');

const { requireAuth } = require('./middleware/auth');

const authRoutes = require('./routes/auth');
const classRoutes = require('./routes/classes');
const studentRoutes = require('./routes/students');
const questionRoutes = require('./routes/questions');
const calendarRoutes = require('./routes/calendar');
const rubricRoutes = require('./routes/rubric');
const exportRoutes = require('./routes/export');

const app = express();
const PORT = process.env.PORT || 3090;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Static Assets
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/rubric', rubricRoutes);
app.use('/api/export', exportRoutes);

// Page Routes (Portal Separation)
// 1. Root / -> Portal Siswa (Asesmen Diagnostik)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/student/index.html'));
});

// 2. /login/guru -> Halaman Login Guru
app.get('/login/guru', (req, res) => {
  // If teacher already has valid token, redirect to /guru
  if (req.cookies && req.cookies.pallet_token) {
    const jwt = require('jsonwebtoken');
    const { JWT_SECRET } = require('./middleware/auth');
    try {
      jwt.verify(req.cookies.pallet_token, JWT_SECRET);
      return res.redirect('/guru');
    } catch (e) {
      // Invalid token, proceed to login page
    }
  }
  res.sendFile(path.join(__dirname, '../public/guru/login.html'));
});

// 3. /guru -> Dashboard Manajemen Guru (Diproteksi JWT)
app.get('/guru', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/guru/index.html'));
});

// Healthcheck endpoint for Cloudflare / Docker
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'PALLET Diagnostik Seni Rupa',
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

// 404 Fallback
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ status: 'error', message: 'API Endpoint tidak ditemukan.' });
  }
  res.status(404).sendFile(path.join(__dirname, '../public/student/index.html'));
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Global Error]', err);
  res.status(500).json({ status: 'error', message: 'Terjadi kesalahan internal pada server.' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(` PALLET - Personalised Art Learning Profile`);
  console.log(` Server aktif pada: http://localhost:${PORT}`);
  console.log(` Portal Siswa:      http://localhost:${PORT}/`);
  console.log(` Login Guru:        http://localhost:${PORT}/login/guru`);
  console.log(` Dashboard Guru:    http://localhost:${PORT}/guru`);
  console.log(` Cloudflare Domain: https://artuniverse.my.id`);
  console.log(`====================================================`);
});
