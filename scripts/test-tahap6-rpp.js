const http = require('http');
const fs = require('fs');
const path = require('path');

console.log('--- STARTING TAHAP 6: RPP GENERATOR VERIFICATION TEST ---');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✓ [PASS] ${message}`);
    passed++;
  } else {
    console.error(`✗ [FAIL] ${message}`);
    failed++;
  }
}

// 1. Static HTML & JS checks
const html = fs.readFileSync(path.join(__dirname, '../src/views/guru-dashboard.html'), 'utf-8');
const js = fs.readFileSync(path.join(__dirname, '../public/js/guru.js'), 'utf-8');

assert(html.includes('TAHAP 6: MODUL AJAR KURIKULUM MERDEKA'), 'Tag pill "TAHAP 6: MODUL AJAR KURIKULUM MERDEKA" present in HTML');
assert(html.includes('Generator Modul Ajar Seni Rupa Berdiferensiasi'), 'Title "Generator Modul Ajar Seni Rupa Berdiferensiasi" present in HTML');
assert(html.includes('id="rpp-topic-input"'), 'Input id="rpp-topic-input" present in HTML');
assert(html.includes('id="rpp-target-time-input"'), 'Input id="rpp-target-time-input" present in HTML');
assert(html.includes('id="btn-generate-rpp"'), 'Button id="btn-generate-rpp" present in HTML');
assert(html.includes('id="btn-print-rpp"'), 'Button id="btn-print-rpp" present in HTML');
assert(html.includes('id="modul-ajar-document"'), 'Container id="modul-ajar-document" present in HTML');
assert(html.includes('// Klik "Generate Modul Ajar Otomatis" untuk menyusun modul RPP berdiferensiasi.'), 'Initial placeholder comment present in HTML');

assert(js.includes('function triggerGenerateModulAjar'), 'triggerGenerateModulAjar function exists in guru.js');
assert(js.includes('function printModulAjar'), 'printModulAjar function exists in guru.js');
assert(js.includes('function generateModulAjarText'), 'generateModulAjarText function exists in guru.js');
assert(js.includes('rpp-topic-input'), 'guru.js references rpp-topic-input');
assert(js.includes('rpp-target-time-input'), 'guru.js references rpp-target-time-input');

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

async function runHttpTest() {
  try {
    const loginRes = await request({
      hostname: 'localhost',
      port: 3090,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { username: 'guru', password: 'guru123' });

    assert(loginRes.status === 200 && loginRes.data.token, 'Teacher login successful');
    const token = loginRes.data.token;

    const dashRes = await request({
      hostname: 'localhost',
      port: 3090,
      path: '/guru',
      method: 'GET',
      headers: { 'Cookie': `pallet_token=${token}` }
    });

    assert(dashRes.status === 200, 'GET /guru with auth cookie returned 200 OK');
    assert(dashRes.data.includes('Generator Modul Ajar Seni Rupa Berdiferensiasi'), 'Server serves updated Tahap 6 view with Generator Modul Ajar');
    assert(dashRes.data.includes('TAHAP 6: MODUL AJAR KURIKULUM MERDEKA'), 'Server serves updated Tahap 6 view with pill badge');

    console.log(`\n--- RESULT: ${passed} PASSED, ${failed} FAILED ---`);
    if (failed > 0) process.exit(1);
    process.exit(0);
  } catch (err) {
    console.error('Test error:', err);
    process.exit(1);
  }
}

runHttpTest();
