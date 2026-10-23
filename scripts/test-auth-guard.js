// Automated Test for Teacher Route Protection Guard
require('../src/server'); // Starts Express server
const http = require('http');

const BASE_URL = 'http://127.0.0.1:3090';

function makeRequest(urlPath, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE_URL);
    const reqOptions = {
      method: options.method || 'GET',
      headers: options.headers || {},
    };

    const req = http.request(url, reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

setTimeout(async () => {
  console.log('--- STARTING TEACHER PORTAL AUTH GUARD VERIFICATION ---');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  try {
    // 1. Unauthenticated GET /guru should redirect to /login/guru
    console.log('\n1. Testing unauthenticated access to /guru...');
    const resGuru = await makeRequest('/guru');
    assert(resGuru.statusCode === 302, `GET /guru returned HTTP ${resGuru.statusCode} (Expected 302 Redirect)`);
    assert(resGuru.headers.location === '/login/guru', `Redirect location is ${resGuru.headers.location} (Expected /login/guru)`);

    // 2. Unauthenticated GET /guru/ should redirect to /login/guru
    console.log('\n2. Testing unauthenticated access to /guru/...');
    const resGuruSlash = await makeRequest('/guru/');
    assert(resGuruSlash.statusCode === 302, `GET /guru/ returned HTTP ${resGuruSlash.statusCode} (Expected 302 Redirect)`);
    assert(resGuruSlash.headers.location === '/login/guru', `Redirect location is ${resGuruSlash.headers.location} (Expected /login/guru)`);

    // 3. Unauthenticated GET /guru/index.html should redirect to /login/guru
    console.log('\n3. Testing unauthenticated access to /guru/index.html...');
    const resGuruIndex = await makeRequest('/guru/index.html');
    assert(resGuruIndex.statusCode === 302, `GET /guru/index.html returned HTTP ${resGuruIndex.statusCode} (Expected 302 Redirect)`);
    assert(resGuruIndex.headers.location === '/login/guru', `Redirect location is ${resGuruIndex.headers.location} (Expected /login/guru)`);

    // 4. GET /login/guru should return 200 OK
    console.log('\n4. Testing access to /login/guru...');
    const resLogin = await makeRequest('/login/guru');
    assert(resLogin.statusCode === 200, `GET /login/guru returned HTTP ${resLogin.statusCode} (Expected 200)`);
    assert(resLogin.body.includes('PALLET Studio Guru'), 'Response contains login title');

    // 5. GET / (Student portal) should remain accessible without login
    console.log('\n5. Testing access to Student portal /...');
    const resRoot = await makeRequest('/');
    assert(resRoot.statusCode === 200, `GET / returned HTTP ${resRoot.statusCode} (Expected 200)`);
    assert(resRoot.body.includes('Asesmen Diagnostik Seni Rupa'), 'Student portal renders correctly');

    // 6. Test Teacher Login
    console.log('\n6. Testing Login API with teacher credentials (guru / guru123)...');
    const resAuth = await makeRequest('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { username: 'guru', password: 'guru123' }
    });
    assert(resAuth.statusCode === 200, `POST /api/auth/login returned HTTP ${resAuth.statusCode} (Expected 200)`);
    const authData = JSON.parse(resAuth.body);
    assert(authData.status === 'success' && !!authData.token, 'Auth returns valid token');
    const teacherToken = authData.token;
    const cookieHeader = resAuth.headers['set-cookie'];
    assert(cookieHeader && cookieHeader.some(c => c.includes('pallet_token=')), 'Set-Cookie header includes pallet_token');

    // Extract cookie value
    const palletCookie = cookieHeader ? cookieHeader.find(c => c.includes('pallet_token=')).split(';')[0] : '';

    // 7. Authenticated GET /guru WITH cookie
    console.log('\n7. Testing access to /guru WITH pallet_token cookie...');
    const resGuruAuthedCookie = await makeRequest('/guru', {
      headers: { 'Cookie': palletCookie }
    });
    assert(resGuruAuthedCookie.statusCode === 200, `GET /guru with cookie returned HTTP ${resGuruAuthedCookie.statusCode} (Expected 200)`);
    assert(resGuruAuthedCookie.body.includes('PALLET Studio Guru'), 'Dashboard HTML served successfully to authenticated teacher');

    // 8. Authenticated GET /guru WITH Bearer token
    console.log('\n8. Testing access to /guru WITH Bearer token header...');
    const resGuruAuthedHeader = await makeRequest('/guru', {
      headers: { 'Authorization': `Bearer ${teacherToken}` }
    });
    assert(resGuruAuthedHeader.statusCode === 200, `GET /guru with header returned HTTP ${resGuruAuthedHeader.statusCode} (Expected 200)`);
    assert(resGuruAuthedHeader.body.includes('PALLET Studio Guru'), 'Dashboard HTML served successfully via Bearer token');

    // 9. When authenticated, visiting /login/guru redirects to /guru
    console.log('\n9. Testing /login/guru when already authenticated...');
    const resLoginRedirect = await makeRequest('/login/guru', {
      headers: { 'Cookie': palletCookie }
    });
    assert(resLoginRedirect.statusCode === 302, `GET /login/guru when logged in returned HTTP ${resLoginRedirect.statusCode} (Expected 302)`);
    assert(resLoginRedirect.headers.location === '/guru', `Redirects to ${resLoginRedirect.headers.location} (Expected /guru)`);

    console.log(`\n========================================`);
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log(`========================================\n`);

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Test execution failed with error:', err);
    process.exit(1);
  }
}, 500);
