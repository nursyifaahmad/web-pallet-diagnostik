const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');

// GET /api/students - Ambil data siswa permanen (filter kelas opsional: ?class=VII-A)
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

// GET /api/students/live-monitor - Live monitoring progress pengerjaan siswa secara realtime (khusus guru)
router.get('/live-monitor', requireAuth, (req, res) => {
  const { class: classId } = req.query;

  try {
    let rows;
    if (classId) {
      rows = db.prepare(`
        SELECT session_id, student_name, class_id, current_step, total_steps, current_category, status, last_active, answers_json
        FROM student_live_sessions
        WHERE class_id = ?
        ORDER BY last_active DESC
      `).all(classId);
    } else {
      rows = db.prepare(`
        SELECT session_id, student_name, class_id, current_step, total_steps, current_category, status, last_active, answers_json
        FROM student_live_sessions
        ORDER BY last_active DESC
      `).all();
    }

    const sessions = rows.map(r => {
      const answers = JSON.parse(r.answers_json || '{}');
      const progressPercent = Math.min(100, Math.round((r.current_step / (r.total_steps || 10)) * 100));

      // Extract temporary media preference if chosen
      const mediaAns = Object.values(answers).find(a => a && a.category);
      const chosenMedia = mediaAns ? `${mediaAns.category} (${mediaAns.subOption || 'Kering'})` : '-';

      return {
        sessionId: r.session_id,
        name: r.student_name,
        classId: r.class_id,
        currentStep: r.current_step,
        totalSteps: r.total_steps || 10,
        progressPercent,
        currentCategory: r.current_category || 'Memulai Asesmen',
        status: r.status,
        lastActive: r.last_active,
        chosenMedia
      };
    });

    const activeCount = sessions.filter(s => s.status === 'in_progress').length;
    const completedCount = sessions.filter(s => s.status === 'completed').length;

    res.json({
      status: 'success',
      data: {
        sessions,
        activeCount,
        completedCount,
        totalSessions: sessions.length
      }
    });
  } catch (err) {
    console.error('[Live Monitor API]', err);
    res.status(500).json({ status: 'error', message: 'Gagal mengambil data live monitor.' });
  }
});

// POST /api/students/live-progress - Menerima heartbeat progres pengerjaan siswa
router.post('/live-progress', (req, res) => {
  const { sessionId, studentName, classId, currentStep, totalSteps, currentCategory, answers } = req.body;

  if (!sessionId || !studentName || !classId) {
    return res.status(400).json({ status: 'error', message: 'Data sesi tidak lengkap.' });
  }

  try {
    const answersJson = JSON.stringify(answers || {});
    
    // SQLite UPSERT
    db.prepare(`
      INSERT INTO student_live_sessions (session_id, student_name, class_id, current_step, total_steps, current_category, status, last_active, answers_json)
      VALUES (?, ?, ?, ?, ?, ?, 'in_progress', CURRENT_TIMESTAMP, ?)
      ON CONFLICT(session_id) DO UPDATE SET
        student_name = excluded.student_name,
        class_id = excluded.class_id,
        current_step = excluded.current_step,
        total_steps = excluded.total_steps,
        current_category = excluded.current_category,
        status = 'in_progress',
        last_active = CURRENT_TIMESTAMP,
        answers_json = excluded.answers_json
    `).run(sessionId, studentName.trim(), classId, currentStep || 1, totalSteps || 10, currentCategory || '', answersJson);

    res.json({ status: 'success', message: 'Live progress tersinkronisasi.' });
  } catch (err) {
    console.error('[Live Progress API]', err);
    res.status(500).json({ status: 'error', message: 'Gagal memperbarui live progress.' });
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

// POST /api/students - Simpan hasil asesmen permanen siswa atau quick-add oleh guru
router.post('/', (req, res) => {
  const { sessionId, name, class_id, gradeClass, category, sub_option, subOption, style, challenge, feeling, answers } = req.body;

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

    // Update live session status to completed if sessionId provided
    if (sessionId) {
      db.prepare(`
        UPDATE student_live_sessions
        SET status = 'completed', last_active = CURRENT_TIMESTAMP
        WHERE session_id = ?
      `).run(sessionId);
    }

    res.json({
      status: 'success',
      message: 'Data siswa dan hasil asesmen berhasil disimpan permanen.',
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
