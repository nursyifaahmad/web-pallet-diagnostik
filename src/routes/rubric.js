const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');

// GET /api/rubric/class/:classId - Ambil seluruh rekap nilai rubrik siswa dalam 1 kelas
router.get('/class/:classId', requireAuth, (req, res) => {
  const { classId } = req.params;
  try {
    const rows = db.prepare(`
      SELECT 
        s.id as student_id,
        s.attendance_no,
        s.name as student_name,
        s.gender,
        s.class_id,
        s.category,
        s.sub_option,
        s.style,
        r.id as rubric_id,
        r.process_score,
        r.product_score,
        r.total_score,
        r.predicate,
        r.notes,
        r.created_at as graded_at
      FROM students s
      LEFT JOIN rubric_assessments r ON r.student_id = s.id
      WHERE s.class_id = ?
      ORDER BY (CASE WHEN s.attendance_no IS NULL THEN 999 ELSE s.attendance_no END) ASC, s.name ASC
    `).all(classId);

    res.json({ status: 'success', data: rows });
  } catch (err) {
    console.error('[Rubric API]', err);
    res.status(500).json({ status: 'error', message: 'Gagal mengambil rekap nilai rubrik kelas.' });
  }
});

// GET /api/rubric/:studentId - Ambil riwayat penilaian rubrik untuk 1 siswa
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

// POST /api/rubric - Simpan / Perbarui nilai rubrik siswa
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

    const existing = db.prepare('SELECT id FROM rubric_assessments WHERE student_id = ?').get(student_id);
    let resultId;

    if (existing) {
      db.prepare(`
        UPDATE rubric_assessments
        SET process_score = ?, product_score = ?, total_score = ?, predicate = ?, notes = ?, created_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        process_score || 0,
        product_score || 0,
        total_score,
        predicate || 'Berkembang',
        notes || '',
        existing.id
      );
      resultId = existing.id;
    } else {
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
      resultId = result.lastInsertRowid;
    }

    res.json({
      status: 'success',
      message: 'Penilaian rubrik autentik berhasil disimpan ke database.',
      id: resultId
    });
  } catch (err) {
    console.error('[Rubric API]', err);
    res.status(500).json({ status: 'error', message: 'Gagal menyimpan penilaian rubrik.' });
  }
});

module.exports = router;
