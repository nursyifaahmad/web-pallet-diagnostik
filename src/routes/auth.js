const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { JWT_SECRET, requireAuth } = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ status: 'error', message: 'Username dan password wajib diisi.' });
  }

  try {
    const user = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(username, username);

    if (!user) {
      return res.status(401).json({ status: 'error', message: 'Username atau password tidak sesuai.' });
    }

    const isMatch = bcrypt.compareSync(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ status: 'error', message: 'Username atau password tidak sesuai.' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, name: user.full_name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('pallet_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    return res.json({
      status: 'success',
      message: 'Login berhasil.',
      user: {
        id: user.id,
        username: user.username,
        name: user.full_name,
        role: user.role
      },
      token
    });
  } catch (err) {
    console.error('[Auth Error]', err);
    return res.status(500).json({ status: 'error', message: 'Terjadi kesalahan pada server saat login.' });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  res.json({
    status: 'success',
    user: req.user
  });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('pallet_token');
  res.json({ status: 'success', message: 'Logout berhasil.' });
});

module.exports = router;
