const db = require('./database');
const bcrypt = require('bcryptjs');

function runSeed() {
  console.log('[Seed] Starting database seeding...');

  // 1. Seed Teacher Account (guru / guru123)
  const existingTeacher = db.prepare('SELECT id FROM users WHERE username = ?').get('guru');
  if (!existingTeacher) {
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync('guru123', salt);
    db.prepare(`
      INSERT INTO users (username, email, password_hash, full_name, role)
      VALUES (?, ?, ?, ?, ?)
    `).run('guru', 'guru@artuniverse.my.id', hash, 'Guru Seni Rupa', 'teacher');
    console.log('[Seed] Created default teacher account: guru / guru123');
  } else {
    console.log('[Seed] Teacher account already exists.');
  }

  // 2. Seed 27 Classes (VII A-I, VIII A-I, IX A-I)
  const grades = [
    { grade: 7, roman: 'VII' },
    { grade: 8, roman: 'VIII' },
    { grade: 9, roman: 'IX' }
  ];
  const sections = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];

  const insertClass = db.prepare(`
    INSERT OR IGNORE INTO classes (id, grade, section, description)
    VALUES (?, ?, ?, ?)
  `);

  for (const g of grades) {
    for (const sec of sections) {
      const classId = `${g.roman}-${sec}`;
      insertClass.run(classId, g.grade, sec, `Kelas ${classId} Fase D SMP`);
    }
  }
  console.log('[Seed] Verified 27 classes (VII A-I, VIII A-I, IX A-I).');

  // 3. Seed 10 Default Diagnostic Questions
  const questionCount = db.prepare('SELECT COUNT(*) as count FROM diagnostic_questions').get();
  if (questionCount.count === 0) {
    const defaultQuestions = [
      {
        order_num: 1,
        category: 'Aspek 1: Perasaan & Sikap Belajar',
        title: '1. Perasaanmu saat mengikuti pelajaran Seni Rupa di sekolah?',
        subtitle: 'Pilih salah satu tingkat perasaanmu.',
        options_json: JSON.stringify(['Sangat senang', 'Senang', 'Biasa saja', 'Kurang senang', 'Tidak senang']),
        is_media_selector: 0,
        reason_label: 'Mengapa kamu merasakan hal tersebut?'
      },
      {
        order_num: 2,
        category: 'Aspek 2: Minat Utama Media (2D vs 3D)',
        title: '2. Pilih Kategori Utama dan Sub-Pilihan Media Seni Rupa yang paling kamu sukai:',
        subtitle: 'Tentukan minat utamamu secara spesifik.',
        options_json: JSON.stringify(['2D', '3D']),
        is_media_selector: 1,
        reason_label: 'Mengapa kamu lebih tertarik pada kategori media tersebut?'
      },
      {
        order_num: 3,
        category: 'Aspek 3: Kebiasaan Berkarya',
        title: '3. Seberapa sering kamu membuat karya seni / menggambar di luar sekolah?',
        subtitle: 'Pilih frekuensi kebiasaanmu.',
        options_json: JSON.stringify(['Hampir setiap hari', '2-3 kali seminggu', 'Sekitar 1 kali seminggu', 'Sesekali saja', 'Hampir tidak pernah']),
        is_media_selector: 0,
        reason_label: 'Karya apa yang biasanya kamu buat di rumah?'
      },
      {
        order_num: 4,
        category: 'Aspek 4: Kesulitan Berkarya',
        title: '4. Bagian mana yang paling menantang bagimu saat berkarya?',
        subtitle: 'Pilih bagian yang paling sering kamu hadapi.',
        options_json: JSON.stringify([
          'Menentukan / mencari ide berkarya',
          'Membuat sketsa awal & proporsi bentuk',
          'Memilih dan memadukan kombinasi warna',
          'Menggunakan alat dan bahan media',
          'Menyelesaikan finishing karya sampai tuntas',
          'Tidak mengalami kesulitan berarti'
        ]),
        is_media_selector: 0,
        reason_label: 'Jelaskan lebih detail kesulitan tersebut:'
      },
      {
        order_num: 5,
        category: 'Aspek 5: Cara Belajar Efektif',
        title: '5. Cara belajar mana yang paling membantumu memahami Seni Rupa?',
        subtitle: 'Pilih gaya belajar favoritmu.',
        options_json: JSON.stringify([
          'Melihat contoh gambar / infografis panduan (Visual)',
          'Menonton video tutorial berkarya (Visual/Video)',
          'Melihat guru melakukan demonstrasi langsung (Auditori/Dem)',
          'Langsung mencoba praktik sendiri (Kinestetik)',
          'Berdiskusi dan bertukar ide dengan teman'
        ]),
        is_media_selector: 0,
        reason_label: 'Mengapa cara tersebut paling membantu?'
      },
      {
        order_num: 6,
        category: 'Aspek 6: Kenyamanan Bekerja',
        title: '6. Kamu lebih nyaman mengerjakan tugas Seni Rupa secara:',
        subtitle: 'Pilih kondisi kerja idealmu.',
        options_json: JSON.stringify([
          'Sendiri (Individu)',
          'Berpasangan (2 orang)',
          'Kelompok kecil (3-4 orang)',
          'Kelompok besar (> 4 orang)'
        ]),
        is_media_selector: 0,
        reason_label: 'Alasan kenyamananmu:'
      },
      {
        order_num: 7,
        category: 'Aspek 7: Respons Menghadapi Kesulitan',
        title: '7. Apa yang kamu lakukan jika hasil karya belum sesuai harapan?',
        subtitle: 'Pilih tindakan utamamu.',
        options_json: JSON.stringify([
          'Mencoba memperbaikinya sendiri',
          'Bertanya dan meminta masukan guru',
          'Bertanya dan minta bantuan teman',
          'Mencari contoh referensi karya lain'
        ]),
        is_media_selector: 0,
        reason_label: 'Pengalaman saat membetulkan karya:'
      },
      {
        order_num: 8,
        category: 'Aspek 8: Preferensi Metode Guru',
        title: '8. Cara mengajar guru seperti apa yang membuatmu paling semangat?',
        subtitle: 'Pilih metode favoritmu.',
        options_json: JSON.stringify([
          'Memberikan banyak contoh gambar & contoh karya',
          'Menggunakan video / media digital interaktif',
          'Demonstrasi / praktik langsung di depan kelas',
          'Kebebasan penuh mengekspresikan ide'
        ]),
        is_media_selector: 0,
        reason_label: 'Saran cara mengajar:'
      },
      {
        order_num: 9,
        category: 'Aspek 9: Hambatan Kepercayaan Diri',
        title: '9. Hal apa yang kadang membuatmu ragu atau kurang percaya diri?',
        subtitle: 'Pilih hal yang paling kamu rasakan.',
        options_json: JSON.stringify([
          'Merasa kurang pandai menggambar/membuat karya',
          'Takut hasil karya dinilai kurang bagus',
          'Takut dibandingkan dengan karya teman',
          'Kesulitan menemukan ide kreatif',
          'Saya selalu percaya diri'
        ]),
        is_media_selector: 0,
        reason_label: 'Kekhawatiran utama:'
      },
      {
        order_num: 10,
        category: 'Aspek 10: Harapan Pembelajaran',
        title: '10. Apa harapanmu agar pembelajaran Seni Rupa lebih seru?',
        subtitle: 'Tuliskan harapan dan sarankan ide kreatifmu.',
        options_json: JSON.stringify([
          'Lebih banyak porsi praktik daripada teori',
          'Eksplorasi variasi media 2D & 3D lebih luas',
          'Pemanfaatan media digital / aplikasi HP',
          'Sesi pameran karya sederhana di kelas'
        ]),
        is_media_selector: 0,
        reason_label: 'Saran konkret untuk Guru Seni Rupa:'
      }
    ];

    const insertQ = db.prepare(`
      INSERT INTO diagnostic_questions (order_num, category, title, subtitle, options_json, is_media_selector, reason_label, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `);

    for (const q of defaultQuestions) {
      insertQ.run(q.order_num, q.category, q.title, q.subtitle, q.options_json, q.is_media_selector, q.reason_label);
    }
    console.log('[Seed] Inserted 10 default diagnostic questions.');
  } else {
    console.log(`[Seed] Diagnostic questions already seeded (${questionCount.count} questions).`);
  }

  // 4. Seed Diagnostic Students for 27 Rombel if empty
  const studentCount = db.prepare('SELECT COUNT(*) as count FROM students').get();
  if (studentCount.count < 27) {
    const seed27 = require('../../scripts/seed-27-classes');
    seed27();
  }

  console.log('[Seed] Seeding completed successfully!');
}

if (require.main === module) {
  runSeed();
}

module.exports = runSeed;
