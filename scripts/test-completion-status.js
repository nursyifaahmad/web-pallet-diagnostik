const http = require('http');

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, data: body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(typeof data === 'string' ? data : JSON.stringify(data));
    req.end();
  });
}

async function runTests() {
  console.log('--- STARTING COMPLETION STATUS & UI VERIFICATION TEST ---');
  let passed = 0;
  let failed = 0;

  // 1. Teacher login to get token
  let token = '';
  try {
    const loginRes = await request({
      hostname: 'localhost',
      port: 3090,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { username: 'guru', password: 'guru123' });

    if (loginRes.status === 200 && loginRes.data.token) {
      token = loginRes.data.token;
      console.log('✓ [PASS] Teacher login successful');
      passed++;
    } else {
      console.error('✗ [FAIL] Teacher login failed:', loginRes);
      failed++;
    }
  } catch (err) {
    console.error('✗ [FAIL] Teacher login error:', err.message);
    failed++;
  }

  // 2. Fetch all active questions to build valid submission
  let activeQuestions = [];
  try {
    const qRes = await request({
      hostname: 'localhost',
      port: 3090,
      path: '/api/questions',
      method: 'GET'
    });
    activeQuestions = qRes.data?.data || [];
    console.log(`✓ [PASS] Loaded ${activeQuestions.length} active questions`);
    passed++;
  } catch (err) {
    console.error('✗ [FAIL] Failed to load questions:', err.message);
    failed++;
  }

  // 2b. Clean up any previous test student record to ensure clean state
  const db = require('../src/config/database');
  db.prepare("DELETE FROM students WHERE name LIKE 'Citra Selesai Test%'").run();
  db.prepare("DELETE FROM student_live_sessions WHERE student_name LIKE 'Citra Selesai Test%'").run();

  // 3. Send initial live progress (in_progress)
  const testSessionId = 'sess_comp_' + Date.now();
  const studentName = 'Citra Selesai Test';
  try {
    const progressRes = await request({
      hostname: 'localhost',
      port: 3090,
      path: '/api/students/live-progress',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      sessionId: testSessionId,
      attendanceNo: 29,
      studentName,
      gender: 'P',
      classId: 'VII-A',
      currentStep: 3,
      totalSteps: 10,
      currentCategory: 'Aspek 3: Kebiasaan Berkarya',
      answers: { 1: { selected: 'Senang', reason: 'Suka seni rupa' } }
    });

    if (progressRes.status === 200) {
      console.log('✓ [PASS] Sent in_progress heartbeat');
      passed++;
    } else {
      console.error('✗ [FAIL] Failed to send heartbeat:', progressRes);
      failed++;
    }

    // Verify in Live Monitor: status is in_progress
    const monitor1 = await request({
      hostname: 'localhost',
      port: 3090,
      path: '/api/students/live-monitor?class=VII-A',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const session1 = monitor1.data?.data?.sessions.find(s => s.sessionId === testSessionId);
    if (session1 && session1.status === 'in_progress') {
      console.log(`✓ [PASS] Session status in live monitor is "in_progress" (Step ${session1.currentStep}/${session1.totalSteps})`);
      passed++;
    } else {
      console.error('✗ [FAIL] Expected in_progress, got:', session1?.status);
      failed++;
    }
  } catch (err) {
    console.error('✗ [FAIL] Error in initial heartbeat:', err.message);
    failed++;
  }

  // 4. Submit Student Assessment Permanently
  try {
    const completeAnswers = {};
    activeQuestions.forEach(q => {
      if (q.is_media_selector) {
        completeAnswers[q.id] = { category: '2D', subOption: 'Media Basah', reason: 'Suka melukis cat air' };
      } else {
        completeAnswers[q.id] = { selected: q.options[0] || 'Sangat senang', reason: 'Alasan belajar seni' };
      }
    });

    const submitRes = await request({
      hostname: 'localhost',
      port: 3090,
      path: '/api/students',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      sessionId: testSessionId,
      attendance_no: 29,
      name: studentName,
      gender: 'P',
      class_id: 'VII-A',
      category: '2D',
      sub_option: 'Media Basah',
      style: 'Visual Tutorial',
      challenge: 'Pencampuran Warna',
      feeling: 'Senang',
      answers: completeAnswers
    });

    if (submitRes.status === 200 && submitRes.data.status === 'success') {
      console.log('✓ [PASS] Submitted assessment permanently via POST /api/students');
      passed++;
    } else {
      console.error('✗ [FAIL] Permanent submission failed:', submitRes);
      failed++;
    }

    // 5. Query Live Monitor: status MUST BE 'completed', step 10/10, progress 100%
    const monitor2 = await request({
      hostname: 'localhost',
      port: 3090,
      path: '/api/students/live-monitor?class=VII-A',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const session2 = monitor2.data?.data?.sessions.find(s => s.sessionId === testSessionId);
    if (session2) {
      console.log(`✓ [PASS] Found session after submission:`);
      console.log(`  - status:          ${session2.status}`);
      console.log(`  - currentStep:     ${session2.currentStep}/${session2.totalSteps}`);
      console.log(`  - progressPercent: ${session2.progressPercent}%`);

      if (session2.status === 'completed') {
        console.log('✓ [PASS] Session status successfully updated to "completed"!');
        passed++;
      } else {
        console.error('✗ [FAIL] Session status is STILL in_progress after completion!', session2.status);
        failed++;
      }

      if (session2.progressPercent === 100) {
        console.log('✓ [PASS] Progress percent is 100%');
        passed++;
      } else {
        console.error('✗ [FAIL] Expected 100% progress, got:', session2.progressPercent);
        failed++;
      }
    } else {
      console.error('✗ [FAIL] Session not found after submission in live monitor');
      failed++;
    }

    // 6. Test Delayed Heartbeat Resilience (Race Condition test)
    // Send a delayed heartbeat with old step 3 and check that it CANNOT revert status from 'completed' back to 'in_progress'
    const delayedHeartbeat = await request({
      hostname: 'localhost',
      port: 3090,
      path: '/api/students/live-progress',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      sessionId: testSessionId,
      attendanceNo: 29,
      studentName,
      gender: 'P',
      classId: 'VII-A',
      currentStep: 3,
      totalSteps: 10,
      currentCategory: 'Aspek 3: Kebiasaan Berkarya'
    });

    const monitor3 = await request({
      hostname: 'localhost',
      port: 3090,
      path: '/api/students/live-monitor?class=VII-A',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const session3 = monitor3.data?.data?.sessions.find(s => s.sessionId === testSessionId);
    if (session3 && session3.status === 'completed') {
      console.log('✓ [PASS] Delayed heartbeat correctly blocked from reverting "completed" status back to "in_progress"!');
      passed++;
    } else {
      console.error('✗ [FAIL] Delayed heartbeat reverted completed session back to:', session3?.status);
      failed++;
    }
  } catch (err) {
    console.error('✗ [FAIL] Error in completion test:', err.message);
    failed++;
  }

  // 7. Verify UI files contain whitespace-nowrap and clean status badge styling
  try {
    const fs = require('fs');
    const guruJs = fs.readFileSync('public/js/guru.js', 'utf8');
    const guruHtml = fs.readFileSync('src/views/guru-dashboard.html', 'utf8');

    if (guruJs.includes('whitespace-nowrap') && guruJs.includes('inline-flex items-center gap-1.5')) {
      console.log('✓ [PASS] public/js/guru.js has whitespace-nowrap & inline-flex badge layout');
      passed++;
    } else {
      console.error('✗ [FAIL] public/js/guru.js missing whitespace-nowrap badge layout');
      failed++;
    }

    if (guruHtml.includes('whitespace-nowrap') && (guruHtml.includes('min-width: 140px') || guruHtml.includes('min-width: 150px'))) {
      console.log('✓ [PASS] src/views/guru-dashboard.html has whitespace-nowrap and min-width on Status column');
      passed++;
    } else {
      console.error('✗ [FAIL] src/views/guru-dashboard.html missing whitespace-nowrap on status th');
      failed++;
    }
  } catch (err) {
    console.error('✗ [FAIL] UI file check error:', err.message);
    failed++;
  }

  console.log(`\n--- RESULT: ${passed} PASSED, ${failed} FAILED ---`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
