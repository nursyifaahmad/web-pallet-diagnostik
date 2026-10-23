const http = require('http');
const fs = require('fs');
const path = require('path');

console.log('--- STARTING TAHAP 9: PORTOFOLIO & LOG PERKEMBANGAN VERIFICATION TEST ---');

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

assert(html.includes('TAHAP 9: PORTOFOLIO &amp; LOG PERKEMBANGAN') || html.includes('TAHAP 9: PORTOFOLIO & LOG PERKEMBANGAN'), 'Tag pill "TAHAP 9: PORTOFOLIO & LOG PERKEMBANGAN" present in HTML');
assert(html.includes('Rekam Jejak Karya Siswa Sepanjang Semester'), 'Title "Rekam Jejak Karya Siswa Sepanjang Semester" present in HTML');
assert(html.includes('[ KARYA 2D DRAWING ]'), 'Label "[ KARYA 2D DRAWING ]" present in HTML');
assert(html.includes('Eksplorasi Sketsa Karakter'), 'Title "Eksplorasi Sketsa Karakter" present in HTML');
assert(html.includes('Nilai: 88 · Semester Ganjil'), 'Meta "Nilai: 88 · Semester Ganjil" present in HTML');
assert(html.includes('[ KARYA 3D KRIYA ]'), 'Label "[ KARYA 3D KRIYA ]" present in HTML');
assert(html.includes('Miniatur Kerajinan Clay Fauna'), 'Title "Miniatur Kerajinan Clay Fauna" present in HTML');
assert(html.includes('Nilai: 85 · Semester Ganjil'), 'Meta "Nilai: 85 · Semester Ganjil" present in HTML');
assert(html.includes('Unggah Dokumen Karya'), 'Action "Unggah Dokumen Karya" present in HTML');
assert(html.includes('JPG, PNG, atau PDF'), 'Format description "JPG, PNG, atau PDF" present in HTML');
assert(html.includes('id="portfolio-file-input"'), 'Input id="portfolio-file-input" present in HTML');
assert(html.includes('id="portfolio-cards-container"'), 'Container id="portfolio-cards-container" present in HTML');

// Live monitor elements intact
assert(html.includes('id="live-active-count"'), 'id="live-active-count" preserved');
assert(html.includes('id="live-completed-count"'), 'id="live-completed-count" preserved');
assert(html.includes('id="live-avg-progress"'), 'id="live-avg-progress" preserved');
assert(html.includes('id="live-table-body"'), 'id="live-table-body" preserved');
assert(html.includes('whitespace-nowrap'), 'whitespace-nowrap on table headers preserved');
assert(html.includes('min-width: 150px'), 'min-width: 150px on status th preserved');

assert(js.includes('function triggerPortfolioUpload'), 'triggerPortfolioUpload function exists in guru.js');
assert(js.includes('function handlePortfolioUpload'), 'handlePortfolioUpload function exists in guru.js');
assert(js.includes('function fetchLiveMonitorData'), 'fetchLiveMonitorData function exists in guru.js');

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
    assert(dashRes.data.includes('Rekam Jejak Karya Siswa Sepanjang Semester'), 'Server serves updated Tahap 9 view with Rekam Jejak Karya');
    assert(dashRes.data.includes('TAHAP 9: PORTOFOLIO'), 'Server serves updated Tahap 9 view with pill badge');

    console.log(`\n--- RESULT: ${passed} PASSED, ${failed} FAILED ---`);
    if (failed > 0) process.exit(1);
    process.exit(0);
  } catch (err) {
    console.error('Test error:', err);
    process.exit(1);
  }
}

runHttpTest();
