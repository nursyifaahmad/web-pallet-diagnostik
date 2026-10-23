const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');

// GET /api/calendar
router.get('/', (req, res) => {
  try {
    const events = db.prepare('SELECT * FROM calendar_events ORDER BY event_date ASC').all();
    res.json({ status: 'success', data: events });
  } catch (err) {
    console.error('[Calendar API]', err);
    res.status(500).json({ status: 'error', message: 'Gagal mengambil agenda kalender.' });
  }
});

// POST /api/calendar
router.post('/', requireAuth, (req, res) => {
  const { title, event_date, type, class_id } = req.body;

  if (!title || !event_date) {
    return res.status(400).json({ status: 'error', message: 'Judul dan tanggal kegiatan wajib diisi.' });
  }

  try {
    const result = db.prepare(`
      INSERT INTO calendar_events (title, event_date, type, class_id, completed)
      VALUES (?, ?, ?, ?, 0)
    `).run(title.trim(), event_date, type || 'asesmen', class_id || null);

    res.json({
      status: 'success',
      message: 'Kegiatan berhasil ditambahkan ke kalender.',
      id: result.lastInsertRowid
    });
  } catch (err) {
    console.error('[Calendar API]', err);
    res.status(500).json({ status: 'error', message: 'Gagal menambahkan kegiatan kalender.' });
  }
});

// PUT /api/calendar/:id
router.put('/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const { title, event_date, type, completed } = req.body;

  try {
    const existing = db.prepare('SELECT id FROM calendar_events WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ status: 'error', message: 'Kegiatan tidak ditemukan.' });
    }

    db.prepare(`
      UPDATE calendar_events
      SET title = COALESCE(?, title),
          event_date = COALESCE(?, event_date),
          type = COALESCE(?, type),
          completed = COALESCE(?, completed)
      WHERE id = ?
    `).run(title, event_date, type, completed !== undefined ? (completed ? 1 : 0) : null, id);

    res.json({ status: 'success', message: 'Kegiatan kalender berhasil diperbarui.' });
  } catch (err) {
    console.error('[Calendar API]', err);
    res.status(500).json({ status: 'error', message: 'Gagal memperbarui kegiatan kalender.' });
  }
});

// DELETE /api/calendar/:id
router.delete('/:id', requireAuth, (req, res) => {
  const { id } = req.params;

  try {
    const result = db.prepare('DELETE FROM calendar_events WHERE id = ?').run(id);
    if (result.changes === 0) {
      return res.status(404).json({ status: 'error', message: 'Kegiatan tidak ditemukan.' });
    }
    res.json({ status: 'success', message: 'Kegiatan kalender berhasil dihapus.' });
  } catch (err) {
    console.error('[Calendar API]', err);
    res.status(500).json({ status: 'error', message: 'Gagal menghapus kegiatan kalender.' });
  }
});

module.exports = router;
