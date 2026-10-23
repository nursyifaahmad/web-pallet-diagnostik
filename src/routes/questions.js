const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');

// GET /api/questions - Ambil semua soal yang aktif (diakses publik oleh form siswa)
router.get('/', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT id, order_num, category, title, subtitle, options_json, is_media_selector, reason_label
      FROM diagnostic_questions
      WHERE is_active = 1
      ORDER BY order_num ASC
    `).all();

    const questions = rows.map(r => ({
      ...r,
      options: JSON.parse(r.options_json || '[]'),
      isMediaSelector: Boolean(r.is_media_selector)
    }));

    res.json({ status: 'success', data: questions });
  } catch (err) {
    console.error('[Questions API]', err);
    res.status(500).json({ status: 'error', message: 'Gagal mengambil daftar soal diagnostik.' });
  }
});

// GET /api/questions/all - Ambil semua soal termasuk non-aktif (khusus guru)
router.get('/all', requireAuth, (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT id, order_num, category, title, subtitle, options_json, is_media_selector, reason_label, is_active
      FROM diagnostic_questions
      ORDER BY order_num ASC
    `).all();

    const questions = rows.map(r => ({
      ...r,
      options: JSON.parse(r.options_json || '[]'),
      isMediaSelector: Boolean(r.is_media_selector),
      isActive: Boolean(r.is_active)
    }));

    res.json({ status: 'success', data: questions });
  } catch (err) {
    console.error('[Questions API]', err);
    res.status(500).json({ status: 'error', message: 'Gagal memuat seluruh soal diagnostik.' });
  }
});

// POST /api/questions - Tambah soal baru (khusus guru)
router.post('/', requireAuth, (req, res) => {
  const { category, title, subtitle, options, is_media_selector, reason_label, order_num } = req.body;

  if (!category || !title) {
    return res.status(400).json({ status: 'error', message: 'Kategori dan judul pertanyaan wajib diisi.' });
  }

  try {
    let nextOrder = order_num;
    if (!nextOrder) {
      const maxOrder = db.prepare('SELECT MAX(order_num) as max_o FROM diagnostic_questions').get();
      nextOrder = (maxOrder.max_o || 0) + 1;
    }

    const optionsJson = JSON.stringify(Array.isArray(options) ? options : []);
    const isMedia = is_media_selector ? 1 : 0;

    const result = db.prepare(`
      INSERT INTO diagnostic_questions (order_num, category, title, subtitle, options_json, is_media_selector, reason_label, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `).run(nextOrder, category, title, subtitle || '', optionsJson, isMedia, reason_label || '');

    res.json({
      status: 'success',
      message: 'Soal diagnostik berhasil ditambahkan.',
      id: result.lastInsertRowid
    });
  } catch (err) {
    console.error('[Questions API]', err);
    res.status(500).json({ status: 'error', message: 'Gagal menambahkan butir soal.' });
  }
});

// PUT /api/questions/:id - Update soal (khusus guru)
router.put('/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const { category, title, subtitle, options, is_media_selector, reason_label, order_num, is_active } = req.body;

  try {
    const existing = db.prepare('SELECT id FROM diagnostic_questions WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ status: 'error', message: 'Soal tidak ditemukan.' });
    }

    const optionsJson = JSON.stringify(Array.isArray(options) ? options : []);
    const isMedia = is_media_selector ? 1 : 0;
    const activeVal = (is_active === false || is_active === 0) ? 0 : 1;

    db.prepare(`
      UPDATE diagnostic_questions
      SET category = COALESCE(?, category),
          title = COALESCE(?, title),
          subtitle = COALESCE(?, subtitle),
          options_json = ?,
          is_media_selector = ?,
          reason_label = COALESCE(?, reason_label),
          order_num = COALESCE(?, order_num),
          is_active = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(category, title, subtitle, optionsJson, isMedia, reason_label, order_num, activeVal, id);

    res.json({ status: 'success', message: 'Soal diagnostik berhasil diperbarui.' });
  } catch (err) {
    console.error('[Questions API]', err);
    res.status(500).json({ status: 'error', message: 'Gagal memperbarui soal diagnostik.' });
  }
});

// DELETE /api/questions/:id - Hapus soal (khusus guru)
router.delete('/:id', requireAuth, (req, res) => {
  const { id } = req.params;

  try {
    const result = db.prepare('DELETE FROM diagnostic_questions WHERE id = ?').run(id);
    if (result.changes === 0) {
      return res.status(404).json({ status: 'error', message: 'Soal tidak ditemukan.' });
    }
    res.json({ status: 'success', message: 'Soal diagnostik berhasil dihapus.' });
  } catch (err) {
    console.error('[Questions API]', err);
    res.status(500).json({ status: 'error', message: 'Gagal menghapus soal.' });
  }
});

// POST /api/questions/reset - Reset ke 10 soal standar (khusus guru)
router.post('/reset', requireAuth, (req, res) => {
  try {
    db.prepare('DELETE FROM diagnostic_questions').run();
    // Re-seed default 10 questions
    const seed = require('../config/seed');
    seed();
    res.json({ status: 'success', message: 'Daftar soal diagnostik berhasil di-reset ke 10 soal default.' });
  } catch (err) {
    console.error('[Questions API]', err);
    res.status(500).json({ status: 'error', message: 'Gagal me-reset soal diagnostik.' });
  }
});

module.exports = router;
