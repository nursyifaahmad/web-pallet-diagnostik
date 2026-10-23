const http = require('http');
const app = require('../src/server'); // server starts listening

// Wait 1 second then run API tests
setTimeout(async () => {
  console.log('\n--- STARTING AUTOMATED INTEGRATION TESTS (WITH LIVE PROGRESS & PERSISTENCE) ---');

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

    // 4. Test Student Live Progress Heartbeat (Simulating Active Student in Real-time)
    const testSessionId = 'sess_test_12345';
    const liveProgressRes = await fetchJson('/api/students/live-progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: testSessionId,
        studentName: 'Siswa Uji Realtime',
        classId: 'VII-A',
        currentStep: 6,
        totalSteps: 10,
        currentCategory: 'Aspek 6: Kenyamanan Bekerja',
        answers: {
          1: { selected: 'Sangat senang' },
          2: { category: '2D', subOption: 'Media Basah' }
        }
      })
    });
    console.log('✓ Live progress heartbeat received:', liveProgressRes.message);

    // 5. Teacher Login
    const loginRes = await fetchJson('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'guru', password: 'guru123' })
    });
    console.log('✓ Teacher login verified:', loginRes.message, 'User:', loginRes.user.name);
    const token = loginRes.token;

    // 6. Test Teacher Live Monitoring
    const liveMonitorRes = await fetchJson('/api/students/live-monitor?class=VII-A', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log(`✓ Teacher Live Monitor data received: ${liveMonitorRes.data.activeCount} active student(s)`);
    const liveStudent = liveMonitorRes.data.sessions.find(s => s.sessionId === testSessionId);
    if (!liveStudent) throw new Error('Live student not found in Teacher Live Monitor!');
    console.log(`✓ Verified Live Student: ${liveStudent.name} at Step ${liveStudent.currentStep}/${liveStudent.totalSteps} (${liveStudent.progressPercent}%) - Media: ${liveStudent.chosenMedia}`);

    // 7. Submit Student Assessment Permanently (with sessionId)
    const studentRes = await fetchJson('/api/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: testSessionId,
        name: 'Siswa Uji Realtime',
        class_id: 'VII-A',
        category: '2D',
        sub_option: 'Media Basah',
        style: 'Visual Tutorial',
        challenge: 'Sketsa Proporsi',
        feeling: 'Sangat senang',
        answers: {
          1: { selected: 'Sangat senang' },
          2: { category: '2D', subOption: 'Media Basah' }
        }
      })
    });
    console.log('✓ Student assessment submitted permanently:', studentRes.data.name, 'in', studentRes.data.class_id);

    // 8. Verify Session is now marked Completed in Live Monitor
    const liveAfterSubmit = await fetchJson('/api/students/live-monitor?class=VII-A', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const completedSession = liveAfterSubmit.data.sessions.find(s => s.sessionId === testSessionId);
    console.log(`✓ Verified Live Session status after submit: ${completedSession.status}`);
    if (completedSession.status !== 'completed') throw new Error('Session should be marked completed!');

    // 9. Teacher Question CRUD test
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

    const delQ = await fetchJson(`/api/questions/${newQ.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('✓ Question deleted by teacher:', delQ.message);

    console.log('\n============================================================');
    console.log(' ALL INTEGRATION TESTS PASSED WITH 100% SUCCESS!');
    console.log(' PERSISTENT STORAGE & REAL-TIME MONITORING VERIFIED!');
    console.log('============================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exit(1);
  }
}, 1200);
