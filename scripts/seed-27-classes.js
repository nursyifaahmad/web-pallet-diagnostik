/**
 * scripts/seed-27-classes.js
 * Generates realistic student diagnostics data for all 27 rombel (VII A-I, VIII A-I, IX A-I).
 */

const db = require('../src/config/database');

const STYLES = [
  'Visual Tutorial',
  'Kinestetik Eksploratif',
  'Auditori / Demonstrasi',
  'Sosial Kolaboratif'
];

const CATEGORIES = ['2D', '3D'];

const SUB_OPTIONS_2D = [
  'Media Kering Pensil Grafis',
  'Drawing Spidol & Fineliner',
  'Cat Poster / Gouache',
  'Cat Air / Watercolor',
  'Digital Drawing Tablet'
];

const SUB_OPTIONS_3D = [
  'Clay & Pemodelan Plastisin',
  'Kriya Kertas & Origami 3D',
  'Pahat Sabun / Lilin',
  'Konstruksi Daur Ulang',
  'Keramik Sederhana'
];

const CHALLENGES = [
  'Sketsa Proporsi',
  'Pencampuran Warna',
  'Pencarian Ide Awal',
  'Finishing & Detail'
];

const FEELINGS = [
  'Senang & Percaya Diri',
  'Biasa Saja',
  'Ragu-ragu / Cemas',
  'Sangat Tertantang'
];

const FIRST_NAMES_MALE = [
  'Ahmad', 'Aditia', 'Arya', 'Bagas', 'Bima', 'Danu', 'Fajar', 'Galang',
  'Hafiz', 'Irfan', 'Jovian', 'Kevin', 'Luthfi', 'Naufal', 'Pratama',
  'Rafi', 'Raditya', 'Rangga', 'Rian', 'Rizky', 'Satria', 'Wahyu', 'Yoga', 'Zidan'
];

const FIRST_NAMES_FEMALE = [
  'Anindya', 'Annisa', 'Aulia', 'Cantika', 'Chelsea', 'Dinda', 'Gita',
  'Indah', 'Jessica', 'Kayla', 'Keysha', 'Kirana', 'Linely', 'Maya',
  'Nabila', 'Naura', 'Putri', 'Raisa', 'Salsa', 'Syifa', 'Tiara', 'Zahra'
];

const LAST_NAMES = [
  'Pratama', 'Saputra', 'Wijaya', 'Nugraha', 'Kusuma', 'Santoso', 'Hidayat',
  'Setiawan', 'Ramadhan', 'Lestari', 'Putri', 'Maharani', 'Safitri', 'Utami',
  'Siregar', 'Wibowo', 'Firmansyah', 'Permana', 'Hakim', 'Aurelia'
];

function getRandomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function runSeed27Classes() {
  console.log('🌱 Seeding realistic diagnostic student data across 27 rombel...');

  const classes = db.prepare('SELECT id, grade, section FROM classes ORDER BY grade ASC, section ASC').all();

  // Clear child tables first to satisfy foreign key constraints
  db.prepare('DELETE FROM rubric_assessments').run();
  db.prepare('DELETE FROM students').run();

  const insertStudent = db.prepare(`
    INSERT INTO students (
      attendance_no, name, gender, class_id, category, sub_option, style, challenge, feeling, answers_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let totalSeeded = 0;

  for (const c of classes) {
    // Generate between 18 and 24 students per class (some classes 24 = Lengkap, some 19 = Sebagian)
    const count = (c.id === 'VII-A' || c.section === 'A' || c.section === 'B' || c.section === 'C') ? 22 : (18 + Math.floor(Math.random() * 6));

    const usedNames = new Set();

    for (let att = 1; att <= count; att++) {
      let gender;
      let name;

      // Special case: In VII-A, attendance 17 MUST be "Rian Pratama" (L) for automated integration tests
      if (c.id === 'VII-A' && att === 17) {
        gender = 'L';
        name = 'Rian Pratama';
      } else if (c.id === 'VII-A' && att === 1) {
        gender = 'P';
        name = 'Linely Aurelia';
      } else if (c.id === 'VII-A' && att === 2) {
        gender = 'L';
        name = 'Bima Satria';
      } else {
        gender = Math.random() > 0.5 ? 'L' : 'P';
        const firstName = gender === 'L' ? getRandomItem(FIRST_NAMES_MALE) : getRandomItem(FIRST_NAMES_FEMALE);
        const lastName = getRandomItem(LAST_NAMES);
        name = `${firstName} ${lastName}`;

        // Ensure unique name in class
        let attempts = 0;
        while (usedNames.has(name) && attempts < 10) {
          name = `${firstName} ${getRandomItem(LAST_NAMES)}`;
          attempts++;
        }
      }
      usedNames.add(name);

      const category = getRandomItem(CATEGORIES);
      const sub_option = category === '2D' ? getRandomItem(SUB_OPTIONS_2D) : getRandomItem(SUB_OPTIONS_3D);
      const style = getRandomItem(STYLES);
      const challenge = getRandomItem(CHALLENGES);
      const feeling = getRandomItem(FEELINGS);

      const answers = {
        1: feeling,
        2: category,
        3: '2-3 kali seminggu',
        4: challenge,
        5: style,
        6: 'Kelompok kecil (3-4 orang)',
        7: 'Mencoba memperbaikinya sendiri',
        8: 'Demonstrasi / praktik langsung di depan kelas',
        9: 'Saya selalu percaya diri',
        10: 'Eksplorasi variasi media 2D & 3D lebih luas'
      };

      insertStudent.run(
        att,
        name,
        gender,
        c.id,
        category,
        sub_option,
        style,
        challenge,
        feeling,
        JSON.stringify(answers)
      );

      totalSeeded++;
    }
  }

  console.log(`✅ Successfully seeded ${totalSeeded} students across all 27 rombel!`);
}

if (require.main === module) {
  runSeed27Classes();
}

module.exports = runSeed27Classes;
