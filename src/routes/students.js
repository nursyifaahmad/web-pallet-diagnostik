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
        SELECT id, attendance_no, name, gender, class_id, category, sub_option, style, challenge, feeling, answers_json, created_at
        FROM students
        WHERE class_id = ?
        ORDER BY (CASE WHEN attendance_no IS NULL THEN 999 ELSE attendance_no END) ASC, name ASC
      `).all(classId);
    } else {
      rows = db.prepare(`
        SELECT id, attendance_no, name, gender, class_id, category, sub_option, style, challenge, feeling, answers_json, created_at
        FROM students
        ORDER BY class_id ASC, (CASE WHEN attendance_no IS NULL THEN 999 ELSE attendance_no END) ASC, name ASC
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
        SELECT 
          ls.session_id, 
          ls.attendance_no, 
          ls.student_name, 
          ls.gender, 
          ls.class_id, 
          ls.current_step, 
          ls.total_steps, 
          ls.current_category, 
          CASE 
            WHEN s.id IS NOT NULL OR ls.status = 'completed' THEN 'completed' 
            ELSE ls.status 
          END as status, 
          ls.last_active, 
          ls.created_at, 
          ls.updated_at, 
          ls.answers_json
        FROM student_live_sessions ls
        LEFT JOIN students s ON (
          s.class_id = ls.class_id AND (
            (ls.attendance_no IS NOT NULL AND s.attendance_no = ls.attendance_no) OR 
            (LOWER(TRIM(s.name)) = LOWER(TRIM(ls.student_name)))
          )
        )
        WHERE ls.class_id = ?
        ORDER BY COALESCE(ls.updated_at, ls.last_active) DESC
      `).all(classId);
    } else {
      rows = db.prepare(`
        SELECT 
          ls.session_id, 
          ls.attendance_no, 
          ls.student_name, 
          ls.gender, 
          ls.class_id, 
          ls.current_step, 
          ls.total_steps, 
          ls.current_category, 
          CASE 
            WHEN s.id IS NOT NULL OR ls.status = 'completed' THEN 'completed' 
            ELSE ls.status 
          END as status, 
          ls.last_active, 
          ls.created_at, 
          ls.updated_at, 
          ls.answers_json
        FROM student_live_sessions ls
        LEFT JOIN students s ON (
          s.class_id = ls.class_id AND (
            (ls.attendance_no IS NOT NULL AND s.attendance_no = ls.attendance_no) OR 
            (LOWER(TRIM(s.name)) = LOWER(TRIM(ls.student_name)))
          )
        )
        ORDER BY COALESCE(ls.updated_at, ls.last_active) DESC
      `).all();
    }

    const sessions = rows.map(r => {
      const answers = JSON.parse(r.answers_json || '{}');
      const isCompleted = r.status === 'completed';
      const progressPercent = isCompleted ? 100 : Math.min(100, Math.round((r.current_step / (r.total_steps || 10)) * 100));
      const currentStep = isCompleted ? (r.total_steps || 10) : r.current_step;
      const currentCategory = isCompleted ? 'Asesmen Selesai (Diserahkan)' : (r.current_category || 'Memulai Asesmen');

      const mediaAns = Object.values(answers).find(a => a && a.category);
      const chosenMedia = mediaAns ? `${mediaAns.category} (${mediaAns.subOption || 'Kering'})` : '-';

      const lastActiveTs = r.updated_at || r.last_active;
      const createdAtTs = r.created_at || r.last_active;

      return {
        sessionId: r.session_id,
        attendanceNo: r.attendance_no || '-',
        name: r.student_name,
        gender: r.gender || '-',
        classId: r.class_id,
        currentStep,
        totalSteps: r.total_steps || 10,
        progressPercent,
        currentCategory,
        status: r.status,
        lastActive: lastActiveTs,
        createdAt: createdAtTs,
        updatedAt: lastActiveTs,
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
  const { sessionId, attendance_no, attendanceNo, studentName, gender, classId, currentStep, totalSteps, currentCategory, answers } = req.body;

  if (!sessionId || !studentName || !classId) {
    return res.status(400).json({ status: 'error', message: 'Data sesi tidak lengkap.' });
  }

  const attNo = attendance_no !== undefined ? attendance_no : attendanceNo;
  const nowIso = new Date().toISOString();

  try {
    const answersJson = JSON.stringify(answers || {});
    
    db.prepare(`
      INSERT INTO student_live_sessions (session_id, attendance_no, student_name, gender, class_id, current_step, total_steps, current_category, status, last_active, created_at, updated_at, answers_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'in_progress', ?, ?, ?, ?)
      ON CONFLICT(session_id) DO UPDATE SET
        attendance_no = COALESCE(excluded.attendance_no, student_live_sessions.attendance_no),
        student_name = excluded.student_name,
        gender = COALESCE(excluded.gender, student_live_sessions.gender),
        class_id = excluded.class_id,
        current_step = excluded.current_step,
        total_steps = excluded.total_steps,
        current_category = excluded.current_category,
        status = CASE WHEN student_live_sessions.status = 'completed' THEN 'completed' ELSE 'in_progress' END,
        last_active = excluded.last_active,
        updated_at = excluded.updated_at,
        answers_json = excluded.answers_json
    `).run(sessionId, attNo ? parseInt(attNo) : null, studentName.trim(), gender || null, classId, currentStep || 1, totalSteps || 10, currentCategory || '', nowIso, nowIso, nowIso, answersJson);

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
  const { sessionId, attendance_no, attendanceNo, name, gender, class_id, gradeClass, category, sub_option, subOption, style, challenge, feeling, answers } = req.body;

  const targetClass = class_id || gradeClass;
  const targetSubOption = sub_option || subOption;
  const targetAttendanceNo = attendance_no !== undefined ? attendance_no : attendanceNo;

  if (!name || !targetClass) {
    return res.status(400).json({ status: 'error', message: 'Nama siswa dan kelas wajib diisi.' });
  }

  // Validasi: Jika submit berasal dari pengerjaan murid (ada sessionId atau answers), semua pertanyaan aktif harus dijawab (required)
  const hasAnswers = answers && typeof answers === 'object' && Object.keys(answers).length > 0;
  if (sessionId || hasAnswers) {
    const activeQuestions = db.prepare(`
      SELECT id, order_num, title, is_media_selector 
      FROM diagnostic_questions 
      WHERE is_active = 1 
      ORDER BY order_num ASC
    `).all();

    if (activeQuestions.length > 0) {
      const studentAnswers = answers || {};
      for (const q of activeQuestions) {
        const ans = studentAnswers[q.id];
        if (!ans) {
          return res.status(400).json({
            status: 'error',
            message: `Soal #${q.order_num} (${q.title}) wajib dijawab oleh murid.`
          });
        }
        if (q.is_media_selector) {
          if (!ans.category || !ans.subOption) {
            return res.status(400).json({
              status: 'error',
              message: `Pilihan dimensi dan spesifikasi media pada Soal #${q.order_num} wajib dipilih.`
            });
          }
        } else {
          if (!ans.selected || typeof ans.selected !== 'string' || ans.selected.trim() === '') {
            return res.status(400).json({
              status: 'error',
              message: `Pilihan jawaban pada Soal #${q.order_num} wajib dipilih.`
            });
          }
        }

        // Validasi pertanyaan esai / isian singkat (reason) wajib diisi
        if (!ans.reason || typeof ans.reason !== 'string' || ans.reason.trim() === '') {
          return res.status(400).json({
            status: 'error',
            message: `Pertanyaan esai/alasan pada Soal #${q.order_num} (${q.title}) wajib diisi oleh murid.`
          });
        }
      }
    }
  }

  try {
    const classRow = db.prepare('SELECT id FROM classes WHERE id = ?').get(targetClass);
    if (!classRow) {
      return res.status(400).json({ status: 'error', message: `Kelas ${targetClass} tidak valid.` });
    }

    const answersJson = JSON.stringify(answers || {});
    const parsedAttNo = targetAttendanceNo ? parseInt(targetAttendanceNo) : null;
    const formattedGender = (gender === 'L' || gender === 'Laki-laki') ? 'L' : (gender === 'P' || gender === 'Perempuan') ? 'P' : (gender || null);

    const nowIso = new Date().toISOString();
    const result = db.prepare(`
      INSERT INTO students (attendance_no, name, gender, class_id, category, sub_option, style, challenge, feeling, answers_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      parsedAttNo,
      name.trim(),
      formattedGender,
      targetClass,
      category || '2D',
      targetSubOption || 'Kering',
      style || 'Visual Tutorial',
      challenge || 'Pencarian Ide Awal',
      feeling || 'Sangat senang',
      answersJson,
      nowIso,
      nowIso
    );

    if (sessionId) {
      const updateRes = db.prepare(`
        UPDATE student_live_sessions
        SET status = 'completed', current_step = total_steps, current_category = 'Asesmen Selesai (Diserahkan)', last_active = ?, updated_at = ?
        WHERE session_id = ?
      `).run(nowIso, nowIso, sessionId);

      if (updateRes.changes === 0 && targetClass && name) {
        db.prepare(`
          UPDATE student_live_sessions
          SET status = 'completed', current_step = total_steps, current_category = 'Asesmen Selesai (Diserahkan)', last_active = ?, updated_at = ?
          WHERE class_id = ? AND LOWER(TRIM(student_name)) = LOWER(TRIM(?))
        `).run(nowIso, nowIso, targetClass, name.trim());
      }
    } else if (targetClass && name) {
      db.prepare(`
        UPDATE student_live_sessions
        SET status = 'completed', current_step = total_steps, current_category = 'Asesmen Selesai (Diserahkan)', last_active = ?, updated_at = ?
        WHERE class_id = ? AND LOWER(TRIM(student_name)) = LOWER(TRIM(?))
      `).run(nowIso, nowIso, targetClass, name.trim());
    }

    res.json({
      status: 'success',
      message: 'Data siswa dan hasil asesmen berhasil disimpan permanen.',
      data: {
        id: result.lastInsertRowid,
        attendance_no: parsedAttNo,
        name: name.trim(),
        gender: formattedGender,
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
  const { attendance_no, name, gender, class_id, category, sub_option, style, challenge, feeling } = req.body;

  try {
    const existing = db.prepare('SELECT id FROM students WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ status: 'error', message: 'Data siswa tidak ditemukan.' });
    }

    db.prepare(`
      UPDATE students
      SET attendance_no = COALESCE(?, attendance_no),
          name = COALESCE(?, name),
          gender = COALESCE(?, gender),
          class_id = COALESCE(?, class_id),
          category = COALESCE(?, category),
          sub_option = COALESCE(?, sub_option),
          style = COALESCE(?, style),
          challenge = COALESCE(?, challenge),
          feeling = COALESCE(?, feeling)
      WHERE id = ?
    `).run(attendance_no ? parseInt(attendance_no) : null, name, gender, class_id, category, sub_option, style, challenge, feeling, id);

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
