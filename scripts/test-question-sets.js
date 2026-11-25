/**
 * scripts/test-question-sets.js
 * Comprehensive verification test for Bank Paket / Materi Soal Diagnostik (Tahap 1).
 */

const fs = require('fs');
const path = require('path');
const db = require('../src/config/database');

const BASE_URL = 'http://localhost:3090';

let passed = 0;
let failed = 0;
function assert(cond, msg) {
  if (cond) {
    console.log(`✓ [PASS] ${msg}`);
    passed++;
  } else {
    console.error(`✗ [FAIL] ${msg}`);
    failed++;
    throw new Error(msg);
  }
}

async function run() {
  console.log('🧪 Starting Bank Paket / Materi Diagnostik Verification...');

  // 1. Login as Teacher
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'guru', password: 'guru123' })
  });
  const loginData = await loginRes.json();
  assert(Boolean(loginData.token), 'Teacher login successful');
  const authHeaders = {
    'Authorization': `Bearer ${loginData.token}`,
    'Content-Type': 'application/json'
  };

  // 2. Fetch existing Question Sets & confirm Default Set exists with 10 questions
  const setsRes1 = await fetch(`${BASE_URL}/api/questions/sets`, { headers: authHeaders });
  const setsData1 = await setsRes1.json();
  assert(setsData1.status === 'success' && Array.isArray(setsData1.data), 'GET /api/questions/sets returned array');
  const defaultSet = setsData1.data.find(s => s.isDefault || s.title.includes('2D & 3D'));
  assert(Boolean(defaultSet), 'Default question set "Seni Rupa 2D & 3D" exists');
  assert(defaultSet.questionCount === 10, `Default set has 10 questions (got ${defaultSet.questionCount})`);

  // Ensure defaultSet is active initially
  if (!defaultSet.isActive) {
    await fetch(`${BASE_URL}/api/questions/sets/${defaultSet.id}/activate`, { method: 'POST', headers: authHeaders });
  }

  const pubRes1 = await fetch(`${BASE_URL}/api/questions`);
  const pubData1 = await pubRes1.json();
  assert(pubData1.data.length === 10 && pubData1.activeSet.id === defaultSet.id, 'Public GET /api/questions serves active default set (10 questions)');

  // 3. Create new custom Question Set: "Gambar Ornamen Nusantara"
  const createSetRes = await fetch(`${BASE_URL}/api/questions/sets`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      title: 'Gambar Ornamen Nusantara Test',
      description: 'Materi ragam hias flora, fauna, dan geometris Nusantara.'
    })
  });
  const createSetData = await createSetRes.json();
  assert(createSetData.status === 'success' && Boolean(createSetData.data?.id), 'Created new question set "Gambar Ornamen Nusantara Test"');
  const ornamentSetId = createSetData.data.id;

  // Activating empty set must be rejected (requires >= 1 question)
  const emptyActivateRes = await fetch(`${BASE_URL}/api/questions/sets/${ornamentSetId}/activate`, {
    method: 'POST',
    headers: authHeaders
  });
  assert(emptyActivateRes.status === 400, 'Activating empty set is correctly blocked with 400');

  // 4. Add 2 custom questions to "Gambar Ornamen Nusantara Test"
  // Q1: Without reason_label (optional essay)
  const q1Res = await fetch(`${BASE_URL}/api/questions`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      set_id: ornamentSetId,
      category: 'Aspek 1: Ketertarikan Motif Ornamen',
      title: 'Motif ornamen apa yang paling ingin kamu pelajari?',
      subtitle: 'Pilih satu motif utama.',
      options: ['Motif Flora (Tumbuhan)', 'Motif Fauna (Hewan)', 'Motif Geometris'],
      reason_label: ''
    })
  });
  const q1Data = await q1Res.json();
  assert(q1Data.status === 'success' && Boolean(q1Data.id), 'Added Q1 (optional reason) to Gambar Ornamen set');

  // Q2: With required reason_label
  const q2Res = await fetch(`${BASE_URL}/api/questions`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      set_id: ornamentSetId,
      category: 'Aspek 2: Teknik Pewarnaan Ornamen',
      title: 'Teknik pewarnaan ornamen apa yang paling kamu kuasai?',
      subtitle: 'Pilih teknik favoritmu.',
      options: ['Gradasi Pensil Warna', 'Blocking Spidol / Cat Poster', 'Arsir Hitam Putih'],
      reason_label: 'Jelaskan pengalamanmu menggunakan teknik tersebut!'
    })
  });
  const q2Data = await q2Res.json();
  assert(q2Data.status === 'success' && Boolean(q2Data.id), 'Added Q2 (required reason) to Gambar Ornamen set');

  // 5. Activate "Gambar Ornamen Nusantara Test"
  const activateRes = await fetch(`${BASE_URL}/api/questions/sets/${ornamentSetId}/activate`, {
    method: 'POST',
    headers: authHeaders
  });
  const activateData = await activateRes.json();
  assert(activateData.status === 'success', 'Activated "Gambar Ornamen Nusantara Test" set');

  // 6. Verify Student Portal public endpoint serves the new set
  const pubRes2 = await fetch(`${BASE_URL}/api/questions`);
  const pubData2 = await pubRes2.json();
  assert(pubData2.activeSet.id === ornamentSetId, 'Public activeSet updated to Gambar Ornamen');
  assert(pubData2.data.length === 2, `Public GET /api/questions now returns 2 custom questions (got ${pubData2.data.length})`);

  // 7. Verify OLD default set is STILL preserved intact in DB!
  const oldSetQuestionsRes = await fetch(`${BASE_URL}/api/questions/all?setId=${defaultSet.id}`, { headers: authHeaders });
  const oldSetQuestionsData = await oldSetQuestionsRes.json();
  assert(oldSetQuestionsData.data.length === 10, `Old default set still preserves all 10 questions (got ${oldSetQuestionsData.data.length})`);

  // 8. Verify Student Submission works on custom set (Q1 no reason allowed, Q2 missing reason rejected, Q2 with reason succeeds)
  const badSubRes = await fetch(`${BASE_URL}/api/students`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      attendance_no: 97,
      name: 'Test Ornamen Murid',
      gender: 'P',
      class_id: 'VII-A',
      category: '2D',
      sub_option: 'Gambar Ornamen Nusantara Test',
      answers: {
        [q1Data.id]: { selected: 'Motif Flora (Tumbuhan)', reason: '' },
        [q2Data.id]: { selected: 'Gradasi Pensil Warna', reason: '' }
      }
    })
  });
  assert(badSubRes.status === 400, 'Submission rejected when Q2 required reason is empty');

  const goodSubRes = await fetch(`${BASE_URL}/api/students`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      attendance_no: 97,
      name: 'Test Ornamen Murid',
      gender: 'P',
      class_id: 'VII-A',
      category: '2D',
      sub_option: 'Gambar Ornamen Nusantara Test',
      answers: {
        [q1Data.id]: { selected: 'Motif Flora (Tumbuhan)', reason: '' }, // optional essay!
        [q2Data.id]: { selected: 'Gradasi Pensil Warna', reason: 'Suka memadukan warna daun.' }
      }
    })
  });
  const goodSubData = await goodSubRes.json();
  assert(goodSubData.status === 'success' && Boolean(goodSubData.data?.id), 'Student submission succeeded with optional Q1 reason + filled Q2 reason');
  const testStudentId = goodSubData.data.id;

  const savedStudent = db.prepare('SELECT question_set_id, question_set_title FROM students WHERE id = ?').get(testStudentId);
  assert(savedStudent && savedStudent.question_set_id === ornamentSetId && savedStudent.question_set_title === 'Gambar Ornamen Nusantara Test',
    'Student DB row records question_set_id and question_set_title');

  // 9. Duplicate Question Set Test
  const dupRes = await fetch(`${BASE_URL}/api/questions/sets`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      title: 'Salinan Ornamen Test',
      description: 'Versi duplikat',
      copyFromSetId: ornamentSetId
    })
  });
  const dupData = await dupRes.json();
  assert(dupData.status === 'success' && dupData.data.questionCount === 2, 'Duplicating question set copied all 2 questions');
  const dupSetId = dupData.data.id;

  // 10. Deleting currently active set must be rejected
  const delActiveRes = await fetch(`${BASE_URL}/api/questions/sets/${ornamentSetId}`, {
    method: 'DELETE',
    headers: authHeaders
  });
  assert(delActiveRes.status === 400, 'Deleting active question set is protected with 400');

  // 11. Switch back to default set WITHOUT losing anything, verify public questions return to 10!
  const reactivateRes = await fetch(`${BASE_URL}/api/questions/sets/${defaultSet.id}/activate`, {
    method: 'POST',
    headers: authHeaders
  });
  assert((await reactivateRes.json()).status === 'success', 'Switched back to default "Seni Rupa 2D & 3D" set');

  const pubRes3 = await fetch(`${BASE_URL}/api/questions`);
  const pubData3 = await pubRes3.json();
  assert(pubData3.activeSet.id === defaultSet.id && pubData3.data.length === 10, 'Public endpoint immediately restores 10 default questions');

  // Cleanup test data
  await fetch(`${BASE_URL}/api/questions/sets/${ornamentSetId}`, { method: 'DELETE', headers: authHeaders });
  await fetch(`${BASE_URL}/api/questions/sets/${dupSetId}`, { method: 'DELETE', headers: authHeaders });
  db.prepare('DELETE FROM students WHERE id = ?').run(testStudentId);
  console.log('✓ [PASS] Cleaned up temporary test sets and student record');
  passed++;

  // 12. Static UI & API client verification
  const html = fs.readFileSync(path.join(__dirname, '../src/views/guru-dashboard.html'), 'utf8');
  const guruJs = fs.readFileSync(path.join(__dirname, '../public/js/guru.js'), 'utf8');
  const apiJs = fs.readFileSync(path.join(__dirname, '../public/js/api.js'), 'utf8');
  const studentHtml = fs.readFileSync(path.join(__dirname, '../public/student/index.html'), 'utf8');
  const studentJs = fs.readFileSync(path.join(__dirname, '../public/js/student.js'), 'utf8');

  assert(html.includes('id="question-sets-container"'), 'HTML has #question-sets-container');
  assert(html.includes('id="modal-question-set"'), 'HTML has #modal-question-set');
  assert(guruJs.includes('function loadQuestionSets') && guruJs.includes('function activateQuestionSet'), 'guru.js implements question set handlers');
  assert(apiJs.includes('getQuestionSets') && apiJs.includes('activateQuestionSet'), 'api.js exposes question set methods');
  assert(studentHtml.includes('id="header-set-badge"'), 'student/index.html displays active material badge');
  assert(studentJs.includes('questionSetId') && studentJs.includes('reason-section'), 'student.js tracks questionSetId and optional reason section');

  console.log(`\n🎉 ALL QUESTION SETS TESTS PASSED (${passed} PASSED, ${failed} FAILED)!`);
}

run().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
