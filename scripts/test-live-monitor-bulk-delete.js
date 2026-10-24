/**
 * scripts/test-live-monitor-bulk-delete.js
 * Verification test for Checkbox Selection & Bulk Deletion in Live Monitor table.
 */

const BASE_URL = 'http://localhost:3090';

async function run() {
  console.log('🧪 Starting Live Monitor Bulk Selection & Delete Verification...');

  // 1. Authenticate as Teacher
  console.log('1. Authenticating as teacher...');
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'guru', password: 'guru123' })
  });
  const loginData = await loginRes.json();
  if (!loginData.token) {
    throw new Error('Teacher login failed: ' + JSON.stringify(loginData));
  }
  const token = loginData.token;
  const authHeaders = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
  console.log('✅ Teacher authenticated successfully.');

  // 2. Create 3 Test Live Sessions in VII-A
  console.log('2. Creating 3 test live sessions in VII-A...');
  const sessionIds = [
    `test-live-bulk-${Date.now()}-1`,
    `test-live-bulk-${Date.now()}-2`,
    `test-live-bulk-${Date.now()}-3`
  ];

  for (let i = 0; i < 3; i++) {
    const res = await fetch(`${BASE_URL}/api/students/live-progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: sessionIds[i],
        attendanceNo: 80 + i,
        studentName: `Live Test Siswa ${i + 1}`,
        gender: i % 2 === 0 ? 'L' : 'P',
        classId: 'VII-A',
        currentStep: 4 + i,
        totalSteps: 10,
        currentCategory: 'Aspek 4: Kesulitan Berkarya',
        answers: {}
      })
    });
    const data = await res.json();
    if (data.status !== 'success') {
      throw new Error(`Failed to create live session ${sessionIds[i]}: ` + JSON.stringify(data));
    }
  }
  console.log(`✅ 3 live sessions created: ${sessionIds.join(', ')}`);

  // 3. Verify Presence in Live Monitor
  console.log('3. Checking live monitor for created sessions...');
  const monitorRes = await fetch(`${BASE_URL}/api/students/live-monitor?class=VII-A`, {
    headers: authHeaders
  });
  const monitorData = await monitorRes.json();
  const foundSessions = monitorData.data.sessions.filter(s => sessionIds.includes(s.sessionId));
  if (foundSessions.length !== 3) {
    throw new Error(`Expected 3 sessions, found ${foundSessions.length}`);
  }
  console.log('✅ Confirmed 3 sessions active in Live Monitor.');

  // 4. Test Single Live Session Delete
  console.log(`4. Testing single session delete on ${sessionIds[0]}...`);
  const singleDeleteRes = await fetch(`${BASE_URL}/api/students/live-monitor/${encodeURIComponent(sessionIds[0])}`, {
    method: 'DELETE',
    headers: authHeaders
  });
  const singleDeleteData = await singleDeleteRes.json();
  if (singleDeleteData.status !== 'success') {
    throw new Error('Single delete failed: ' + JSON.stringify(singleDeleteData));
  }
  console.log('✅ Single delete succeeded:', singleDeleteData.message);

  // 5. Test Bulk Delete Validation
  console.log('5. Testing bulk delete validation on empty payload...');
  const emptyRes = await fetch(`${BASE_URL}/api/students/live-monitor/bulk-delete`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ sessionIds: [] })
  });
  if (emptyRes.status !== 400) {
    throw new Error(`Expected 400 for empty sessionIds, got ${emptyRes.status}`);
  }
  console.log('✅ Empty payload correctly rejected with 400 Bad Request.');

  // 6. Test Bulk Delete for Remaining 2 Sessions
  console.log(`6. Executing bulk delete for remaining sessions: ${sessionIds.slice(1).join(', ')}...`);
  const bulkRes = await fetch(`${BASE_URL}/api/students/live-monitor/bulk-delete`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ sessionIds: sessionIds.slice(1) })
  });
  const bulkData = await bulkRes.json();
  if (bulkData.status !== 'success' || bulkData.deletedCount !== 2) {
    throw new Error('Bulk delete failed: ' + JSON.stringify(bulkData));
  }
  console.log(`✅ Bulk delete succeeded: ${bulkData.message} (deletedCount: ${bulkData.deletedCount})`);

  // 7. Verify All Test Sessions Are Removed
  console.log('7. Verifying all test sessions removed from Live Monitor...');
  const finalMonitorRes = await fetch(`${BASE_URL}/api/students/live-monitor?class=VII-A`, {
    headers: authHeaders
  });
  const finalMonitorData = await finalMonitorRes.json();
  const remaining = finalMonitorData.data.sessions.filter(s => sessionIds.includes(s.sessionId));
  if (remaining.length > 0) {
    throw new Error(`Test sessions still remain: ${JSON.stringify(remaining)}`);
  }
  console.log('✅ Confirmed 0 remaining test sessions in Live Monitor.');

  // 8. Verify UI Markup & Handlers
  console.log('8. Verifying HTML & JS markup for Live Monitor selection...');
  const fs = require('fs');
  const html = fs.readFileSync('src/views/guru-dashboard.html', 'utf8');
  if (!html.includes('id="live-select-all"')) {
    throw new Error('Missing #live-select-all in guru-dashboard.html');
  }
  if (!html.includes('id="live-bulk-actions"')) {
    throw new Error('Missing #live-bulk-actions in guru-dashboard.html');
  }
  if (!html.includes('id="live-selected-count"')) {
    throw new Error('Missing #live-selected-count in guru-dashboard.html');
  }

  const js = fs.readFileSync('public/js/guru.js', 'utf8');
  if (!js.includes('live-item-checkbox')) {
    throw new Error('Missing live-item-checkbox in guru.js');
  }
  if (!js.includes('toggleSelectAllLive')) {
    throw new Error('Missing toggleSelectAllLive in guru.js');
  }
  if (!js.includes('handleBulkDeleteLiveSessions')) {
    throw new Error('Missing handleBulkDeleteLiveSessions in guru.js');
  }
  if (!js.includes('handleDeleteSingleLiveSession')) {
    throw new Error('Missing handleDeleteSingleLiveSession in guru.js');
  }
  console.log('✅ UI markup and handlers verified.');

  console.log('\n🎉 ALL LIVE MONITOR BULK SELECTION & DELETE TESTS PASSED 100%!');
}

run().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
