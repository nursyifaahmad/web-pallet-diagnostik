try { require('../src/server'); } catch(e) {}
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
  console.log('--- STARTING RUBRIC & NAVIGATION FEATURES TEST ---');
  let passed = 0;
  let failed = 0;

  // 1. Login to get token
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
      console.log('✓ [PASS] Teacher login succeeded, got JWT token');
      passed++;
    } else {
      console.error('✗ [FAIL] Teacher login failed:', loginRes);
      failed++;
    }
  } catch (err) {
    console.error('✗ [FAIL] Teacher login threw error:', err.message);
    failed++;
  }

  // 2. Test GET /api/rubric/class/VII-A
  try {
    const rubricRes = await request({
      hostname: 'localhost',
      port: 3090,
      path: '/api/rubric/class/VII-A',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (rubricRes.status === 200 && rubricRes.data.status === 'success' && Array.isArray(rubricRes.data.data)) {
      console.log(`✓ [PASS] GET /api/rubric/class/VII-A returned 200 with ${rubricRes.data.data.length} student rubric records`);
      passed++;
    } else {
      console.error('✗ [FAIL] GET /api/rubric/class/VII-A failed:', rubricRes);
      failed++;
    }
  } catch (err) {
    console.error('✗ [FAIL] GET /api/rubric/class/VII-A error:', err.message);
    failed++;
  }

  // 3. Test POST /api/rubric (upsert score)
  try {
    // First get a student ID in VII-A
    const classRes = await request({
      hostname: 'localhost',
      port: 3090,
      path: '/api/classes/VII-A',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const students = classRes.data?.data?.students || [];
    if (students.length > 0) {
      const student = students[0];
      const saveRes = await request({
        hostname: 'localhost',
        port: 3090,
        path: '/api/rubric',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }, {
        student_id: student.id,
        process_score: 85,
        product_score: 90,
        total_score: 88,
        predicate: 'Sangat Mahir (Istimewa)',
        notes: 'Eksplorasi warna sangat harmonis dan sketsa proporsional.'
      });

      if (saveRes.status === 200 && saveRes.data.status === 'success') {
        console.log(`✓ [PASS] POST /api/rubric successfully saved rubric for student ${student.name} (id: ${student.id})`);
        passed++;
      } else {
        console.error('✗ [FAIL] POST /api/rubric failed:', saveRes);
        failed++;
      }
    } else {
      console.log('ℹ [SKIP] No students in VII-A to test POST /api/rubric');
    }
  } catch (err) {
    console.error('✗ [FAIL] POST /api/rubric error:', err.message);
    failed++;
  }

  // 4. Test Multi-sheet Excel export with ?type=rubric
  try {
    const excelRes = await request({
      hostname: 'localhost',
      port: 3090,
      path: '/api/export/excel?class=VII-A&type=rubric',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (excelRes.status === 200 && excelRes.headers['content-type']?.includes('spreadsheetml')) {
      console.log('✓ [PASS] GET /api/export/excel?class=VII-A&type=rubric returned 200 with Excel content-type');
      passed++;
    } else {
      console.error('✗ [FAIL] Excel export failed:', excelRes.status, excelRes.headers);
      failed++;
    }
  } catch (err) {
    console.error('✗ [FAIL] Excel export error:', err.message);
    failed++;
  }

  // 5. Test Calendar with Custom Category
  try {
    const calRes = await request({
      hostname: 'localhost',
      port: 3090,
      path: '/api/calendar',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }, {
      title: 'Workshop Pembuatan Kertas Daur Ulang',
      event_date: '2026-11-15',
      type: 'Workshop Daur Ulang',
      class_id: 'VII-A'
    });

    if (calRes.status === 200 && calRes.data.status === 'success') {
      console.log('✓ [PASS] POST /api/calendar with custom category "Workshop Daur Ulang" succeeded');
      passed++;

      // Verify it appears in GET /api/calendar
      const listRes = await request({
        hostname: 'localhost',
        port: 3090,
        path: '/api/calendar',
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const found = listRes.data?.data?.find(ev => ev.type === 'Workshop Daur Ulang');
      if (found) {
        console.log(`✓ [PASS] Custom calendar category verified in event list (ID: ${found.id})`);
        passed++;
      } else {
        console.error('✗ [FAIL] Custom category not found in calendar list');
        failed++;
      }
    } else {
      console.error('✗ [FAIL] POST /api/calendar failed:', calRes);
      failed++;
    }
  } catch (err) {
    console.error('✗ [FAIL] Calendar test error:', err.message);
    failed++;
  }

  console.log(`\n--- TEST RESULTS: ${passed} PASSED, ${failed} FAILED ---`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
