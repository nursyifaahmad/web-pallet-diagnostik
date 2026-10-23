const express = require('express');
const router = express.Router();
const XLSX = require('xlsx');
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');

// GET /api/export/excel?class=VII-A (atau tanpa class untuk seluruh rombel)
router.get('/excel', requireAuth, (req, res) => {
  const { class: classId, type } = req.query;

  try {
    let students;
    if (classId) {
      students = db.prepare(`
        SELECT attendance_no, name, gender, class_id, category, sub_option, style, challenge, feeling, created_at
        FROM students
        WHERE class_id = ?
        ORDER BY (CASE WHEN attendance_no IS NULL THEN 999 ELSE attendance_no END) ASC, name ASC
      `).all(classId);
    } else {
      students = db.prepare(`
        SELECT attendance_no, name, gender, class_id, category, sub_option, style, challenge, feeling, created_at
        FROM students
        ORDER BY class_id ASC, (CASE WHEN attendance_no IS NULL THEN 999 ELSE attendance_no END) ASC, name ASC
      `).all();
    }

    const rowsDiagnostik = students.map((s, idx) => ({
      'No': idx + 1,
      'No. Absen': s.attendance_no || '-',
      'Nama Siswa': s.name,
      'L/P': s.gender || '-',
      'Kelas': s.class_id,
      'Kategori Media': s.category,
      'Sub-Pilihan Media': s.sub_option,
      'Gaya Belajar': s.style,
      'Hambatan / Kendala': s.challenge,
      'Perasaan Belajar': s.feeling,
      'Tanggal Pengisian': s.created_at
    }));

    // Data Penilaian Rubrik Autentik Siswa
    let rubricRows;
    if (classId) {
      rubricRows = db.prepare(`
        SELECT 
          s.attendance_no,
          s.name,
          s.gender,
          s.class_id,
          s.category,
          s.style,
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
    } else {
      rubricRows = db.prepare(`
        SELECT 
          s.attendance_no,
          s.name,
          s.gender,
          s.class_id,
          s.category,
          s.style,
          r.process_score,
          r.product_score,
          r.total_score,
          r.predicate,
          r.notes,
          r.created_at as graded_at
        FROM students s
        LEFT JOIN rubric_assessments r ON r.student_id = s.id
        ORDER BY s.class_id ASC, (CASE WHEN s.attendance_no IS NULL THEN 999 ELSE s.attendance_no END) ASC, s.name ASC
      `).all();
    }

    const rowsRubrik = rubricRows.map((r, idx) => ({
      'No': idx + 1,
      'No. Absen': r.attendance_no || '-',
      'Nama Siswa': r.name,
      'L/P': r.gender || '-',
      'Kelas': r.class_id,
      'Gaya Belajar': r.style || '-',
      'Skor Proses (0-100)': r.process_score !== null && r.process_score !== undefined ? r.process_score : 'Belum Dinilai',
      'Skor Produk (0-100)': r.product_score !== null && r.product_score !== undefined ? r.product_score : 'Belum Dinilai',
      'Nilai Akhir (0-100)': r.total_score !== null && r.total_score !== undefined ? r.total_score : 'Belum Dinilai',
      'Predikat Capaian': r.predicate || 'Belum Dinilai',
      'Catatan Apresiasi Guru': r.notes || '-',
      'Tanggal Penilaian': r.graded_at || '-'
    }));

    const workbook = XLSX.utils.book_new();

    if (type === 'rubric') {
      const wsRubrik = XLSX.utils.json_to_sheet(rowsRubrik);
      XLSX.utils.book_append_sheet(workbook, wsRubrik, 'Rekap_Nilai_Rubrik');
    } else {
      // Default: Multi-sheet workbook with both sheets
      const wsDiagnostik = XLSX.utils.json_to_sheet(rowsDiagnostik);
      XLSX.utils.book_append_sheet(workbook, wsDiagnostik, 'Profil_Diagnostik');

      const wsRubrik = XLSX.utils.json_to_sheet(rowsRubrik);
      XLSX.utils.book_append_sheet(workbook, wsRubrik, 'Nilai_Rubrik_Autentik');
    }

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    const prefix = type === 'rubric' ? 'Nilai_Rubrik_PALLET' : 'Rekap_Lengkap_PALLET';
    const filename = `${prefix}_${classId || 'Semua_Kelas'}_${new Date().toISOString().split('T')[0]}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    console.error('[Export API]', err);
    res.status(500).json({ status: 'error', message: 'Gagal membuat file export Excel.' });
  }
});

module.exports = router;
