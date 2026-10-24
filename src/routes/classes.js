const express = require('express');
const router = express.Router();
const db = require('../config/database');

// GET /api/classes - Daftar 27 kelas beserta statistik
router.get('/', (req, res) => {
  try {
    const classes = db.prepare('SELECT id, grade, section, description FROM classes ORDER BY grade ASC, section ASC').all();
    const students = db.prepare('SELECT id, name, class_id, category, sub_option, style, challenge, feeling FROM students').all();

    // Group students by class
    const studentMap = {};
    for (const s of students) {
      if (!studentMap[s.class_id]) studentMap[s.class_id] = [];
      studentMap[s.class_id].push(s);
    }

    const result = classes.map(c => {
      const roster = studentMap[c.id] || [];
      const totalStudents = roster.length;

      // Calculate styles distribution
      const styleCounts = {};
      const categoryCounts = { '2D': 0, '3D': 0, 'Digital': 0 };
      const challengeCounts = {};

      for (const s of roster) {
        if (s.style) styleCounts[s.style] = (styleCounts[s.style] || 0) + 1;
        if (s.category) categoryCounts[s.category] = (categoryCounts[s.category] || 0) + 1;
        if (s.challenge) challengeCounts[s.challenge] = (challengeCounts[s.challenge] || 0) + 1;
      }

      // Find dominant style
      let dominantStyle = '-';
      let maxStyleCount = 0;
      for (const [st, cnt] of Object.entries(styleCounts)) {
        if (cnt > maxStyleCount) {
          maxStyleCount = cnt;
          dominantStyle = st;
        }
      }

      // Find top medium
      let topCategory = '-';
      let maxCatCount = 0;
      for (const [cat, cnt] of Object.entries(categoryCounts)) {
        if (cnt > maxCatCount) {
          maxCatCount = cnt;
          topCategory = cat;
        }
      }

      return {
        id: c.id,
        class_id: c.id,
        grade: c.grade,
        section: c.section,
        description: c.description,
        totalStudents,
        student_count: totalStudents,
        dominantStyle,
        topCategory,
        styleCounts,
        categoryCounts,
        challengeCounts
      };
    });

    res.json({ status: 'success', data: result });
  } catch (err) {
    console.error('[Classes API]', err);
    res.status(500).json({ status: 'error', message: 'Gagal mengambil data kelas.' });
  }
});

// GET /api/classes/:id - Detail kelas dan siswa
router.get('/:id', (req, res) => {
  const { id } = req.params;
  try {
    const classInfo = db.prepare('SELECT * FROM classes WHERE id = ?').get(id);
    if (!classInfo) {
      return res.status(404).json({ status: 'error', message: 'Kelas tidak ditemukan.' });
    }

    const students = db.prepare(`
      SELECT id, attendance_no, name, gender, class_id, category, sub_option, style, challenge, feeling, answers_json, created_at
      FROM students
      WHERE class_id = ?
      ORDER BY (CASE WHEN attendance_no IS NULL THEN 999 ELSE attendance_no END) ASC, name ASC
    `).all(id);

    const parsedStudents = students.map(s => ({
      ...s,
      answers: JSON.parse(s.answers_json || '{}')
    }));

    res.json({
      status: 'success',
      data: {
        ...classInfo,
        students: parsedStudents
      }
    });
  } catch (err) {
    console.error('[Classes API]', err);
    res.status(500).json({ status: 'error', message: 'Gagal mengambil detail kelas.' });
  }
});

module.exports = router;
