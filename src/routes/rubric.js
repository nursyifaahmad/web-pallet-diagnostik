const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');

// GET /api/rubric/:studentId
router.get('/:studentId', requireAuth, (req, res) => {
  const { studentId } = req.params;
  try {
    const assessments = db.prepare(`
      SELECT * FROM rubric_assessments
      WHERE student_id = ?
      ORDER BY created_at DESC
    `).all(studentId);

    res.json({ status: 'success', data: assessments });
  } catch (err) {
    console.error('[Rubric API]', err);
    res.status(500).json({ status: 'error', message: 'Gagal mengambil data penilaian rubrik.' });
  }
});

// POST /api/rubric
router.post('/', requireAuth, (req, res) => {
  const { student_id, process_score, product_score, total_score, predicate, notes } = req.body;

  if (!student_id || total_score === undefined) {
    return res.status(400).json({ status: 'error', message: 'ID Siswa dan skor total wajib diisi.' });
  }

  try {
    const student = db.prepare('SELECT id FROM students WHERE id = ?').get(student_id);
    if (!student) {
      return res.status(404).json({ status: 'error', message: 'Siswa tidak ditemukan.' });
    }

    const result = db.prepare(`
      INSERT INTO rubric_assessments (student_id, process_score, product_score, total_score, predicate, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      student_id,
      process_score || 0,
      product_score || 0,
      total_score,
      predicate || 'Berkembang',
      notes || ''
    );

    res.json({
      status: 'success',
      message: 'Penilaian rubrik autentik berhasil disimpan.',
      id: result.lastInsertRowid
    });
  } catch (err) {
    console.error('[Rubric API]', err);
    res.status(500).json({ status: 'error', message: 'Gagal menyimpan penilaian rubrik.' });
  }
});

module.exports = router;
