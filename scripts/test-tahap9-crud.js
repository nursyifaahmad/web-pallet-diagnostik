const http = require('http');
const fs = require('fs');
const path = require('path');

console.log('--- STARTING TAHAP 9: PORTFOLIO FULL CRUD VERIFICATION TEST ---');

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
const apiJs = fs.readFileSync(path.join(__dirname, '../public/js/api.js'), 'utf-8');

assert(html.includes('id="modal-portfolio"'), 'Modal id="modal-portfolio" present in HTML');
assert(html.includes('id="form-portfolio"'), 'Form id="form-portfolio" present in HTML');
assert(html.includes('id="form-p-title"'), 'Input id="form-p-title" present in HTML');
assert(html.includes('id="form-p-category"'), 'Select id="form-p-category" present in HTML');
assert(html.includes('openAddPortfolioModal'), 'openAddPortfolioModal wired in HTML');
assert(html.includes('openEditPortfolioModal'), 'openEditPortfolioModal wired in HTML');
assert(html.includes('deletePortfolioItem'), 'deletePortfolioItem wired in HTML');

assert(js.includes('function loadClassPortfolios'), 'loadClassPortfolios exists in guru.js');
assert(js.includes('function openAddPortfolioModal'), 'openAddPortfolioModal exists in guru.js');
assert(js.includes('function openEditPortfolioModal'), 'openEditPortfolioModal exists in guru.js');
assert(js.includes('function submitPortfolioForm'), 'submitPortfolioForm exists in guru.js');
assert(js.includes('function deletePortfolioItem'), 'deletePortfolioItem exists in guru.js');

assert(apiJs.includes('getPortfolios'), 'API.getPortfolios exists in api.js');
assert(apiJs.includes('createPortfolio'), 'API.createPortfolio exists in api.js');
assert(apiJs.includes('updatePortfolio'), 'API.updatePortfolio exists in api.js');
assert(apiJs.includes('deletePortfolio'), 'API.deletePortfolio exists in api.js');

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

async function runCrudTest() {
  try {
    // A. Teacher Login
    const loginRes = await request({
      hostname: 'localhost',
      port: 3090,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { username: 'guru', password: 'guru123' });

    assert(loginRes.status === 200 && loginRes.data.token, 'Teacher login successful');
    const token = loginRes.data.token;
    const authHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };

    // B. READ (Initial List)
    const listRes1 = await request({
      hostname: 'localhost',
      port: 3090,
      path: '/api/portfolio/VII-A',
      method: 'GET',
      headers: authHeaders
    });
    assert(listRes1.status === 200 && Array.isArray(listRes1.data.data), 'GET /api/portfolio/VII-A returned 200 and array');
    const initialCount = listRes1.data.data.length;

    // C. CREATE (POST)
    const createRes = await request({
      hostname: 'localhost',
      port: 3090,
      path: '/api/portfolio',
      method: 'POST',
      headers: authHeaders
    }, {
      class_id: 'VII-A',
      title: 'Patung Tanah Liat Fauna Nusantara',
      category: 'KARYA 3D PATUNG',
      student_name: 'Dewi Anjani',
      score: 92,
      semester: 'Semester Ganjil',
      notes: 'Bentuk plastis dinamis dan sangat proporsional.'
    });

    assert(createRes.status === 201 && createRes.data.data?.id, 'POST /api/portfolio successfully created item');
    const newId = createRes.data.data.id;
    assert(createRes.data.data.title === 'Patung Tanah Liat Fauna Nusantara', 'Created item title matches');
    assert(createRes.data.data.score === 92, 'Created item score matches');

    // D. UPDATE (PUT)
    const updateRes = await request({
      hostname: 'localhost',
      port: 3090,
      path: `/api/portfolio/${newId}`,
      method: 'PUT',
      headers: authHeaders
    }, {
      title: 'Patung Tanah Liat Fauna Nusantara (Revisi)',
      score: 96,
      notes: 'Finishing cat dan detail tekstur bulu disempurnakan.'
    });

    assert(updateRes.status === 200 && updateRes.data.status === 'success', `PUT /api/portfolio/${newId} returned 200`);
    assert(updateRes.data.data.title === 'Patung Tanah Liat Fauna Nusantara (Revisi)', 'Updated title matches');
    assert(updateRes.data.data.score === 96, 'Updated score is 96');

    // E. DELETE (DELETE)
    const deleteRes = await request({
      hostname: 'localhost',
      port: 3090,
      path: `/api/portfolio/${newId}`,
      method: 'DELETE',
      headers: authHeaders
    });

    assert(deleteRes.status === 200 && deleteRes.data.status === 'success', `DELETE /api/portfolio/${newId} returned 200`);

    // F. VERIFY DELETION
    const listRes2 = await request({
      hostname: 'localhost',
      port: 3090,
      path: '/api/portfolio/VII-A',
      method: 'GET',
      headers: authHeaders
    });

    const found = listRes2.data.data.some(p => p.id === newId);
    assert(!found, 'Deleted item no longer present in portfolio list');
    assert(listRes2.data.data.length === initialCount, 'Portfolio list count returned to initial');

    console.log(`\n--- RESULT: ${passed} PASSED, ${failed} FAILED ---`);
    if (failed > 0) process.exit(1);
    process.exit(0);
  } catch (err) {
    console.error('Test error:', err);
    process.exit(1);
  }
}

runCrudTest();
