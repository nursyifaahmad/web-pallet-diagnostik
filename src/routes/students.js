const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');

// GET /api/students - Ambil data siswa (filter kelas opsional: ?class=VII-A)
router.get('/', (req, res) => {
  const { class: classId } = req.query;

  try {
    let rows;
    if (classId) {
      rows = db.prepare(`
        SELECT id, name, class_id, category, sub_option, style, challenge, feeling, answers_json, created_at
        FROM students
        WHERE class_id = ?
        ORDER BY name ASC
      `).all(classId);
    } else {
      rows = db.prepare(`
        SELECT id, name, class_id, category, sub_option, style, challenge, feeling, answers_json, created_at
        FROM students
        ORDER BY class_id ASC, name ASC
      `).all();
    }

    const students = rows.map(s => ({
      ...s,
      answers: JSON.parse(s.answers_json || '{}')
    }));

    res.json({ status: 'success', data: students });
  } catch (err) {
    console.error('[Students API]', err);
    res.status(500).json({ status: 'error', message: 'Gagal mengambil data siswa.' });
  }
});

// GET /api/students/:id - Detail profil siswa
router.get('/:id', (req, res) => {
  const { id } = req.params;
  try {
    const student = db.prepare('SELECT * FROM students WHERE id = ?').get(id);
    if (!student) {
      return res.status(404).json({ status: 'error', message: 'Data siswa tidak ditemukan.' });
    }

    student.answers = JSON.parse(student.answers_json || '{}');
    res.json({ status: 'success', data: student });
  } catch (err) {
    console.error('[Students API]', err);
    res.status(500).json({ status: 'error', message: 'Gagal memuat profil siswa.' });
  }
});

// POST /api/students - Simpan hasil asesmen siswa atau quick-add oleh guru
router.post('/', (req, res) => {
  const { name, class_id, gradeClass, category, sub_option, subOption, style, challenge, feeling, answers } = req.body;

  const targetClass = class_id || gradeClass;
  const targetSubOption = sub_option || subOption;

  if (!name || !targetClass) {
    return res.status(400).json({ status: 'error', message: 'Nama siswa dan kelas wajib diisi.' });
  }

  try {
    // Validate class exists
    const classRow = db.prepare('SELECT id FROM classes WHERE id = ?').get(targetClass);
    if (!classRow) {
      return res.status(400).json({ status: 'error', message: `Kelas ${targetClass} tidak valid.` });
    }

    const answersJson = JSON.stringify(answers || {});

    const result = db.prepare(`
      INSERT INTO students (name, class_id, category, sub_option, style, challenge, feeling, answers_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name.trim(),
      targetClass,
      category || '2D',
      targetSubOption || 'Kering',
      style || 'Visual Tutorial',
      challenge || 'Pencarian Ide Awal',
      feeling || 'Sangat senang',
      answersJson
    );

    res.json({
      status: 'success',
      message: 'Data siswa dan hasil asesmen berhasil disimpan.',
      data: {
        id: result.lastInsertRowid,
        name: name.trim(),
        class_id: targetClass,
        category: category || '2D',
        sub_option: targetSubOption || 'Kering',
        style: style || 'Visual Tutorial',
        challenge: challenge || 'Pencarian Ide Awal',
        feeling: feeling || 'Sangat senang'
      }
    });
  } catch (err) {
    console.error('[Students API]', err);
    res.status(500).json({ status: 'error', message: 'Gagal menyimpan data siswa.' });
  }
});

// PUT /api/students/:id - Update data siswa (khusus guru)
router.put('/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const { name, class_id, category, sub_option, style, challenge, feeling } = req.body;

  try {
    const existing = db.prepare('SELECT id FROM students WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ status: 'error', message: 'Data siswa tidak ditemukan.' });
    }

    db.prepare(`
      UPDATE students
      SET name = COALESCE(?, name),
          class_id = COALESCE(?, class_id),
          category = COALESCE(?, category),
          sub_option = COALESCE(?, sub_option),
          style = COALESCE(?, style),
          challenge = COALESCE(?, challenge),
          feeling = COALESCE(?, feeling)
      WHERE id = ?
    `).run(name, class_id, category, sub_option, style, challenge, feeling, id);

    res.json({ status: 'success', message: 'Data siswa berhasil diperbarui.' });
  } catch (err) {
    console.error('[Students API]', err);
    res.status(500).json({ status: 'error', message: 'Gagal memperbarui data siswa.' });
  }
});

// DELETE /api/students/:id - Hapus data siswa (khusus guru)
router.delete('/:id', requireAuth, (req, res) => {
  const { id } = req.params;

  try {
    // Delete rubric assessments first
    db.prepare('DELETE FROM rubric_assessments WHERE student_id = ?').run(id);
    const result = db.prepare('DELETE FROM students WHERE id = ?').run(id);

    if (result.changes === 0) {
      return res.status(404).json({ status: 'error', message: 'Siswa tidak ditemukan.' });
    }

    res.json({ status: 'success', message: 'Data siswa berhasil dihapus.' });
  } catch (err) {
    console.error('[Students API]', err);
    res.status(500).json({ status: 'error', message: 'Gagal menghapus siswa.' });
  }
});

module.exports = router;
