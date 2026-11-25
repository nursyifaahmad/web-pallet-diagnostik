const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');

function getActiveSetRow() {
  let active = db.prepare(`
    SELECT id, title, description, is_active, is_default, created_at, updated_at
    FROM diagnostic_question_sets
    WHERE is_active = 1
    LIMIT 1
  `).get();

  if (!active) {
    active = db.prepare(`
      SELECT id, title, description, is_active, is_default, created_at, updated_at
      FROM diagnostic_question_sets
      ORDER BY is_default DESC, id ASC
      LIMIT 1
    `).get();
    if (active) {
      db.prepare('UPDATE diagnostic_question_sets SET is_active = 1 WHERE id = ?').run(active.id);
      active.is_active = 1;
    }
  }
  return active;
}

// ========================================================
// 1. PUBLIC ENDPOINT FOR STUDENT PORTAL
// ========================================================

// GET /api/questions - Ambil semua soal yang aktif dari Paket Materi aktif (diakses publik oleh form siswa)
router.get('/', (req, res) => {
  try {
    const activeSet = getActiveSetRow();
    const rows = activeSet
      ? db.prepare(`
          SELECT id, set_id, order_num, category, title, subtitle, options_json, is_media_selector, reason_label
          FROM diagnostic_questions
          WHERE is_active = 1 AND set_id = ?
          ORDER BY order_num ASC, id ASC
        `).all(activeSet.id)
      : db.prepare(`
          SELECT id, set_id, order_num, category, title, subtitle, options_json, is_media_selector, reason_label
          FROM diagnostic_questions
          WHERE is_active = 1
          ORDER BY order_num ASC, id ASC
        `).all();

    const questions = rows.map(r => ({
      ...r,
      options: JSON.parse(r.options_json || '[]'),
      isMediaSelector: Boolean(r.is_media_selector)
    }));

    res.json({
      status: 'success',
      data: questions,
      activeSet: activeSet ? {
        id: activeSet.id,
        title: activeSet.title,
        description: activeSet.description || ''
      } : null
    });
  } catch (err) {
    console.error('[Questions API]', err);
    res.status(500).json({ status: 'error', message: 'Gagal mengambil daftar soal diagnostik.' });
  }
});

// ========================================================
// 2. QUESTION SETS (BANK PAKET / MATERI DIAGNOSTIK)
// ========================================================

// GET /api/questions/sets - Daftar seluruh paket/materi diagnostik tersimpan (khusus guru)
router.get('/sets', requireAuth, (req, res) => {
  try {
    getActiveSetRow(); // ensure active fallback exists
    const rows = db.prepare(`
      SELECT
        qs.id,
        qs.title,
        qs.description,
        qs.is_active,
        qs.is_default,
        qs.created_at,
        qs.updated_at,
        COUNT(dq.id) AS question_count
      FROM diagnostic_question_sets qs
      LEFT JOIN diagnostic_questions dq ON dq.set_id = qs.id
      GROUP BY qs.id
      ORDER BY qs.is_active DESC, qs.is_default DESC, qs.updated_at DESC, qs.id DESC
    `).all();

    const sets = rows.map(r => ({
      id: r.id,
      title: r.title,
      description: r.description || '',
      isActive: Boolean(r.is_active),
      isDefault: Boolean(r.is_default),
      questionCount: Number(r.question_count || 0),
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));

    res.json({ status: 'success', data: sets });
  } catch (err) {
    console.error('[Question Sets API]', err);
    res.status(500).json({ status: 'error', message: 'Gagal memuat arsip paket materi diagnostik.' });
  }
});

// POST /api/questions/sets - Buat paket materi baru (bisa kosong atau duplikat dari paket yang ada)
router.post('/sets', requireAuth, (req, res) => {
  const { title, description, copyFromSetId, activateNow } = req.body;

  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ status: 'error', message: 'Nama materi / paket soal wajib diisi.' });
  }

  try {
    const nowIso = new Date().toISOString();
    const shouldActivate = Boolean(activateNow);

    if (shouldActivate) {
      db.prepare('UPDATE diagnostic_question_sets SET is_active = 0').run();
    }

    const ins = db.prepare(`
      INSERT INTO diagnostic_question_sets (title, description, is_active, is_default, created_at, updated_at)
      VALUES (?, ?, ?, 0, ?, ?)
    `).run(title.trim(), (description || '').trim(), shouldActivate ? 1 : 0, nowIso, nowIso);

    const newSetId = ins.lastInsertRowid;
    let copiedCount = 0;

    if (copyFromSetId) {
      const sourceQuestions = db.prepare(`
        SELECT order_num, category, title, subtitle, options_json, is_media_selector, reason_label, is_active
        FROM diagnostic_questions
        WHERE set_id = ?
        ORDER BY order_num ASC, id ASC
      `).all(copyFromSetId);

      const insertQ = db.prepare(`
        INSERT INTO diagnostic_questions (set_id, order_num, category, title, subtitle, options_json, is_media_selector, reason_label, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const q of sourceQuestions) {
        insertQ.run(
          newSetId,
          q.order_num,
          q.category,
          q.title,
          q.subtitle,
          q.options_json,
          q.is_media_selector,
          q.reason_label,
          q.is_active,
          nowIso,
          nowIso
        );
        copiedCount++;
      }
    }

    res.json({
      status: 'success',
      message: copiedCount > 0
        ? `Paket materi "${title.trim()}" berhasil dibuat dengan menyalin ${copiedCount} soal.`
        : `Paket materi "${title.trim()}" berhasil dibuat. Silakan tambahkan butir soalnya.`,
      data: {
        id: newSetId,
        title: title.trim(),
        description: (description || '').trim(),
        isActive: shouldActivate,
        questionCount: copiedCount
      }
    });
  } catch (err) {
    console.error('[Question Sets API]', err);
    res.status(500).json({ status: 'error', message: 'Gagal membuat paket materi diagnostik.' });
  }
});

// PUT /api/questions/sets/:setId - Ubah judul atau deskripsi paket materi
router.put('/sets/:setId', requireAuth, (req, res) => {
  const { setId } = req.params;
  const { title, description } = req.body;

  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ status: 'error', message: 'Nama materi / paket soal wajib diisi.' });
  }

  try {
    const existing = db.prepare('SELECT id FROM diagnostic_question_sets WHERE id = ?').get(setId);
    if (!existing) {
      return res.status(404).json({ status: 'error', message: 'Paket materi tidak ditemukan.' });
    }

    db.prepare(`
      UPDATE diagnostic_question_sets
      SET title = ?, description = ?, updated_at = ?
      WHERE id = ?
    `).run(title.trim(), (description || '').trim(), new Date().toISOString(), setId);

    res.json({ status: 'success', message: 'Informasi paket materi berhasil diperbarui.' });
  } catch (err) {
    console.error('[Question Sets API]', err);
    res.status(500).json({ status: 'error', message: 'Gagal memperbarui paket materi.' });
  }
});

// POST /api/questions/sets/:setId/activate - Aktifkan paket materi tertentu untuk Portal Siswa
router.post('/sets/:setId/activate', requireAuth, (req, res) => {
  const { setId } = req.params;

  try {
    const target = db.prepare('SELECT id, title FROM diagnostic_question_sets WHERE id = ?').get(setId);
    if (!target) {
      return res.status(404).json({ status: 'error', message: 'Paket materi tidak ditemukan.' });
    }

    const qCount = db.prepare('SELECT COUNT(*) as count FROM diagnostic_questions WHERE set_id = ? AND is_active = 1').get(setId);
    if (qCount.count === 0) {
      return res.status(400).json({
        status: 'error',
        message: `Paket "${target.title}" belum memiliki butir soal. Tambahkan minimal 1 soal sebelum mengaktifkannya untuk siswa.`
      });
    }

    db.prepare('UPDATE diagnostic_question_sets SET is_active = 0').run();
    db.prepare('UPDATE diagnostic_question_sets SET is_active = 1, updated_at = ? WHERE id = ?').run(new Date().toISOString(), setId);

    res.json({
      status: 'success',
      message: `Paket materi "${target.title}" kini aktif digunakan di Portal Siswa. Paket sebelumnya tetap tersimpan di arsip.`
    });
  } catch (err) {
    console.error('[Question Sets API]', err);
    res.status(500).json({ status: 'error', message: 'Gagal mengaktifkan paket materi.' });
  }
});

// DELETE /api/questions/sets/:setId - Hapus paket materi arsip beserta soalnya
router.delete('/sets/:setId', requireAuth, (req, res) => {
  const { setId } = req.params;

  try {
    const target = db.prepare('SELECT id, title, is_active FROM diagnostic_question_sets WHERE id = ?').get(setId);
    if (!target) {
      return res.status(404).json({ status: 'error', message: 'Paket materi tidak ditemukan.' });
    }

    const totalSets = db.prepare('SELECT COUNT(*) as count FROM diagnostic_question_sets').get().count;
    if (totalSets <= 1) {
      return res.status(400).json({ status: 'error', message: 'Tidak dapat menghapus satu-satunya paket materi yang tersisa.' });
    }

    if (target.is_active === 1) {
      return res.status(400).json({
        status: 'error',
        message: 'Paket yang sedang aktif untuk siswa tidak dapat langsung dihapus. Aktifkan paket lain terlebih dahulu.'
      });
    }

    db.prepare('DELETE FROM diagnostic_questions WHERE set_id = ?').run(setId);
    db.prepare('DELETE FROM diagnostic_question_sets WHERE id = ?').run(setId);

    res.json({ status: 'success', message: `Paket materi "${target.title}" berhasil dihapus dari arsip.` });
  } catch (err) {
    console.error('[Question Sets API]', err);
    res.status(500).json({ status: 'error', message: 'Gagal menghapus paket materi.' });
  }
});

// ========================================================
// 3. QUESTION ITEMS CRUD (SCOPED BY SET_ID)
// ========================================================

// GET /api/questions/all - Ambil semua soal dari setId tertentu (atau set aktif jika kosong)
router.get('/all', requireAuth, (req, res) => {
  try {
    const activeSet = getActiveSetRow();
    const targetSetId = req.query.setId ? parseInt(req.query.setId, 10) : (activeSet ? activeSet.id : null);

    const rows = targetSetId
      ? db.prepare(`
          SELECT id, set_id, order_num, category, title, subtitle, options_json, is_media_selector, reason_label, is_active
          FROM diagnostic_questions
          WHERE set_id = ?
          ORDER BY order_num ASC, id ASC
        `).all(targetSetId)
      : db.prepare(`
          SELECT id, set_id, order_num, category, title, subtitle, options_json, is_media_selector, reason_label, is_active
          FROM diagnostic_questions
          ORDER BY order_num ASC, id ASC
        `).all();

    const questions = rows.map(r => ({
      ...r,
      options: JSON.parse(r.options_json || '[]'),
      isMediaSelector: Boolean(r.is_media_selector),
      isActive: Boolean(r.is_active)
    }));

    res.json({ status: 'success', data: questions, setId: targetSetId });
  } catch (err) {
    console.error('[Questions API]', err);
    res.status(500).json({ status: 'error', message: 'Gagal memuat seluruh soal diagnostik.' });
  }
});

// POST /api/questions/reset - Reset soal default (hanya me-reset paket standar, tidak menghapus paket materi kustom lain)
router.post('/reset', requireAuth, (req, res) => {
  try {
    const { setId } = req.body || {};
    let targetSet = setId
      ? db.prepare('SELECT id, title FROM diagnostic_question_sets WHERE id = ?').get(setId)
      : db.prepare('SELECT id, title FROM diagnostic_question_sets WHERE is_default = 1 LIMIT 1').get();

    if (!targetSet) {
      targetSet = getActiveSetRow();
    }

    if (!targetSet) {
      const seed = require('../config/seed');
      seed();
      return res.json({ status: 'success', message: 'Daftar soal diagnostik berhasil di-reset ke 10 soal default.' });
    }

    db.prepare('DELETE FROM diagnostic_questions WHERE set_id = ?').run(targetSet.id);
    const { seedDefaultQuestionsForSet } = require('../config/seed');
    seedDefaultQuestionsForSet(targetSet.id);
    db.prepare('UPDATE diagnostic_question_sets SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), targetSet.id);

    res.json({
      status: 'success',
      message: `Paket "${targetSet.title}" berhasil di-reset ke 10 soal standar bawaan. Paket materi lain tetap aman tersimpan.`
    });
  } catch (err) {
    console.error('[Questions API]', err);
    res.status(500).json({ status: 'error', message: 'Gagal me-reset soal diagnostik.' });
  }
});

// POST /api/questions - Tambah soal baru ke dalam paket materi tertentu (khusus guru)
router.post('/', requireAuth, (req, res) => {
  const { set_id, setId, category, title, subtitle, options, is_media_selector, reason_label, order_num } = req.body;

  if (!category || !title) {
    return res.status(400).json({ status: 'error', message: 'Kategori dan judul pertanyaan wajib diisi.' });
  }

  try {
    const activeSet = getActiveSetRow();
    const targetSetId = set_id || setId || (activeSet ? activeSet.id : null);

    let nextOrder = order_num;
    if (!nextOrder) {
      const maxOrder = targetSetId
        ? db.prepare('SELECT MAX(order_num) as max_o FROM diagnostic_questions WHERE set_id = ?').get(targetSetId)
        : db.prepare('SELECT MAX(order_num) as max_o FROM diagnostic_questions').get();
      nextOrder = (maxOrder?.max_o || 0) + 1;
    }

    const optionsJson = JSON.stringify(Array.isArray(options) ? options : []);
    const isMedia = is_media_selector ? 1 : 0;
    const nowIso = new Date().toISOString();

    const result = db.prepare(`
      INSERT INTO diagnostic_questions (set_id, order_num, category, title, subtitle, options_json, is_media_selector, reason_label, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).run(targetSetId, nextOrder, category, title, subtitle || '', optionsJson, isMedia, reason_label || '', nowIso, nowIso);

    if (targetSetId) {
      db.prepare('UPDATE diagnostic_question_sets SET updated_at = ? WHERE id = ?').run(nowIso, targetSetId);
    }

    res.json({
      status: 'success',
      message: 'Soal diagnostik berhasil ditambahkan.',
      id: result.lastInsertRowid,
      setId: targetSetId
    });
  } catch (err) {
    console.error('[Questions API]', err);
    res.status(500).json({ status: 'error', message: 'Gagal menambahkan butir soal.' });
  }
});

// PUT /api/questions/:id - Update soal (khusus guru)
router.put('/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const { category, title, subtitle, options, is_media_selector, reason_label, order_num, is_active } = req.body;

  try {
    const existing = db.prepare('SELECT id, set_id FROM diagnostic_questions WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ status: 'error', message: 'Soal tidak ditemukan.' });
    }

    const optionsJson = JSON.stringify(Array.isArray(options) ? options : []);
    const isMedia = is_media_selector ? 1 : 0;
    const activeVal = (is_active === false || is_active === 0) ? 0 : 1;
    const nowIso = new Date().toISOString();

    db.prepare(`
      UPDATE diagnostic_questions
      SET category = COALESCE(?, category),
          title = COALESCE(?, title),
          subtitle = COALESCE(?, subtitle),
          options_json = ?,
          is_media_selector = ?,
          reason_label = ?,
          order_num = COALESCE(?, order_num),
          is_active = ?,
          updated_at = ?
      WHERE id = ?
    `).run(
      category,
      title,
      subtitle,
      optionsJson,
      isMedia,
      reason_label !== undefined ? reason_label : '',
      order_num,
      activeVal,
      nowIso,
      id
    );

    if (existing.set_id) {
      db.prepare('UPDATE diagnostic_question_sets SET updated_at = ? WHERE id = ?').run(nowIso, existing.set_id);
    }

    res.json({ status: 'success', message: 'Soal diagnostik berhasil diperbarui.' });
  } catch (err) {
    console.error('[Questions API]', err);
    res.status(500).json({ status: 'error', message: 'Gagal memperbarui soal diagnostik.' });
  }
});

// DELETE /api/questions/:id - Hapus soal (khusus guru)
router.delete('/:id', requireAuth, (req, res) => {
  const { id } = req.params;

  try {
    const existing = db.prepare('SELECT id, set_id FROM diagnostic_questions WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ status: 'error', message: 'Soal tidak ditemukan.' });
    }

    db.prepare('DELETE FROM diagnostic_questions WHERE id = ?').run(id);
    if (existing.set_id) {
      db.prepare('UPDATE diagnostic_question_sets SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), existing.set_id);
    }
    res.json({ status: 'success', message: 'Soal diagnostik berhasil dihapus.' });
  } catch (err) {
    console.error('[Questions API]', err);
    res.status(500).json({ status: 'error', message: 'Gagal menghapus soal.' });
  }
});

module.exports = router;
