const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');

// GET /api/portfolio/:classId - Ambil semua portofolio untuk kelas tertentu
router.get('/:classId', (req, res) => {
  try {
    const { classId } = req.params;
    let items = db.prepare('SELECT * FROM portfolios WHERE class_id = ? ORDER BY id ASC').all(classId);

    // If empty for this class, check if it's VII-A and auto-seed or provide defaults
    if (items.length === 0 && classId === 'VII-A') {
      const insertP = db.prepare(`
        INSERT INTO portfolios (class_id, student_name, title, category, score, semester, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      insertP.run('VII-A', 'Linely', 'Eksplorasi Sketsa Karakter', 'KARYA 2D DRAWING', 88, 'Semester Ganjil', 'Gagasan proporsi karakter sangat matang.');
      insertP.run('VII-A', 'Bima Satria', 'Miniatur Kerajinan Clay Fauna', 'KARYA 3D KRIYA', 85, 'Semester Ganjil', 'Tekstur clay rapi dan komposisi bentuk seimbang.');
      items = db.prepare('SELECT * FROM portfolios WHERE class_id = ? ORDER BY id ASC').all(classId);
    }

    res.json({
      status: 'success',
      data: items
    });
  } catch (err) {
    console.error('Error fetching portfolios:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// GET /api/portfolio/item/:id - Ambil satu item portofolio spesifik
router.get('/item/:id', (req, res) => {
  try {
    const item = db.prepare('SELECT * FROM portfolios WHERE id = ?').get(req.params.id);
    if (!item) {
      return res.status(404).json({ status: 'error', message: 'Item portofolio tidak ditemukan' });
    }
    res.json({ status: 'success', data: item });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// POST /api/portfolio - Tambah karya portofolio baru (CRUD: Create)
router.post('/', requireAuth, (req, res) => {
  try {
    const {
      class_id,
      student_id,
      student_name,
      title,
      category,
      score,
      semester,
      notes,
      image_data
    } = req.body;

    if (!class_id || !title || !category) {
      return res.status(400).json({
        status: 'error',
        message: 'class_id, title, dan category wajib diisi'
      });
    }

    const stmt = db.prepare(`
      INSERT INTO portfolios (class_id, student_id, student_name, title, category, score, semester, notes, image_data, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    const result = stmt.run(
      class_id,
      student_id || null,
      student_name || 'Siswa',
      title,
      category,
      score !== undefined ? Number(score) : 85,
      semester || 'Semester Ganjil',
      notes || '',
      image_data || ''
    );

    const created = db.prepare('SELECT * FROM portfolios WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json({
      status: 'success',
      message: 'Karya portofolio berhasil ditambahkan',
      data: created
    });
  } catch (err) {
    console.error('Error creating portfolio:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// PUT /api/portfolio/:id - Perbarui karya portofolio (CRUD: Update)
router.put('/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      category,
      score,
      semester,
      student_name,
      notes,
      image_data
    } = req.body;

    const existing = db.prepare('SELECT * FROM portfolios WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ status: 'error', message: 'Item portofolio tidak ditemukan' });
    }

    const updatedTitle = title !== undefined ? title : existing.title;
    const updatedCategory = category !== undefined ? category : existing.category;
    const updatedScore = score !== undefined ? Number(score) : existing.score;
    const updatedSemester = semester !== undefined ? semester : existing.semester;
    const updatedStudent = student_name !== undefined ? student_name : existing.student_name;
    const updatedNotes = notes !== undefined ? notes : existing.notes;
    const updatedImage = image_data !== undefined ? image_data : existing.image_data;

    db.prepare(`
      UPDATE portfolios
      SET title = ?, category = ?, score = ?, semester = ?, student_name = ?, notes = ?, image_data = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      updatedTitle,
      updatedCategory,
      updatedScore,
      updatedSemester,
      updatedStudent,
      updatedNotes,
      updatedImage,
      id
    );

    const updated = db.prepare('SELECT * FROM portfolios WHERE id = ?').get(id);

    res.json({
      status: 'success',
      message: 'Karya portofolio berhasil diperbarui',
      data: updated
    });
  } catch (err) {
    console.error('Error updating portfolio:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// DELETE /api/portfolio/:id - Hapus karya portofolio (CRUD: Delete)
router.delete('/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM portfolios WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ status: 'error', message: 'Item portofolio tidak ditemukan' });
    }

    db.prepare('DELETE FROM portfolios WHERE id = ?').run(id);

    res.json({
      status: 'success',
      message: 'Karya portofolio berhasil dihapus'
    });
  } catch (err) {
    console.error('Error deleting portfolio:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
