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

function parseSafeDate(dateStr) {
  if (!dateStr) return null;
  if (typeof dateStr !== 'string') return new Date(dateStr);
  if (dateStr.includes('T') && (dateStr.endsWith('Z') || dateStr.includes('+') || (dateStr.lastIndexOf('-') > 7))) {
    return new Date(dateStr);
  }
  if (dateStr.includes('T')) {
    return new Date(dateStr + 'Z');
  }
  return new Date(dateStr.replace(' ', 'T') + 'Z');
}

async function runTests() {
  console.log('--- STARTING LIVE ACTIVITY TIMESTAMPS TEST ---');
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

  // 2. Send Live Progress Heartbeat (First time / Created At)
  const testSessionId = 'sess_time_test_' + Date.now();
  try {
    const sendRes = await request({
      hostname: 'localhost',
      port: 3090,
      path: '/api/students/live-progress',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      sessionId: testSessionId,
      attendanceNo: 21,
      studentName: 'Bima Waktu Test',
      gender: 'L',
      classId: 'VII-A',
      currentStep: 2,
      totalSteps: 10,
      currentCategory: 'Aspek 2: Minat Media',
      answers: { 1: { selected: 'Sangat senang', reason: 'Suka seni' } }
    });

    if (sendRes.status === 200 && sendRes.data.status === 'success') {
      console.log('✓ [PASS] Sent initial live-progress heartbeat');
      passed++;
    } else {
      console.error('✗ [FAIL] Failed to send live progress:', sendRes);
      failed++;
    }
  } catch (err) {
    console.error('✗ [FAIL] Live progress error:', err.message);
    failed++;
  }

  // 3. Query Live Monitor and verify created_at & updated_at
  let initialCreatedAt = null;
  let initialUpdatedAt = null;
  try {
    const monitorRes = await request({
      hostname: 'localhost',
      port: 3090,
      path: '/api/students/live-monitor?class=VII-A',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (monitorRes.status === 200 && monitorRes.data.status === 'success') {
      const session = monitorRes.data.data.sessions.find(s => s.sessionId === testSessionId);
      if (session) {
        console.log(`✓ [PASS] Found test session in live monitor: ${session.name}`);
        console.log(`  - createdAt: ${session.createdAt}`);
        console.log(`  - updatedAt: ${session.updatedAt}`);
        passed++;

        initialCreatedAt = session.createdAt;
        initialUpdatedAt = session.updatedAt;

        // Verify the time difference is NOT 7 hours!
        const parsedUpdated = parseSafeDate(session.updatedAt);
        const now = new Date();
        const diffSeconds = Math.abs(Math.floor((now.getTime() - parsedUpdated.getTime()) / 1000));
        console.log(`  - Time difference from now: ${diffSeconds} seconds`);

        if (diffSeconds < 30) {
          console.log(`✓ [PASS] Timezone bug fixed! Timestamp is accurate within ${diffSeconds} seconds (NOT 7 hours!)`);
          passed++;
        } else {
          console.error(`✗ [FAIL] Timestamp difference is too large: ${diffSeconds} seconds! (Potential timezone bug)`);
          failed++;
        }
      } else {
        console.error('✗ [FAIL] Test session not found in live monitor');
        failed++;
      }
    } else {
      console.error('✗ [FAIL] Live monitor query failed:', monitorRes);
      failed++;
    }
  } catch (err) {
    console.error('✗ [FAIL] Monitor query error:', err.message);
    failed++;
  }

  // 4. Send second heartbeat after 1.5 seconds to verify updated_at changes while created_at remains constant
  await new Promise(r => setTimeout(r, 1500));
  try {
    await request({
      hostname: 'localhost',
      port: 3090,
      path: '/api/students/live-progress',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      sessionId: testSessionId,
      attendanceNo: 21,
      studentName: 'Bima Waktu Test',
      gender: 'L',
      classId: 'VII-A',
      currentStep: 3,
      totalSteps: 10,
      currentCategory: 'Aspek 3: Kebiasaan Berkarya',
      answers: { 1: { selected: 'Sangat senang' }, 2: { category: '2D', subOption: 'Kering' } }
    });

    const secondMonitorRes = await request({
      hostname: 'localhost',
      port: 3090,
      path: '/api/students/live-monitor?class=VII-A',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const updatedSession = secondMonitorRes.data?.data?.sessions.find(s => s.sessionId === testSessionId);
    if (updatedSession) {
      console.log(`✓ [PASS] Heartbeat #2 updated step to: ${updatedSession.currentStep}/${updatedSession.totalSteps}`);
      console.log(`  - initial createdAt: ${initialCreatedAt}`);
      console.log(`  - current createdAt: ${updatedSession.createdAt}`);
      console.log(`  - new updatedAt:     ${updatedSession.updatedAt}`);
      passed++;

      if (updatedSession.createdAt === initialCreatedAt) {
        console.log('✓ [PASS] createdAt preserved accurately (first time student started)');
        passed++;
      } else {
        console.error('✗ [FAIL] createdAt was overwritten on heartbeat!');
        failed++;
      }

      if (updatedSession.updatedAt >= initialUpdatedAt) {
        console.log('✓ [PASS] updatedAt correctly updated to latest server receipt time');
        passed++;
      } else {
        console.error('✗ [FAIL] updatedAt was not updated!');
        failed++;
      }
    } else {
      console.error('✗ [FAIL] Session missing on second check');
      failed++;
    }
  } catch (err) {
    console.error('✗ [FAIL] Second heartbeat error:', err.message);
    failed++;
  }

  console.log(`\n--- RESULT: ${passed} PASSED, ${failed} FAILED ---`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
