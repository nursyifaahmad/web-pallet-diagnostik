const http = require('http');
const app = require('../src/server'); // server starts listening

setTimeout(async () => {
  console.log('\n--- STARTING AUTOMATED INTEGRATION TESTS (WITH ATTENDANCE NO & GENDER) ---');

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

    // 3. Test Student Live Progress with Attendance No & Gender
    const testSessionId = 'sess_test_att_888';
    const liveProgressRes = await fetchJson('/api/students/live-progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: testSessionId,
        attendanceNo: 17,
        studentName: 'Rian Pratama',
        gender: 'L',
        classId: 'VII-A',
        currentStep: 4,
        totalSteps: 10,
        currentCategory: 'Aspek 4: Kesulitan Berkarya',
        answers: {
          1: { selected: 'Sangat senang' },
          2: { category: '3D', subOption: 'Lempung & Plastisin' }
        }
      })
    });
    console.log('✓ Live progress heartbeat received:', liveProgressRes.message);

    // 4. Teacher Login
    const loginRes = await fetchJson('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'guru', password: 'guru123' })
    });
    console.log('✓ Teacher login verified:', loginRes.message);
    const token = loginRes.token;

    // 5. Test Teacher Live Monitoring
    const liveMonitorRes = await fetchJson('/api/students/live-monitor?class=VII-A', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const liveStudent = liveMonitorRes.data.sessions.find(s => s.sessionId === testSessionId);
    if (!liveStudent) throw new Error('Live student not found in Teacher Live Monitor!');
    console.log(`✓ Live student verified: No. ${liveStudent.attendanceNo} - ${liveStudent.name} (${liveStudent.gender}) at Step ${liveStudent.currentStep}/10`);
    if (liveStudent.attendanceNo !== 17 || liveStudent.gender !== 'L') {
      throw new Error(`Expected attendance 17 and gender L, got: ${liveStudent.attendanceNo}, ${liveStudent.gender}`);
    }

    // 6. Test Required Question Validation & Submit Student Assessment Permanently
    const activeQuestionsRes = await fetchJson('/api/questions');
    const allQuestions = activeQuestionsRes.data;

    // Test rejection of incomplete submission
    const rejectedRes = await fetchJson('/api/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: testSessionId,
        attendance_no: 17,
        name: 'Rian Pratama',
        gender: 'L',
        class_id: 'VII-A',
        answers: { [allQuestions[0].id]: { selected: 'Sangat senang' } }
      })
    });
    if (rejectedRes.httpStatus !== 400) {
      throw new Error(`Expected HTTP 400 for incomplete answers, got: ${rejectedRes.httpStatus}`);
    }
    console.log('✓ Incomplete answers correctly rejected by backend validation (All questions required)');

    // Build complete answers for all questions
    const completeAnswers = {};
    allQuestions.forEach(q => {
      if (q.isMediaSelector) {
        completeAnswers[q.id] = { category: '3D', subOption: 'Lempung & Plastisin', reason: 'Suka membuat patung' };
      } else {
        completeAnswers[q.id] = { selected: q.options[0] || 'Sangat senang', reason: 'Alasan belajar' };
      }
    });

    const studentRes = await fetchJson('/api/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: testSessionId,
        attendance_no: 17,
        name: 'Rian Pratama',
        gender: 'L',
        class_id: 'VII-A',
        category: '3D',
        sub_option: 'Lempung & Plastisin',
        style: 'Kinestetik Eksploratif',
        challenge: 'Sketsa Proporsi',
        feeling: 'Sangat senang',
        answers: completeAnswers
      })
    });
    console.log('✓ Student assessment submitted permanently:', studentRes.data.name, 'No. Absen:', studentRes.data.attendance_no, 'Gender:', studentRes.data.gender);
    if (studentRes.data.attendance_no !== 17 || studentRes.data.gender !== 'L') {
      throw new Error('Attendance number or gender mismatch on submission!');
    }

    // 7. Verify in Class Roster
    const studentsRes = await fetchJson('/api/students?class=VII-A');
    const storedStudent = studentsRes.data.find(s => s.name === 'Rian Pratama');
    if (!storedStudent) throw new Error('Student not found in VII-A roster!');
    console.log(`✓ Verified in Roster: No. ${storedStudent.attendance_no} - ${storedStudent.name} (${storedStudent.gender})`);
    if (storedStudent.attendance_no !== 17 || storedStudent.gender !== 'L') {
      throw new Error('Database stored student has mismatched attendance or gender!');
    }

    // 8. Test Excel Export Endpoint
    const exportRes = await fetch('http://localhost:3090/api/export/excel?class=VII-A', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('✓ Excel export HTTP status:', exportRes.status, 'Content-Type:', exportRes.headers.get('content-type'));
    if (exportRes.status !== 200) throw new Error('Excel export failed!');

    console.log('\n============================================================');
    console.log(' ALL INTEGRATION TESTS PASSED WITH 100% SUCCESS!');
    console.log(' NOMOR ABSEN & JENIS KELAMIN FULLY VERIFIED!');
    console.log('============================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exit(1);
  }
}, 1200);
