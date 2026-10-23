const http = require('http');

function get(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:3090${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', reject);
  });
}

async function run() {
  console.log('--- TESTING PRINT LAYOUT AND STYLES ---');
  let passed = 0;
  let failed = 0;

  // 1. Fetch Student Portal HTML
  try {
    const res = await get('/');
    if (res.status === 200) {
      console.log('✓ [PASS] GET / returned HTTP 200');
      passed++;

      // Check header has no-print
      if (res.body.includes('<header class="border-b border-atelier-border bg-white/80 backdrop-blur-md sticky top-0 z-30 no-print">')) {
        console.log('✓ [PASS] Main sticky header has "no-print" class');
        passed++;
      } else {
        console.error('✗ [FAIL] Main header missing "no-print"');
        failed++;
      }

      // Check printable-art-card exists
      if (res.body.includes('id="printable-art-card"')) {
        console.log('✓ [PASS] id="printable-art-card" present');
        passed++;
      } else {
        console.error('✗ [FAIL] printable-art-card missing');
        failed++;
      }

      // Check print-only kop exists
      if (res.body.includes('KARTU PROFIL SENIMAN MUDA (STUDENT ART PROFILE)')) {
        console.log('✓ [PASS] Official print header (KOP) present');
        passed++;
      } else {
        console.error('✗ [FAIL] Print header missing');
        failed++;
      }

      // Check print-only signature block exists
      if (res.body.includes('signature-block') && res.body.includes('Guru Mata Pelajaran Seni Rupa')) {
        console.log('✓ [PASS] Official print signature block present');
        passed++;
      } else {
        console.error('✗ [FAIL] Signature block missing');
        failed++;
      }

      // Check action buttons have no-print
      if (res.body.includes('class="flex flex-wrap gap-3 pt-2 no-print"')) {
        console.log('✓ [PASS] Action buttons have "no-print" class');
        passed++;
      } else {
        console.error('✗ [FAIL] Action buttons missing "no-print"');
        failed++;
      }

      // Check footer has no-print
      if (res.body.includes('text-xs text-atelier-inkMuted no-print">')) {
        console.log('✓ [PASS] Footer has "no-print" class');
        passed++;
      } else {
        console.error('✗ [FAIL] Footer missing "no-print"');
        failed++;
      }
    } else {
      console.error('✗ [FAIL] GET / returned status:', res.status);
      failed++;
    }
  } catch (e) {
    console.error('✗ [FAIL] Error fetching /:', e.message);
    failed++;
  }

  // 2. Fetch CSS and verify print rules
  try {
    const cssRes = await get('/css/style.css');
    if (cssRes.status === 200) {
      console.log('✓ [PASS] GET /css/style.css returned HTTP 200');
      passed++;

      if (cssRes.body.includes('@media print') && cssRes.body.includes('size: A4 portrait')) {
        console.log('✓ [PASS] @media print includes A4 portrait page definition');
        passed++;
      } else {
        console.error('✗ [FAIL] Missing A4 portrait in @media print');
        failed++;
      }

      if (cssRes.body.includes('break-inside: avoid !important') && cssRes.body.includes('#card-matrix-grid')) {
        console.log('✓ [PASS] @media print includes break-inside: avoid for matrix cards');
        passed++;
      } else {
        console.error('✗ [FAIL] Missing break-inside: avoid for matrix cards');
        failed++;
      }

      if (cssRes.body.includes('-webkit-print-color-adjust: exact !important')) {
        console.log('✓ [PASS] @media print enforces exact print color adjust');
        passed++;
      } else {
        console.error('✗ [FAIL] Missing print-color-adjust');
        failed++;
      }
    } else {
      console.error('✗ [FAIL] Error fetching /css/style.css:', cssRes.status);
      failed++;
    }
  } catch (e) {
    console.error('✗ [FAIL] Error checking css:', e.message);
    failed++;
  }

  console.log(`\n--- RESULT: ${passed} PASSED, ${failed} FAILED ---`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
