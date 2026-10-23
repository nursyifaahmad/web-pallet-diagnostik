const express = require('express');
const router = express.Router();
const XLSX = require('xlsx');
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');

// GET /api/export/excel?class=VII-A (atau tanpa class untuk seluruh rombel)
router.get('/excel', requireAuth, (req, res) => {
  const { class: classId } = req.query;

  try {
    let students;
    if (classId) {
      students = db.prepare(`
        SELECT name, class_id, category, sub_option, style, challenge, feeling, created_at
        FROM students
        WHERE class_id = ?
        ORDER BY name ASC
      `).all(classId);
    } else {
      students = db.prepare(`
        SELECT name, class_id, category, sub_option, style, challenge, feeling, created_at
        FROM students
        ORDER BY class_id ASC, name ASC
      `).all();
    }

    const rows = students.map((s, idx) => ({
      'No': idx + 1,
      'Nama Siswa': s.name,
      'Kelas': s.class_id,
      'Kategori Media': s.category,
      'Sub-Pilihan Media': s.sub_option,
      'Gaya Belajar': s.style,
      'Hambatan / Kendala': s.challenge,
      'Perasaan Belajar': s.feeling,
      'Tanggal Input': s.created_at
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    const sheetName = classId ? `Kelas_${classId}` : 'Semua_Siswa';
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    const filename = `Rekap_PALLET_${classId || 'Semua_Kelas'}_${new Date().toISOString().split('T')[0]}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    console.error('[Export API]', err);
    res.status(500).json({ status: 'error', message: 'Gagal membuat file export Excel.' });
  }
});

module.exports = router;
