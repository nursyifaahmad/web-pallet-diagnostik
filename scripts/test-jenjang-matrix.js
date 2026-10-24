/**
 * scripts/test-jenjang-matrix.js
 * Verification test for Pemetaan Matriks 27 Rombel (Fase D SMP).
 */

const BASE_URL = 'http://localhost:3090';

async function run() {
  console.log('🧪 Starting Pemetaan Matriks 27 Rombel Verification...');

  // 1. Fetch /api/classes
  const res = await fetch(`${BASE_URL}/api/classes`);
  const data = await res.json();

  if (data.status !== 'success') {
    throw new Error('Failed to fetch /api/classes: ' + JSON.stringify(data));
  }

  const classes = data.data;
  console.log(`✅ Received ${classes.length} classes from /api/classes`);

  if (classes.length !== 27) {
    throw new Error(`Expected 27 classes, got ${classes.length}`);
  }

  // 2. Verify all grades VII, VIII, IX and sections A-I are present
  const grades = ['VII', 'VIII', 'IX'];
  const sections = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];

  let totalStudentsAcrossSchool = 0;

  for (const g of grades) {
    for (const s of sections) {
      const classId = `${g}-${s}`;
      const c = classes.find(item => item.id === classId);
      if (!c) {
        throw new Error(`Missing class ${classId} in response!`);
      }
      if (c.class_id !== classId) {
        throw new Error(`Mismatch in class_id for ${classId}: got ${c.class_id}`);
      }
      const count = c.totalStudents ?? c.student_count;
      if (typeof count !== 'number' || count <= 0) {
        throw new Error(`Class ${classId} has invalid or zero student count: ${count}`);
      }
      totalStudentsAcrossSchool += count;
    }
  }

  console.log(`✅ All 27 classes (VII A-I, VIII A-I, IX A-I) verified with valid student counts.`);
  console.log(`✅ Total students across 27 rombel: ${totalStudentsAcrossSchool} students.`);

  // 3. Verify specific roster detail for VII-A
  const resDetail = await fetch(`${BASE_URL}/api/classes/VII-A`);
  const dataDetail = await resDetail.json();
  if (dataDetail.status !== 'success') {
    throw new Error('Failed to fetch /api/classes/VII-A');
  }

  const viiAStudents = dataDetail.data.students;
  if (!viiAStudents || viiAStudents.length === 0) {
    throw new Error('VII-A students array is empty!');
  }
  const rian = viiAStudents.find(s => s.attendance_no === 17 && s.gender === 'L');
  if (!rian) {
    throw new Error('Student No. 17 Rian Pratama (L) not found in VII-A roster!');
  }
  console.log(`✅ Verified VII-A roster: No. 17 ${rian.name} (${rian.gender}) present with ${viiAStudents.length} classmates.`);

  console.log('\n🎉 PEMETAAN MATRIKS 27 ROMBEL VERIFICATION PASSED 100%!');
}

run().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
