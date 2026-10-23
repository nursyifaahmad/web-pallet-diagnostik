/**
 * scripts/test-tahap4-student-crud.js
 * Comprehensive unit test for Tahap 4: Teacher Dashboard & Student Roster CRUD operations.
 */

const BASE_URL = 'http://localhost:3090';
const db = require('../src/config/database');

async function run() {
  console.log('🧪 Starting Tahap 4 Student Roster CRUD Verification...');

  // Clean up any stale test students first
  db.prepare("DELETE FROM students WHERE attendance_no IN (98, 99) OR name LIKE '%Test%'").run();

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

  // 2. Create Student (Create)
  console.log('2. Creating new student in VII-A...');
  const testAttNo = 98;
  const testName = 'Budi Test Santoso';
  const createRes = await fetch(`${BASE_URL}/api/students`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      attendance_no: testAttNo,
      name: testName,
      gender: 'L',
      class_id: 'VII-A',
      category: '2D',
      sub_option: 'Media Kering Pensil Grafis',
      style: 'Visual Tutorial',
      challenge: 'Sketsa Proporsi',
      feeling: 'Senang & Percaya Diri'
    })
  });
  const createData = await createRes.json();
  if (createData.status !== 'success' || !createData.data?.id) {
    throw new Error('Failed to create student: ' + JSON.stringify(createData));
  }
  const studentId = createData.data.id;
  console.log('✅ Student created successfully with ID:', studentId);

  // 3. Read Student in Roster (Read)
  console.log('3. Reading VII-A roster...');
  const rosterRes = await fetch(`${BASE_URL}/api/classes/VII-A`, {
    headers: authHeaders
  });
  const rosterData = await rosterRes.json();
  if (rosterData.status !== 'success') {
    throw new Error('Failed to fetch class roster');
  }
  const createdStudent = rosterData.data.students.find(s => s.id === studentId);
  if (!createdStudent) {
    throw new Error('Created student not found in VII-A roster!');
  }
  console.log(`✅ Student found in roster with ID ${studentId}: No. ${createdStudent.attendance_no} - ${createdStudent.name} (${createdStudent.gender})`);

  // 4. Update Student (Update)
  console.log(`4. Updating student #${studentId}...`);
  const updatedName = 'Budi Santoso (Updated)';
  const updateRes = await fetch(`${BASE_URL}/api/students/${studentId}`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({
      attendance_no: 99,
      name: updatedName,
      gender: 'L',
      class_id: 'VII-A',
      category: '3D',
      sub_option: 'Clay & Keramik',
      style: 'Kinestetik Eksploratif',
      challenge: 'Pencampuran Warna',
      feeling: 'Sangat Tertantang'
    })
  });
  const updateData = await updateRes.json();
  if (updateData.status !== 'success') {
    throw new Error('Failed to update student: ' + JSON.stringify(updateData));
  }
  console.log('✅ Student updated response:', updateData);

  // 5. Verify Update in Roster
  console.log('5. Verifying updated student in roster...');
  const verifyRes = await fetch(`${BASE_URL}/api/classes/VII-A`, {
    headers: authHeaders
  });
  const verifyData = await verifyRes.json();
  const updatedStudent = verifyData.data.students.find(s => s.id === studentId);
  if (!updatedStudent || updatedStudent.name !== updatedName || updatedStudent.attendance_no !== 99 || updatedStudent.category !== '3D' || updatedStudent.style !== 'Kinestetik Eksploratif') {
    throw new Error('Updated student data mismatch: ' + JSON.stringify(updatedStudent));
  }
  console.log('✅ Student update verified in database:', updatedStudent);

  // 6. Delete Student (Delete)
  console.log(`6. Deleting student #${studentId}...`);
  const deleteRes = await fetch(`${BASE_URL}/api/students/${studentId}`, {
    method: 'DELETE',
    headers: authHeaders
  });
  const deleteData = await deleteRes.json();
  if (deleteData.status !== 'success') {
    throw new Error('Failed to delete student: ' + JSON.stringify(deleteData));
  }
  console.log('✅ Student deleted response:', deleteData);

  // 7. Verify Deletion from Roster
  console.log('7. Verifying student deletion from roster...');
  const finalRes = await fetch(`${BASE_URL}/api/classes/VII-A`, {
    headers: authHeaders
  });
  const finalData = await finalRes.json();
  const deletedStudent = finalData.data.students.find(s => s.id === studentId);
  if (deletedStudent) {
    throw new Error('Deleted student is still found in roster!');
  }
  console.log('✅ Student successfully removed from VII-A roster.');

  // Clean up any remaining
  db.prepare("DELETE FROM students WHERE attendance_no IN (98, 99) OR name LIKE '%Test%'").run();

  console.log('\n🎉 ALL TAHAP 4 CRUD TESTS PASSED PERFECLY!');
}

run().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
