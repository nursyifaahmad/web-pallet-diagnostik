// Automated Verification for Required Diagnostic Questions
require('../src/server');
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
  console.log('--- STARTING REQUIRED DIAGNOSTIC QUESTIONS VERIFICATION ---');
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
    // 1. Fetch active questions from API
    console.log('\n1. Fetching active diagnostic questions...');
    const qRes = await makeRequest('/api/questions');
    assert(qRes.statusCode === 200, `GET /api/questions returned HTTP ${qRes.statusCode}`);
    const qData = JSON.parse(qRes.body);
    const questions = qData.data;
    assert(questions.length > 0, `Loaded ${questions.length} active questions`);

    // 2. Test submitting without ANY answers
    console.log('\n2. Testing student submission with NO answers...');
    const emptySub = await makeRequest('/api/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        sessionId: 'sess_req_test_1',
        name: 'Budi Santoso',
        attendance_no: 5,
        gender: 'L',
        class_id: 'VII-B',
        answers: {}
      }
    });
    assert(emptySub.statusCode === 400, `Empty answers rejected with HTTP ${emptySub.statusCode} (Expected 400)`);
    const emptyJson = JSON.parse(emptySub.body);
    assert(emptyJson.status === 'error' && emptyJson.message.includes('wajib dijawab'), `Error message indicates required question: "${emptyJson.message}"`);

    // 3. Test submitting with partial answers (only Question 1 answered)
    console.log('\n3. Testing student submission with partial answers...');
    const partialSub = await makeRequest('/api/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        sessionId: 'sess_req_test_2',
        name: 'Siti Aminah',
        attendance_no: 12,
        gender: 'P',
        class_id: 'VII-B',
        answers: {
          [questions[0].id]: { selected: 'Sangat senang & antusias' }
        }
      }
    });
    assert(partialSub.statusCode === 400, `Partial answers rejected with HTTP ${partialSub.statusCode} (Expected 400)`);
    const partialJson = JSON.parse(partialSub.body);
    assert(partialJson.status === 'error' && partialJson.message.includes('wajib'), `Error message highlights missing question: "${partialJson.message}"`);

    // 4. Test submitting with Question 2 missing sub-option
    console.log('\n4. Testing submission where media question is missing sub-option...');
    const mediaQ = questions.find(q => q.isMediaSelector);
    if (mediaQ) {
      const answersMissingMediaSub = {};
      questions.forEach(q => {
        if (q.id === mediaQ.id) {
          answersMissingMediaSub[q.id] = { category: '2D', reason: 'Alasan media' }; // missing subOption!
        } else {
          answersMissingMediaSub[q.id] = { selected: q.options[0] || 'Opsi 1', reason: 'Alasan belajar' };
        }
      });
      const mediaMissingSub = await makeRequest('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          sessionId: 'sess_req_test_3',
          name: 'Doni Pratama',
          attendance_no: 8,
          gender: 'L',
          class_id: 'VII-B',
          answers: answersMissingMediaSub
        }
      });
      assert(mediaMissingSub.statusCode === 400, `Missing media sub-option rejected with HTTP ${mediaMissingSub.statusCode} (Expected 400)`);
      const mediaJson = JSON.parse(mediaMissingSub.body);
      assert(mediaJson.message.includes('spesifikasi media'), `Error message mentions media specification: "${mediaJson.message}"`);
    }

    // 5. Test submitting with choices answered but missing essay/reason field
    console.log('\n5. Testing submission where choices are answered but essay/reason is empty...');
    const answersMissingReason = {};
    questions.forEach((q, idx) => {
      if (q.isMediaSelector) {
        answersMissingReason[q.id] = { category: '2D', subOption: 'Media Kering', reason: idx === 0 ? '' : 'Alasan' };
      } else {
        // Leave the first question reason empty
        answersMissingReason[q.id] = { selected: q.options[0] || 'Opsi 1', reason: idx === 0 ? '' : 'Alasan belajar' };
      }
    });

    const missingReasonSub = await makeRequest('/api/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        sessionId: 'sess_req_test_no_reason',
        name: 'Rudi Hartono',
        attendance_no: 19,
        gender: 'L',
        class_id: 'VII-B',
        answers: answersMissingReason
      }
    });
    assert(missingReasonSub.statusCode === 400, `Empty essay/reason field rejected with HTTP ${missingReasonSub.statusCode} (Expected 400)`);
    const reasonJson = JSON.parse(missingReasonSub.body);
    assert(reasonJson.status === 'error' && reasonJson.message.includes('esai'), `Error message mentions required essay: "${reasonJson.message}"`);

    // 6. Test complete submission with all questions and essay fields answered
    console.log('\n6. Testing complete student submission with ALL questions and essay fields answered...');
    const completeAnswers = {};
    questions.forEach(q => {
      if (q.isMediaSelector) {
        completeAnswers[q.id] = { category: '2D', subOption: 'Media Basah', reason: 'Suka melukis cat air' };
      } else {
        completeAnswers[q.id] = { selected: q.options[0] || 'Opsi 1', reason: 'Alasan belajar seni rupa' };
      }
    });

    const completeSub = await makeRequest('/api/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        sessionId: 'sess_req_test_complete',
        attendance_no: 25,
        name: 'Zahra Putri',
        gender: 'P',
        class_id: 'VII-B',
        category: '2D',
        sub_option: 'Media Basah',
        style: 'Visual Tutorial',
        challenge: 'Sketsa Proporsi',
        feeling: 'Sangat senang',
        answers: completeAnswers
      }
    });
    assert(completeSub.statusCode === 200, `Complete submission accepted with HTTP ${completeSub.statusCode} (Expected 200)`);
    const completeJson = JSON.parse(completeSub.body);
    assert(completeJson.status === 'success' && completeJson.data.name === 'Zahra Putri', 'Student assessment successfully stored permanently');

    // 7. Check student HTML includes "Wajib Dijawab" and "Wajib Diisi" on essay
    console.log('\n7. Checking Student Portal UI contains Required Badges & Alert banner...');
    const rootRes = await makeRequest('/');
    assert(rootRes.body.includes('Wajib Dijawab'), 'UI contains "* Wajib Dijawab" badge');
    assert(rootRes.body.includes('Wajib Diisi'), 'UI contains "* Wajib Diisi" badge on essay section');
    assert(rootRes.body.includes('question-validation-alert'), 'UI contains question-validation-alert container');

    console.log(`\n========================================`);
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log(`========================================\n`);

    if (failed > 0) process.exit(1);
    process.exit(0);
  } catch (err) {
    console.error('Test execution failed:', err);
    process.exit(1);
  }
}, 500);
