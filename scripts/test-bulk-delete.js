/**
 * scripts/test-bulk-delete.js
 * Comprehensive unit test for Bulk Selection & Bulk Deletion of students in Teacher Dashboard.
 */

const BASE_URL = 'http://localhost:3090';

async function run() {
  console.log('🧪 Starting Bulk Selection & Bulk Delete Verification...');

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

  // 2. Create 3 Test Students in VII-C
  console.log('2. Creating 3 test students in VII-C...');
  const studentIds = [];
  const testNames = ['Test Bulk Siswa A', 'Test Bulk Siswa B', 'Test Bulk Siswa C'];

  for (let i = 0; i < 3; i++) {
    const createRes = await fetch(`${BASE_URL}/api/students`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        attendance_no: 90 + i,
        name: testNames[i],
        gender: i % 2 === 0 ? 'L' : 'P',
        class_id: 'VII-C',
        category: '2D',
        sub_option: 'Cat Poster',
        style: 'Visual Tutorial',
        challenge: 'Sketsa Proporsi',
        feeling: 'Senang & Percaya Diri'
      })
    });
    const createData = await createRes.json();
    if (createData.status !== 'success' || !createData.data?.id) {
      throw new Error(`Failed to create student ${testNames[i]}: ` + JSON.stringify(createData));
    }
    studentIds.push(createData.data.id);
  }
  console.log(`✅ 3 test students created with IDs: ${studentIds.join(', ')}`);

  // 3. Read VII-C roster and verify presence
  console.log('3. Reading VII-C roster...');
  const rosterRes = await fetch(`${BASE_URL}/api/classes/VII-C`, {
    headers: authHeaders
  });
  const rosterData = await rosterRes.json();
  const createdStudents = rosterData.data.students.filter(s => studentIds.includes(s.id));
  if (createdStudents.length !== 3) {
    throw new Error(`Expected 3 created students in roster, found ${createdStudents.length}`);
  }
  console.log('✅ All 3 students confirmed in VII-C roster.');

  // 4. Test Bulk Delete API with invalid payload
  console.log('4. Testing validation on invalid bulk delete payloads...');
  const emptyRes = await fetch(`${BASE_URL}/api/students/bulk-delete`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ ids: [] })
  });
  if (emptyRes.status !== 400) {
    throw new Error(`Expected 400 for empty IDs, got ${emptyRes.status}`);
  }
  console.log('✅ Empty IDs correctly rejected with 400 Bad Request.');

  // 5. Execute Bulk Delete
  console.log(`5. Executing bulk delete for IDs: ${studentIds.join(', ')}...`);
  const bulkRes = await fetch(`${BASE_URL}/api/students/bulk-delete`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ ids: studentIds })
  });
  const bulkData = await bulkRes.json();
  if (bulkData.status !== 'success' || bulkData.deletedCount !== 3) {
    throw new Error('Bulk delete failed: ' + JSON.stringify(bulkData));
  }
  console.log(`✅ Bulk delete succeeded: ${bulkData.message} (deletedCount: ${bulkData.deletedCount})`);

  // 6. Verify Deletion in VII-C roster
  console.log('6. Verifying students deletion from VII-C roster...');
  const verifyRes = await fetch(`${BASE_URL}/api/classes/VII-C`, {
    headers: authHeaders
  });
  const verifyData = await verifyRes.json();
  const remainingStudents = verifyData.data.students.filter(s => studentIds.includes(s.id));
  if (remainingStudents.length > 0) {
    throw new Error(`Deleted students still present in roster: ${JSON.stringify(remainingStudents)}`);
  }
  console.log('✅ Confirmed 0 remaining test students in VII-C roster.');

  // 7. Check UI Markup in guru-dashboard.html & guru.js
  console.log('7. Verifying UI markup and helper functions...');
  const fs = require('fs');
  const htmlContent = fs.readFileSync('src/views/guru-dashboard.html', 'utf8');
  if (!htmlContent.includes('id="roster-select-all"')) {
    throw new Error('Missing #roster-select-all in guru-dashboard.html');
  }
  if (!htmlContent.includes('id="roster-bulk-actions"')) {
    throw new Error('Missing #roster-bulk-actions in guru-dashboard.html');
  }
  if (!htmlContent.includes('id="roster-selected-count"')) {
    throw new Error('Missing #roster-selected-count in guru-dashboard.html');
  }

  const jsContent = fs.readFileSync('public/js/guru.js', 'utf8');
  if (!jsContent.includes('roster-item-checkbox')) {
    throw new Error('Missing roster-item-checkbox in guru.js');
  }
  if (!jsContent.includes('toggleSelectAllRoster')) {
    throw new Error('Missing toggleSelectAllRoster in guru.js');
  }
  if (!jsContent.includes('updateRosterSelection')) {
    throw new Error('Missing updateRosterSelection in guru.js');
  }
  if (!jsContent.includes('handleBulkDeleteStudents')) {
    throw new Error('Missing handleBulkDeleteStudents in guru.js');
  }
  console.log('✅ UI elements and JavaScript handlers verified.');

  console.log('\n🎉 ALL BULK SELECTION & BULK DELETE TESTS PASSED 100%!');
}

run().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
