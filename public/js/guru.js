// Teacher Dashboard Controller for PALLET Studio
let allClassSummaries = [];
let currentGrade = 7;
let currentClass = 'VII-A';
let currentRoster = [];

// Timer State
let timerInterval = null;
let timerSeconds = 15 * 60;
let timerIsRunning = false;

document.addEventListener('DOMContentLoaded', async () => {
  setupNavigation();
  setupClassSwitcher();
  await loadClassData();
  await loadQuestionsList();
  await loadCalendarEvents();
  setupRosterHandlers();
  setupQuestionModalHandlers();
  setupRubricHandlers();
  setupCalendarHandlers();
});

// 1. Navigation Tabs
function switchMainTab(tabId) {
  document.querySelectorAll('.tab-content-section').forEach(sec => sec.classList.add('hidden'));
  document.querySelectorAll('.main-nav-btn').forEach(btn => {
    btn.classList.remove('border-atelier-terracotta', 'text-atelier-terracotta');
    btn.classList.add('border-transparent', 'text-atelier-inkMuted');
  });

  const targetSecId = tabId.replace('nav-', '').replace('tab-', 'section-');
  const targetSec = document.getElementById(targetSecId);
  if (targetSec) targetSec.classList.remove('hidden');

  const activeBtn = document.getElementById(tabId);
  if (activeBtn) {
    activeBtn.classList.remove('border-transparent', 'text-atelier-inkMuted');
    activeBtn.classList.add('border-atelier-terracotta', 'text-atelier-terracotta');
  }

  // Refresh tab-specific content if needed
  if (tabId === 'nav-tab-questions') loadQuestionsList();
  if (tabId === 'nav-tab-modul') generateModulAjarText();
  if (tabId === 'nav-tab-share') updateShareLinkAndQR();
}

function setupNavigation() {
  document.getElementById('btn-logout').addEventListener('click', async () => {
    if (confirm('Apakah Anda yakin ingin keluar dari Studio Guru?')) {
      await API.logout();
      window.location.href = '/login/guru';
    }
  });

  document.getElementById('btn-export-excel').addEventListener('click', () => {
    window.location.href = `/api/export/excel?class=${encodeURIComponent(currentClass)}`;
  });
}

// 2. Class Switcher (27 Classes: VII A-I, VIII A-I, IX A-I)
const SECTIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];

function switchGradeTab(grade) {
  currentGrade = grade;
  document.querySelectorAll('.grade-tab-btn').forEach(btn => {
    btn.classList.remove('bg-atelier-terracotta', 'text-white');
    btn.classList.add('bg-white', 'text-atelier-ink');
  });
  const activeBtn = document.getElementById(`tab-grade-${grade}`);
  if (activeBtn) {
    activeBtn.classList.remove('bg-white', 'text-atelier-ink');
    activeBtn.classList.add('bg-atelier-terracotta', 'text-white');
  }
  renderSectionButtons();
}

function renderSectionButtons() {
  const container = document.getElementById('section-buttons-container');
  container.innerHTML = '<span class="text-atelier-inkMuted text-[11px] mr-2 uppercase tracking-wider font-bold">Rombel:</span>';
  
  const roman = currentGrade === 7 ? 'VII' : currentGrade === 8 ? 'VIII' : 'IX';

  SECTIONS.forEach(sec => {
    const classId = `${roman}-${sec}`;
    const isSelected = currentClass === classId;
    const btn = document.createElement('button');
    btn.className = `px-2.5 py-1 rounded font-bold transition cursor-pointer ${
      isSelected ? 'bg-atelier-terracotta text-white' : 'bg-white text-atelier-ink hover:bg-atelier-warm border border-atelier-border'
    }`;
    btn.textContent = sec;
    btn.onclick = () => selectClass(classId);
    container.appendChild(btn);
  });
}

function setupClassSwitcher() {
  renderSectionButtons();
}

async function selectClass(classId) {
  currentClass = classId;
  const roman = classId.split('-')[0];
  currentGrade = roman === 'VII' ? 7 : roman === 'VIII' ? 8 : 9;

  document.getElementById('active-class-badge').textContent = currentClass;
  document.getElementById('quick-add-class-label').textContent = currentClass;
  document.getElementById('roster-class-title').textContent = currentClass;
  document.getElementById('heatmap-class-title').textContent = currentClass;
  document.getElementById('modul-class-name').textContent = currentClass;
  document.getElementById('share-class-badge').textContent = currentClass;

  renderSectionButtons();
  await loadCurrentClassDetail();
  updateShareLinkAndQR();
}

// 3. Load Classes & Roster Data
async function loadClassData() {
  try {
    const res = await API.getClasses();
    if (res && res.status === 'success') {
      allClassSummaries = res.data;
      await loadCurrentClassDetail();
    }
  } catch (err) {
    console.error('Failed to load class summaries', err);
  }
}

async function loadCurrentClassDetail() {
  try {
    const res = await API.getClassDetail(currentClass);
    if (res && res.status === 'success') {
      currentRoster = res.data.students || [];
      renderRosterTable(currentRoster);
      updateClassStats(currentRoster);
      renderHeatmap(currentRoster);
      populateRubricStudentSelect(currentRoster);
      generateModulAjarText();
    }
  } catch (err) {
    console.error('Failed to load class detail', err);
  }
}

function updateClassStats(roster) {
  document.getElementById('stat-total-students').textContent = `${roster.length} Siswa`;

  if (roster.length === 0) {
    document.getElementById('stat-dominant-style').textContent = '-';
    document.getElementById('stat-top-media').textContent = '-';
    return;
  }

  // Calculate style and media dominance
  const styles = {};
  const media = {};
  roster.forEach(s => {
    styles[s.style] = (styles[s.style] || 0) + 1;
    media[s.category] = (media[s.category] || 0) + 1;
  });

  const dominantStyle = Object.entries(styles).sort((a,b) => b[1] - a[1])[0]?.[0] || '-';
  const topMedia = Object.entries(media).sort((a,b) => b[1] - a[1])[0]?.[0] || '-';

  document.getElementById('stat-dominant-style').textContent = dominantStyle;
  document.getElementById('stat-top-media').textContent = topMedia;
}

// 4. Roster Table Management
function renderRosterTable(students) {
  const tbody = document.getElementById('roster-table-body');
  tbody.innerHTML = '';

  if (students.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="py-8 text-center text-atelier-inkMuted italic">
          Belum ada data siswa di kelas ${currentClass}. Bagikan tautan kelas atau gunakan form input kilat di atas.
        </td>
      </tr>
    `;
    return;
  }

  students.forEach((s, idx) => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-atelier-warm/40 transition';
    tr.innerHTML = `
      <td class="py-3 px-4 font-mono text-atelier-inkMuted">${idx + 1}</td>
      <td class="py-3 px-4 font-semibold text-atelier-ink">${s.name}</td>
      <td class="py-3 px-4">
        <span class="px-2 py-0.5 rounded-md font-mono text-[11px] font-bold bg-atelier-terracottaLight text-atelier-terracotta">
          ${s.style || 'Visual Tutorial'}
        </span>
      </td>
      <td class="py-3 px-4 font-medium text-atelier-ochre">
        ${s.category || '2D'} (${s.sub_option || 'Kering'})
      </td>
      <td class="py-3 px-4 text-atelier-inkMuted">
        ${s.challenge || 'Sketsa Proporsi'}
      </td>
      <td class="py-3 px-4 text-center">
        <button onclick="handleDeleteStudent(${s.id}, '${s.name}')" class="text-red-600 hover:text-red-800 font-mono text-[11px] font-semibold cursor-pointer">
          Hapus
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function setupRosterHandlers() {
  // Quick Add
  document.getElementById('quick-add-student-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('quick-name').value.trim();
    const category = document.getElementById('quick-category').value;
    const subOption = document.getElementById('quick-sub').value.trim() || 'Kering';
    const style = document.getElementById('quick-style').value;

    if (!name) return;

    try {
      const res = await API.submitStudentAssessment({
        name,
        class_id: currentClass,
        category,
        sub_option: subOption,
        style,
        challenge: 'Pencarian Ide Awal',
        feeling: 'Senang'
      });

      if (res && res.status === 'success') {
        document.getElementById('quick-name').value = '';
        await loadCurrentClassDetail();
      }
    } catch (err) {
      alert('Gagal menambah siswa: ' + err.message);
    }
  });

  // Filter search
  document.getElementById('filter-roster-search').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    const filtered = currentRoster.filter(s => s.name.toLowerCase().includes(q));
    renderRosterTable(filtered);
  });
}

async function handleDeleteStudent(id, name) {
  if (confirm(`Apakah Anda yakin ingin menghapus data siswa "${name}" dari rombel ${currentClass}?`)) {
    try {
      const res = await API.deleteStudent(id);
      if (res && res.status === 'success') {
        await loadCurrentClassDetail();
      }
    } catch (err) {
      alert('Gagal menghapus siswa: ' + err.message);
    }
  }
}

// 5. Heatmap & Analisis Kelas
function renderHeatmap(roster) {
  const stylesContainer = document.getElementById('heatmap-styles-list');
  const mediaContainer = document.getElementById('heatmap-media-list');
  const challengesContainer = document.getElementById('heatmap-challenges-list');

  stylesContainer.innerHTML = '';
  mediaContainer.innerHTML = '';
  challengesContainer.innerHTML = '';

  if (roster.length === 0) {
    const emptyMsg = '<p class="text-atelier-inkMuted italic">Belum ada data pemetaan rombel ini.</p>';
    stylesContainer.innerHTML = emptyMsg;
    mediaContainer.innerHTML = emptyMsg;
    challengesContainer.innerHTML = emptyMsg;
    return;
  }

  const total = roster.length;
  const countBy = (key) => {
    const counts = {};
    roster.forEach(s => {
      const val = s[key] || 'Lainnya';
      counts[val] = (counts[val] || 0) + 1;
    });
    return counts;
  };

  const renderBarList = (container, counts, colorClass) => {
    Object.entries(counts).sort((a,b) => b[1] - a[1]).forEach(([label, count]) => {
      const pct = Math.round((count / total) * 100);
      const row = document.createElement('div');
      row.className = 'space-y-1';
      row.innerHTML = `
        <div class="flex justify-between font-medium">
          <span>${label}</span>
          <span class="font-mono text-atelier-inkMuted">${count} siswa (${pct}%)</span>
        </div>
        <div class="w-full bg-atelier-border h-1.5 rounded-full overflow-hidden">
          <div class="${colorClass} h-full rounded-full" style="width: ${pct}%"></div>
        </div>
      `;
      container.appendChild(row);
    });
  };

  renderBarList(stylesContainer, countBy('style'), 'bg-atelier-terracotta');
  renderBarList(mediaContainer, countBy('category'), 'bg-atelier-ochre');
  renderBarList(challengesContainer, countBy('challenge'), 'bg-atelier-ultramarine');
}

// 6. CRUD Soal Diagnostik
let loadedQuestions = [];

async function loadQuestionsList() {
  const container = document.getElementById('questions-list-container');
  container.innerHTML = '<p class="text-xs text-atelier-inkMuted italic">Memuat daftar soal...</p>';

  try {
    const res = await API.getAllQuestions();
    if (res && res.status === 'success') {
      loadedQuestions = res.data;
      renderQuestionsList(loadedQuestions);
    }
  } catch (err) {
    console.error('Failed to load questions', err);
    container.innerHTML = '<p class="text-xs text-red-500">Gagal memuat soal diagnostik.</p>';
  }
}

function renderQuestionsList(questions) {
  const container = document.getElementById('questions-list-container');
  container.innerHTML = '';

  if (questions.length === 0) {
    container.innerHTML = '<p class="text-xs text-atelier-inkMuted italic">Belum ada butir soal asesmen diagnostik.</p>';
    return;
  }

  questions.forEach((q, idx) => {
    const card = document.createElement('div');
    card.className = 'p-4 bg-white rounded-xl border border-atelier-border hover:border-atelier-borderMedium transition space-y-3';
    
    // Options badge list
    let optionsPillHtml = '';
    if (q.isMediaSelector) {
      optionsPillHtml = '<span class="px-2 py-0.5 bg-atelier-ochreLight text-atelier-ochre text-[10px] font-mono font-bold rounded">Selektor Interaktif 2D vs 3D (Sub-Pilihan Media Lengkap)</span>';
    } else if (Array.isArray(q.options)) {
      optionsPillHtml = q.options.map(opt => `
        <span class="px-2 py-0.5 bg-atelier-warm text-atelier-ink text-[11px] rounded-md border border-atelier-border">
          ${opt}
        </span>
      `).join(' ');
    }

    card.innerHTML = `
      <div class="flex items-start justify-between gap-3">
        <div class="space-y-1">
          <div class="flex items-center gap-2">
            <span class="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-atelier-terracottaLight text-atelier-terracotta">
              Soal #${idx + 1}
            </span>
            <span class="font-mono text-xs font-semibold text-atelier-inkMuted">${q.category}</span>
          </div>
          <h4 class="font-serif font-bold text-base text-atelier-ink">${q.title}</h4>
          ${q.subtitle ? `<p class="text-xs text-atelier-inkMuted">${q.subtitle}</p>` : ''}
        </div>
        <div class="flex items-center gap-1.5 flex-shrink-0">
          <button onclick="editQuestion(${q.id})" class="px-2.5 py-1 bg-atelier-warm hover:bg-atelier-border text-atelier-ink rounded-lg text-xs font-medium cursor-pointer transition">
            Edit
          </button>
          <button onclick="deleteQuestion(${q.id})" class="px-2.5 py-1 text-red-600 hover:bg-red-50 rounded-lg text-xs font-medium cursor-pointer transition">
            Hapus
          </button>
        </div>
      </div>

      <div class="space-y-1.5 pt-1 border-t border-atelier-border/60">
        <span class="block text-[10px] font-mono text-atelier-inkMuted uppercase">Pilihan Jawaban:</span>
        <div class="flex flex-wrap gap-1.5">
          ${optionsPillHtml}
        </div>
      </div>

      ${q.reason_label ? `
        <div class="text-[11px] text-atelier-inkMuted italic">
          <span class="font-semibold text-atelier-ink not-italic">Pertanyaan Alasan:</span> "${q.reason_label}"
        </div>
      ` : ''}
    `;
    container.appendChild(card);
  });
}

function openQuestionModal(q = null) {
  const modal = document.getElementById('modal-question');
  const titleElem = document.getElementById('modal-question-title');
  const formId = document.getElementById('form-question-id');
  const catInput = document.getElementById('form-q-category');
  const titleInput = document.getElementById('form-q-title');
  const subtitleInput = document.getElementById('form-q-subtitle');
  const reasonInput = document.getElementById('form-q-reason');
  const optionsContainer = document.getElementById('modal-options-container');

  optionsContainer.innerHTML = '';

  if (q) {
    titleElem.textContent = 'Edit Soal Diagnostik';
    formId.value = q.id;
    catInput.value = q.category;
    titleInput.value = q.title;
    subtitleInput.value = q.subtitle || '';
    reasonInput.value = q.reason_label || '';

    if (Array.isArray(q.options) && q.options.length > 0) {
      q.options.forEach(opt => addQuestionOptionRow(opt));
    } else {
      addQuestionOptionRow('Pilihan 1');
      addQuestionOptionRow('Pilihan 2');
    }
  } else {
    titleElem.textContent = 'Tambah Soal Diagnostik Baru';
    formId.value = '';
    catInput.value = `Aspek ${loadedQuestions.length + 1}: Kategori Baru`;
    titleInput.value = '';
    subtitleInput.value = 'Pilih salah satu opsi yang paling sesuai.';
    reasonInput.value = 'Mengapa kamu memilih hal tersebut?';

    addQuestionOptionRow('Sangat Sesuai');
    addQuestionOptionRow('Cukup Sesuai');
    addQuestionOptionRow('Kurang Sesuai');
  }

  modal.classList.remove('hidden');
}

function closeQuestionModal() {
  document.getElementById('modal-question').classList.add('hidden');
}

function addQuestionOptionRow(val = '') {
  const container = document.getElementById('modal-options-container');
  const row = document.createElement('div');
  row.className = 'flex items-center gap-2';
  row.innerHTML = `
    <input type="text" value="${val}" required placeholder="Teks opsi pilihan..."
      class="q-opt-input flex-1 px-3 py-1.5 rounded-lg border border-atelier-border text-xs outline-none focus:border-atelier-terracotta">
    <button type="button" onclick="this.parentElement.remove()" class="text-red-500 hover:text-red-700 text-sm font-bold px-2 py-1 cursor-pointer">
      ✕
    </button>
  `;
  container.appendChild(row);
}

function editQuestion(id) {
  const q = loadedQuestions.find(item => item.id === id);
  if (q) openQuestionModal(q);
}

async function deleteQuestion(id) {
  if (confirm('Apakah Anda yakin ingin menghapus butir soal diagnostik ini?')) {
    try {
      const res = await API.deleteQuestion(id);
      if (res && res.status === 'success') {
        await loadQuestionsList();
      }
    } catch (err) {
      alert('Gagal menghapus soal: ' + err.message);
    }
  }
}

async function confirmResetQuestions() {
  if (confirm('PERINGATAN: Seluruh soal diagnostik akan di-reset kembali ke 10 butir soal standar bawaan asal. Lanjutkan?')) {
    try {
      const res = await API.resetQuestions();
      if (res && res.status === 'success') {
        alert(res.message);
        await loadQuestionsList();
      }
    } catch (err) {
      alert('Gagal me-reset soal: ' + err.message);
    }
  }
}

function setupQuestionModalHandlers() {
  document.getElementById('form-question').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('form-question-id').value;
    const category = document.getElementById('form-q-category').value.trim();
    const title = document.getElementById('form-q-title').value.trim();
    const subtitle = document.getElementById('form-q-subtitle').value.trim();
    const reason_label = document.getElementById('form-q-reason').value.trim();

    const options = Array.from(document.querySelectorAll('.q-opt-input'))
      .map(input => input.value.trim())
      .filter(Boolean);

    if (options.length === 0) {
      alert('Sediakan minimal 1 opsi pilihan ganda.');
      return;
    }

    const payload = {
      category,
      title,
      subtitle,
      options,
      reason_label,
      is_media_selector: 0
    };

    try {
      if (id) {
        await API.updateQuestion(id, payload);
      } else {
        await API.createQuestion(payload);
      }
      closeQuestionModal();
      await loadQuestionsList();
    } catch (err) {
      alert('Gagal menyimpan soal: ' + err.message);
    }
  });
}

// 7. Modul Ajar Generator (Kurikulum Merdeka)
function generateModulAjarText() {
  const container = document.getElementById('modul-ajar-document');
  if (!container) return;

  const total = currentRoster.length;
  const dominantStyle = document.getElementById('stat-dominant-style').textContent || 'Visual Tutorial';
  const topMedia = document.getElementById('stat-top-media').textContent || '2D';

  container.innerHTML = `
    <!-- Kop Modul -->
    <div class="text-center border-b-2 border-atelier-ink pb-4 space-y-1">
      <h2 class="font-serif font-black text-xl uppercase tracking-wider">MODUL AJAR SENI RUPA FASE D (SMP)</h2>
      <p class="font-serif text-sm italic">Pendekatan Pembelajaran Berdiferensiasi Berbasis Profil Diagnostik Siswa</p>
      <p class="font-mono text-xs text-atelier-inkMuted">Satuan Pendidikan: SMP · Alokasi Waktu: 3 JP (3 x 40 Menit) · Kelas: ${currentClass}</p>
    </div>

    <!-- I. Identitas & Capaian -->
    <div class="space-y-2">
      <h3 class="font-serif font-bold text-base text-atelier-terracotta uppercase tracking-wide">I. Capaian Pembelajaran & Profil Pelajar Pancasila</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div class="p-3 bg-atelier-warm/40 rounded-xl border border-atelier-border space-y-1">
          <strong class="text-atelier-ink">Elemen Capaian:</strong>
          <p class="text-atelier-inkMuted">Mengalami (Experiencing) & Menciptakan (Making) karya seni rupa dengan memanfaatkan ragam media eksploratif 2D dan 3D.</p>
        </div>
        <div class="p-3 bg-atelier-warm/40 rounded-xl border border-atelier-border space-y-1">
          <strong class="text-atelier-ink">Dimensi Profil Pancasila:</strong>
          <p class="text-atelier-inkMuted">1. Kreatif (Orisinalitas gagasan berkarya), 2. Mandiri (Ketekunan menyelesaikan karya), 3. Gotong Royong (Apresiasi tim).</p>
        </div>
      </div>
    </div>

    <!-- II. Karakteristik Profil Rombel -->
    <div class="space-y-2">
      <h3 class="font-serif font-bold text-base text-atelier-terracotta uppercase tracking-wide">II. Karakteristik Diagnostik Rombel ${currentClass}</h3>
      <p class="text-xs text-atelier-ink leading-relaxed">
        Berdasarkan hasil asesmen diagnostik terhadap <strong>${total} siswa terdata</strong> di kelas ${currentClass}, rombel ini memiliki dominasi gaya belajar <strong>${dominantStyle}</strong> dengan preferensi media utama <strong>${topMedia}</strong>. Pembelajaran dirancang melalui diferensiasi multi-jalur agar memfasilitasi keberagaman tersebut.
      </p>
    </div>

    <!-- III. Rencana Diferensiasi Pembelajaran -->
    <div class="space-y-2">
      <h3 class="font-serif font-bold text-base text-atelier-terracotta uppercase tracking-wide">III. Strategi Pembelajaran Berdiferensiasi</h3>
      <div class="space-y-2 text-xs">
        <div class="p-3 bg-white border border-atelier-border rounded-xl">
          <strong class="text-atelier-terracotta font-mono uppercase">1. Diferensiasi Konten:</strong>
          <p class="text-atelier-ink mt-0.5">Guru menyiapkan variasi panduan berkarya: Modul infografis visual langkah-demi-langkah (untuk siswa Visual), materi audio-visual tutorial video, dan model fisik karya nyata (untuk siswa Kinestetik).</p>
        </div>
        <div class="p-3 bg-white border border-atelier-border rounded-xl">
          <strong class="text-atelier-ochre font-mono uppercase">2. Diferensiasi Proses:</strong>
          <p class="text-atelier-ink mt-0.5">Siswa bekerja secara heterogen atau mandiri. Guru memberikan bimbingan intensif (*scaffolding*) pada tahapan sketsa dan proporsi untuk siswa yang membutuhkan pendampingan lebih.</p>
        </div>
        <div class="p-3 bg-white border border-atelier-border rounded-xl">
          <strong class="text-atelier-sage font-mono uppercase">3. Diferensiasi Produk:</strong>
          <p class="text-atelier-ink mt-0.5">Siswa diberikan kebebasan memilih bentuk akhir karya: gambar 2D (pensil/cat air/digital) atau objek 3D (lempung/kertas/bahan daur ulang) sesuai minat diagnostiknya.</p>
        </div>
      </div>
    </div>

    <!-- IV. Langkah-Langkah Pembelajaran -->
    <div class="space-y-2">
      <h3 class="font-serif font-bold text-base text-atelier-terracotta uppercase tracking-wide">IV. Skenario Pembelajaran (120 Menit)</h3>
      <div class="space-y-2 text-xs">
        <div class="p-3 bg-atelier-warm/40 rounded-xl">
          <strong>A. Kegiatan Awal (15 Menit):</strong>
          <ul class="list-disc list-inside text-atelier-inkMuted mt-1 space-y-0.5">
            <li>Apersepsi & refleksi emosi belajar seni rupa.</li>
            <li>Penyampaian tujuan pembelajaran & pembagian bahan inspirasi berbasis minat media.</li>
          </ul>
        </div>
        <div class="p-3 bg-atelier-warm/40 rounded-xl">
          <strong>B. Kegiatan Inti Studio Berkarya (90 Menit):</strong>
          <ul class="list-disc list-inside text-atelier-inkMuted mt-1 space-y-0.5">
            <li><strong>Fase 1 (20 Menit):</strong> Eksplorasi sketsa proporsi & penentuan ide awal.</li>
            <li><strong>Fase 2 (50 Menit):</strong> Eksekusi berkarya dengan media pilihan (2D kering/basah atau 3D).</li>
            <li><strong>Fase 3 (20 Menit):</strong> Finishing detail, apresiasi kelompok heterogen, dan saling bertukar masukan konstruktif.</li>
          </ul>
        </div>
        <div class="p-3 bg-atelier-warm/40 rounded-xl">
          <strong>C. Kegiatan Penutup (15 Menit):</strong>
          <ul class="list-disc list-inside text-atelier-inkMuted mt-1 space-y-0.5">
            <li>Refleksi perasaan setelah berkarya dan dokumentasi foto karya ke portofolio digital.</li>
          </ul>
        </div>
      </div>
    </div>
  `;
}

function copyModulAjarText() {
  const container = document.getElementById('modul-ajar-document');
  if (!container) return;
  navigator.clipboard.writeText(container.innerText).then(() => {
    alert('Teks Modul Ajar berhasil disalin ke clipboard!');
  });
}

// 8. Studio Timer
function setTimerPhase(phase, minutes) {
  document.querySelectorAll('.timer-phase-btn').forEach(btn => {
    btn.className = 'timer-phase-btn p-2 rounded-lg border border-atelier-border bg-white text-atelier-ink';
  });

  const activeBtn = document.getElementById(`btn-phase-${phase}`);
  if (activeBtn) {
    activeBtn.className = 'timer-phase-btn p-2 rounded-lg border border-atelier-terracotta bg-atelier-terracottaLight text-atelier-terracotta font-bold';
  }

  const phaseLabels = {
    'sketsa': 'Fase 1: Eksplorasi Ide & Sketsa Proporsi',
    'eksekusi': 'Fase 2: Eksekusi Berkarya dengan Media Pilihan',
    'apresiasi': 'Fase 3: Finishing & Apresiasi Teman Sebaya'
  };

  document.getElementById('timer-phase-label').textContent = phaseLabels[phase] || '';
  pauseStudioTimer();
  timerSeconds = minutes * 60;
  updateTimerDisplay();
}

function updateTimerDisplay() {
  const m = Math.floor(timerSeconds / 60).toString().padStart(2, '0');
  const s = (timerSeconds % 60).toString().padStart(2, '0');
  document.getElementById('timer-display').textContent = `${m}:${s}`;
}

function startStudioTimer() {
  if (timerIsRunning) return;
  timerIsRunning = true;
  timerInterval = setInterval(() => {
    if (timerSeconds > 0) {
      timerSeconds--;
      updateTimerDisplay();
    } else {
      pauseStudioTimer();
      alert('Waktu sesi studio telah selesai! Silakan lanjut ke fase berikutnya.');
    }
  }, 1000);
}

function pauseStudioTimer() {
  timerIsRunning = false;
  clearInterval(timerInterval);
}

function resetStudioTimer() {
  pauseStudioTimer();
  timerSeconds = 15 * 60;
  updateTimerDisplay();
}

// 9. Heterogeneous Group Generator
function generateHeteroGroups() {
  const container = document.getElementById('hetero-groups-output');
  if (currentRoster.length === 0) {
    container.innerHTML = '<p class="text-xs text-red-500 italic">Rombel ini belum memiliki siswa untuk dibentuk kelompok.</p>';
    return;
  }

  const groupSize = parseInt(document.getElementById('group-size-input').value) || 4;
  const shuffled = [...currentRoster].sort(() => 0.5 - Math.random());
  const numGroups = Math.ceil(shuffled.length / groupSize);

  const groups = Array.from({ length: numGroups }, () => []);
  shuffled.forEach((student, idx) => {
    groups[idx % numGroups].push(student);
  });

  container.innerHTML = '';
  groups.forEach((grp, idx) => {
    const card = document.createElement('div');
    card.className = 'p-3.5 bg-white rounded-xl border border-atelier-border space-y-2';
    card.innerHTML = `
      <div class="flex items-center justify-between border-b border-atelier-border pb-1.5">
        <span class="font-serif font-bold text-xs text-atelier-terracotta">Kelompok Studio ${idx + 1}</span>
        <span class="font-mono text-[10px] text-atelier-inkMuted">${grp.length} Anggota</span>
      </div>
      <div class="space-y-1">
        ${grp.map(m => `
          <div class="flex justify-between items-center text-xs">
            <span class="font-medium text-atelier-ink">${m.name}</span>
            <span class="text-[10px] font-mono text-atelier-inkMuted">${m.style} · ${m.category}</span>
          </div>
        `).join('')}
      </div>
    `;
    container.appendChild(card);
  });
}

// 10. Rubrik Penilaian Autentik
function populateRubricStudentSelect(roster) {
  const select = document.getElementById('rubric-student-select');
  select.innerHTML = '<option value="" disabled selected>Pilih siswa untuk dinilai...</option>';
  roster.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = `${s.name} (${s.category} - ${s.style})`;
    select.appendChild(opt);
  });
  calculateRubricScore();
}

function calculateRubricScore() {
  const proc = parseInt(document.getElementById('input-score-process').value) || 75;
  const prod = parseInt(document.getElementById('input-score-product').value) || 80;

  document.getElementById('label-score-process').textContent = `${proc}/100`;
  document.getElementById('label-score-product').textContent = `${prod}/100`;

  const total = Math.round((proc * 0.5) + (prod * 0.5));
  document.getElementById('rubric-total-score-badge').textContent = `Skor: ${total}`;

  let predicate = 'Berkembang (Cukup)';
  if (total >= 88) predicate = 'Sangat Mahir (Istimewa)';
  else if (total >= 76) predicate = 'Mahir (Tuntas)';
  else if (total < 65) predicate = 'Perlu Bimbingan Khusus';

  document.getElementById('rubric-predicate-badge').textContent = `Predikat: ${predicate}`;
}

function setupRubricHandlers() {
  document.getElementById('rubric-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const studentId = document.getElementById('rubric-student-select').value;
    if (!studentId) {
      alert('Pilih siswa yang akan dinilai.');
      return;
    }

    const proc = parseInt(document.getElementById('input-score-process').value);
    const prod = parseInt(document.getElementById('input-score-product').value);
    const total = Math.round((proc * 0.5) + (prod * 0.5));
    const predicate = document.getElementById('rubric-predicate-badge').textContent.replace('Predikat: ', '');
    const notes = document.getElementById('rubric-notes').value.trim();

    try {
      const res = await API.saveRubric({
        student_id: studentId,
        process_score: proc,
        product_score: prod,
        total_score: total,
        predicate,
        notes
      });
      if (res && res.status === 'success') {
        alert('Penilaian rubrik autentik berhasil disimpan ke database!');
        document.getElementById('rubric-notes').value = '';
      }
    } catch (err) {
      alert('Gagal menyimpan penilaian: ' + err.message);
    }
  });
}

// 11. Kalender Akademik Seni
async function loadCalendarEvents() {
  const container = document.getElementById('calendar-events-container');
  try {
    const res = await API.getCalendar();
    if (res && res.status === 'success') {
      const events = res.data;
      document.getElementById('calendar-count-badge').textContent = `${events.length} Kegiatan`;
      container.innerHTML = '';

      if (events.length === 0) {
        container.innerHTML = '<p class="text-xs text-atelier-inkMuted italic">Belum ada agenda kegiatan.</p>';
        return;
      }

      events.forEach(ev => {
        const item = document.createElement('div');
        item.className = `p-3 rounded-xl border flex items-center justify-between gap-3 text-xs transition ${
          ev.completed ? 'bg-atelier-warm/40 border-atelier-border text-atelier-inkMuted' : 'bg-white border-atelier-border'
        }`;

        item.innerHTML = `
          <div class="flex items-center gap-3">
            <input type="checkbox" ${ev.completed ? 'checked' : ''} onchange="toggleEventStatus(${ev.id}, this.checked)"
              class="rounded accent-atelier-terracotta cursor-pointer w-4 h-4">
            <div>
              <span class="font-semibold ${ev.completed ? 'line-through text-atelier-inkMuted' : 'text-atelier-ink'}">${ev.title}</span>
              <div class="flex items-center gap-2 mt-0.5 text-[10px] font-mono text-atelier-inkMuted">
                <span>📅 ${ev.event_date}</span>
                <span>•</span>
                <span class="uppercase">${ev.type}</span>
              </div>
            </div>
          </div>
          <button onclick="deleteEvent(${ev.id})" class="text-red-500 hover:text-red-700 font-mono text-xs px-2 py-1 cursor-pointer">
            Hapus
          </button>
        `;
        container.appendChild(item);
      });
    }
  } catch (err) {
    console.error('Failed to load calendar', err);
  }
}

async function toggleEventStatus(id, completed) {
  try {
    await API.toggleCalendarEvent(id, completed);
    await loadCalendarEvents();
  } catch (err) {
    console.error(err);
  }
}

async function deleteEvent(id) {
  if (confirm('Hapus kegiatan ini dari kalender?')) {
    try {
      await API.deleteCalendarEvent(id);
      await loadCalendarEvents();
    } catch (err) {
      console.error(err);
    }
  }
}

function setupCalendarHandlers() {
  document.getElementById('calendar-add-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('cal-title').value.trim();
    const event_date = document.getElementById('cal-date').value;
    const type = document.getElementById('cal-type').value;

    if (!title || !event_date) return;

    try {
      const res = await API.addCalendarEvent({
        title,
        event_date,
        type,
        class_id: currentClass
      });
      if (res && res.status === 'success') {
        document.getElementById('cal-title').value = '';
        await loadCalendarEvents();
      }
    } catch (err) {
      alert('Gagal menambah agenda: ' + err.message);
    }
  });
}

// 12. Tautan Siswa & QR Code
function updateShareLinkAndQR() {
  const host = window.location.origin.includes('localhost') ? 'https://artuniverse.my.id' : window.location.origin;
  const link = `${host}/?class=${encodeURIComponent(currentClass)}`;

  const linkInput = document.getElementById('share-link-input');
  if (linkInput) linkInput.value = link;

  const qrImg = document.getElementById('qr-code-img');
  if (qrImg) {
    qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(link)}`;
  }

  const qrClassName = document.getElementById('qr-class-name');
  if (qrClassName) qrClassName.textContent = currentClass;
}

function copyShareLink() {
  const linkInput = document.getElementById('share-link-input');
  if (linkInput) {
    navigator.clipboard.writeText(linkInput.value).then(() => {
      alert(`Tautan untuk Kelas ${currentClass} berhasil disalin! Siap dibagikan ke WhatsApp grup kelas.`);
    });
  }
}
