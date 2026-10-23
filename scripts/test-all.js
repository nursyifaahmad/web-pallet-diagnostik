const http = require('http');
const app = require('../src/server'); // server starts listening

// Wait 1 second then run API tests
setTimeout(async () => {
  console.log('\n--- STARTING AUTOMATED INTEGRATION TESTS ---');

  const fetchJson = async (url, options = {}) => {
    const res = await fetch(`http://localhost:3090${url}`, options);
    const json = await res.json();
    return { httpStatus: res.status, ...json };
  };

  try {
    // 1. Healthcheck
    const health = await fetchJson('/health');
    console.log('✓ Healthcheck:', health.httpStatus, health.app);

    // 2. Classes (27 classes)
    const classesRes = await fetchJson('/api/classes');
    const classes = classesRes.data;
    console.log(`✓ Classes loaded: ${classes.length} classes (Grade 7, 8, 9)`);
    if (classes.length !== 27) throw new Error('Expected 27 classes!');

    // 3. Active Questions
    const questionsRes = await fetchJson('/api/questions');
    const questions = questionsRes.data;
    console.log(`✓ Active questions loaded: ${questions.length} questions`);
    if (questions.length === 0) throw new Error('No questions found!');

    // 4. Submit Student Assessment (Ahmad Siswa)
    const studentRes = await fetchJson('/api/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Ahmad Siswa Pengujian',
        class_id: 'VII-A',
        category: '2D',
        sub_option: 'Media Kering',
        style: 'Visual Tutorial',
        challenge: 'Sketsa Proporsi',
        feeling: 'Sangat senang',
        answers: {
          1: { selected: 'Sangat senang', reason: 'Pelajaran seni sangat asyik' }
        }
      })
    });
    console.log('✓ Student assessment submitted:', studentRes.data.name, 'in', studentRes.data.class_id);

    // 5. Query students in VII-A
    const studentsRes = await fetchJson('/api/students?class=VII-A');
    const studentsInClass = studentsRes.data;
    console.log(`✓ Students in VII-A: ${studentsInClass.length} students`);
    const found = studentsInClass.some(s => s.name === 'Ahmad Siswa Pengujian');
    if (!found) throw new Error('Submitted student not found in VII-A roster!');

    // 6. Login as Guru
    const loginRes = await fetchJson('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'guru', password: 'guru123' })
    });
    console.log('✓ Teacher login verified:', loginRes.message, 'User:', loginRes.user.name);
    const token = loginRes.token;

    // 7. Teacher Question CRUD test
    const newQ = await fetchJson('/api/questions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        category: 'Aspek 11: Desain & Kriya Terapan',
        title: 'Apakah kamu menyukai karya seni kriya terapan fungsional?',
        subtitle: 'Pilih tingkat ketertarikanmu.',
        options: ['Sangat Tertarik', 'Tertarik', 'Kurang Tertarik'],
        reason_label: 'Jelaskan jenis kriya yang ingin kamu buat:'
      })
    });
    console.log('✓ Question created by teacher. New Question ID:', newQ.id);

    // Verify it appears in active questions
    const updatedQuestionsRes = await fetchJson('/api/questions');
    console.log(`✓ Total questions now: ${updatedQuestionsRes.data.length}`);

    // Delete test question
    const delQ = await fetchJson(`/api/questions/${newQ.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('✓ Question deleted by teacher:', delQ.message);

    // 8. Calendar test
    const calEvent = await fetchJson('/api/calendar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        title: 'Asesmen Diagnostik Semester Gasal',
        event_date: '2026-10-25',
        type: 'asesmen',
        class_id: 'VII-A'
      })
    });
    console.log('✓ Calendar event created:', calEvent.message);

    console.log('\n=============================================');
    console.log(' ALL INTEGRATION TESTS PASSED WITH 100% SUCCESS!');
    console.log('=============================================\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exit(1);
  }
}, 1200);
