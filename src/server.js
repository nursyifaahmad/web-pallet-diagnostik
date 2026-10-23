const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const cors = require('cors');
require('dotenv').config();

// Ensure DB is initialized
require('./config/database');

const { requireAuth, JWT_SECRET } = require('./middleware/auth');
const jwt = require('jsonwebtoken');

const authRoutes = require('./routes/auth');
const classRoutes = require('./routes/classes');
const studentRoutes = require('./routes/students');
const questionRoutes = require('./routes/questions');
const calendarRoutes = require('./routes/calendar');
const rubricRoutes = require('./routes/rubric');
const exportRoutes = require('./routes/export');
const portfolioRoutes = require('./routes/portfolio');

const app = express();
const PORT = process.env.PORT || 3090;

// Trust reverse proxy (Cloudflare Tunnel / Docker)
app.set('trust proxy', 1);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Static Assets (Strictly assets only; no HTML inside public/guru)
app.use(express.static(path.join(__dirname, '../public'), {
  setHeaders: (res, filePath) => {
    // Prevent stale caching of scripts, styles, and HTML in browser & CDN
    if (filePath.endsWith('.js') || filePath.endsWith('.css') || filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/rubric', rubricRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/portfolio', portfolioRoutes);

// Page Routes (Portal Separation)

// 1. Root / -> Portal Siswa (Asesmen Diagnostik)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/student/index.html'));
});

// 2. /login/guru -> Halaman Login Guru
app.get('/login/guru', (req, res) => {
  // If teacher already has valid token (cookie or header), redirect directly to /guru
  let token = req.cookies && req.cookies.pallet_token;
  if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded && (decoded.role === 'teacher' || decoded.role === 'admin')) {
        return res.redirect('/guru');
      }
    } catch (e) {
      // Invalid/expired token: clear cookie and stay on login
      res.clearCookie('pallet_token');
    }
  }

  res.sendFile(path.join(__dirname, 'views/guru-login.html'));
});

// Legacy / shortcut redirect
app.get(['/guru/login', '/guru/login.html'], (req, res) => {
  res.redirect('/login/guru');
});

// 3. /guru & /guru/* -> Dashboard Manajemen Guru (Strictly diproteksi JWT)
app.get(['/guru', '/guru/*'], requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'views/guru-dashboard.html'));
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

if (require.main === module) {
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
}

module.exports = app;
