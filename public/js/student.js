// Student Portal Quiz Controller for PALLET
let questions = [];
let currentStepIndex = 0;
let studentName = '';
let studentClass = '';
const answers = {};

// Media sub-options mapping
const MEDIA_SUB_OPTIONS = {
  '2D': [
    { label: 'Media Kering', desc: 'Pensil grafit, pensil warna, krayon, spidol, pastel minyak' },
    { label: 'Media Basah', desc: 'Cat air (aquarel), cat akrilik, cat poster di atas kanvas/kertas tebal' },
    { label: 'Media Digital', desc: 'IbisPaint, Canva, Photoshop, menggambar di HP/tablet' }
  ],
  '3D': [
    { label: 'Lempung & Plastisin', desc: 'Modeling tanah liat, plastisin, playdough, clay' },
    { label: 'Kertas & Karton', desc: 'Origami, paper craft, quilling, konstruksi kardus' },
    { label: 'Bahan Bekas / Daur Ulang', desc: 'Botol plastik, stik es krim, kawat, kain perca, kolase limbah' }
  ]
};

// Selected media state for Question 2
let selectedMediaCategory = '2D';
let selectedMediaSubOption = 'Media Kering';

document.addEventListener('DOMContentLoaded', async () => {
  await initClasses();
  await loadQuestions();
  setupEventListeners();
});

// 1. Initialize 27 Classes
async function initClasses() {
  const select = document.getElementById('student-class');
  try {
    const res = await API.getClasses();
    if (res && res.status === 'success' && Array.isArray(res.data)) {
      // Group by grade
      const grades = [7, 8, 9];
      grades.forEach(g => {
        const roman = g === 7 ? 'VII' : g === 8 ? 'VIII' : 'IX';
        const optgroup = document.createElement('optgroup');
        optgroup.label = `Jenjang Kelas ${roman}`;
        
        res.data.filter(c => c.grade === g).forEach(c => {
          const opt = document.createElement('option');
          opt.value = c.id;
          opt.textContent = `Kelas ${c.id}`;
          optgroup.appendChild(opt);
        });
        select.appendChild(optgroup);
      });
    }
  } catch (err) {
    console.error('Failed to load classes', err);
  }

  // Check URL query param e.g. /?class=VII-A
  const urlParams = new URLSearchParams(window.location.search);
  const targetClass = urlParams.get('class');
  if (targetClass) {
    select.value = targetClass;
    studentClass = targetClass;
    const badge = document.getElementById('header-class-badge');
    badge.textContent = `Kelas: ${targetClass}`;
    badge.classList.remove('hidden');
  }
}

// 2. Load Questions Dynamically from API
async function loadQuestions() {
  try {
    const res = await API.getActiveQuestions();
    if (res && res.status === 'success') {
      questions = res.data;
    }
  } catch (err) {
    console.error('Failed to load questions', err);
  }
}

// 3. Setup Events
function setupEventListeners() {
  const btnStart = document.getElementById('btn-start-quiz');
  const btnPrev = document.getElementById('btn-prev-question');
  const btnNext = document.getElementById('btn-next-question');

  btnStart.addEventListener('click', () => {
    const nameInput = document.getElementById('student-name');
    const classInput = document.getElementById('student-class');

    studentName = nameInput.value.trim();
    studentClass = classInput.value;

    if (!studentName) {
      alert('Silakan tuliskan nama lengkapmu terlebih dahulu.');
      nameInput.focus();
      return;
    }
    if (!studentClass) {
      alert('Silakan pilih kelas rombelmu.');
      classInput.focus();
      return;
    }

    if (questions.length === 0) {
      alert('Daftar soal diagnostik belum tersedia atau sedang dimuat. Coba beberapa saat lagi.');
      return;
    }

    // Switch to quiz view
    document.getElementById('step-identity').classList.add('hidden');
    document.getElementById('step-question').classList.remove('hidden');
    document.getElementById('quiz-progress-bar').classList.remove('hidden');

    currentStepIndex = 0;
    renderCurrentQuestion();
  });

  btnPrev.addEventListener('click', () => {
    if (currentStepIndex > 0) {
      saveCurrentQuestionAnswer();
      currentStepIndex--;
      renderCurrentQuestion();
    } else {
      // Back to identity
      document.getElementById('step-question').classList.add('hidden');
      document.getElementById('quiz-progress-bar').classList.add('hidden');
      document.getElementById('step-identity').classList.remove('hidden');
    }
  });

  btnNext.addEventListener('click', async () => {
    if (!validateCurrentAnswer()) {
      return;
    }

    saveCurrentQuestionAnswer();

    if (currentStepIndex < questions.length - 1) {
      currentStepIndex++;
      renderCurrentQuestion();
    } else {
      // Final submission
      await submitQuiz();
    }
  });
}

// 4. Render Question Card
function renderCurrentQuestion() {
  const q = questions[currentStepIndex];
  if (!q) return;

  // Update Progress
  const total = questions.length;
  const currentNum = currentStepIndex + 1;
  const percent = Math.round((currentNum / total) * 100);

  document.getElementById('progress-step-text').textContent = `Soal ${currentNum} dari ${total}`;
  document.getElementById('progress-percent-text').textContent = `${percent}% Selesai`;
  document.getElementById('progress-fill').style.width = `${percent}%`;

  // Update Headers
  document.getElementById('question-category').textContent = q.category || `Aspek ${currentNum}`;
  document.getElementById('question-title').textContent = q.title;
  document.getElementById('question-subtitle').textContent = q.subtitle || '';
  document.getElementById('reason-label').textContent = q.reason_label || 'Tuliskan alasan atau keterangan tambahan:';

  // Restore previous reason if any
  const existingAns = answers[q.id] || {};
  document.getElementById('question-reason').value = existingAns.reason || '';

  // Render Options
  const container = document.getElementById('question-options-container');
  container.innerHTML = '';

  if (q.isMediaSelector) {
    renderMediaSelector(container, existingAns);
  } else {
    renderStandardChoices(container, q.options || [], existingAns);
  }

  // Update Next Button Label
  const nextLabel = document.getElementById('btn-next-label');
  if (currentStepIndex === questions.length - 1) {
    nextLabel.textContent = 'Kirim Jawaban Asesmen';
  } else {
    nextLabel.textContent = 'Lanjutkan';
  }

  // Scroll to top of card smoothly
  window.scrollTo({ top: 80, behavior: 'smooth' });
}

// Render Media Selector (2D vs 3D and sub-options)
function renderMediaSelector(container, existingAns) {
  selectedMediaCategory = existingAns.category || '2D';
  selectedMediaSubOption = existingAns.subOption || 'Media Kering';

  const wrapper = document.createElement('div');
  wrapper.className = 'space-y-4';

  // Category Switcher (2D vs 3D)
  const catGrid = document.createElement('div');
  catGrid.className = 'grid grid-cols-2 gap-3';

  ['2D', '3D'].forEach(cat => {
    const isSelected = selectedMediaCategory === cat;
    const catBtn = document.createElement('button');
    catBtn.type = 'button';
    catBtn.className = `p-4 rounded-xl border text-center transition cursor-pointer ${
      isSelected ? 'border-atelier-terracotta bg-atelier-terracottaLight ring-1 ring-atelier-terracotta' : 'border-atelier-border bg-white hover:border-atelier-borderMedium'
    }`;
    catBtn.innerHTML = `
      <span class="block font-serif font-bold text-lg text-atelier-ink">${cat} Dimensional</span>
      <span class="text-xs text-atelier-inkMuted">${cat === '2D' ? 'Gambar, Lukis, Sketsa, Digital' : 'Patung, Kriya, Relief, Kerajinan 3D'}</span>
    `;
    catBtn.onclick = () => {
      selectedMediaCategory = cat;
      selectedMediaSubOption = MEDIA_SUB_OPTIONS[cat][0].label;
      renderCurrentQuestion();
    };
    catGrid.appendChild(catBtn);
  });
  wrapper.appendChild(catGrid);

  // Sub-options list
  const subTitle = document.createElement('p');
  subTitle.className = 'text-xs font-mono font-semibold text-atelier-inkMuted uppercase tracking-wider pt-2';
  subTitle.textContent = `Pilih Spesifikasi Media ${selectedMediaCategory}:`;
  wrapper.appendChild(subTitle);

  const subList = document.createElement('div');
  subList.className = 'space-y-2';

  MEDIA_SUB_OPTIONS[selectedMediaCategory].forEach(item => {
    const isSubSelected = selectedMediaSubOption === item.label;
    const pill = document.createElement('div');
    pill.className = `option-pill ${isSubSelected ? 'selected' : ''}`;
    pill.innerHTML = `
      <div>
        <span class="block font-medium text-sm text-atelier-ink">${item.label}</span>
        <span class="text-xs text-atelier-inkMuted">${item.desc}</span>
      </div>
      <div class="w-5 h-5 rounded-full border flex items-center justify-center ${
        isSubSelected ? 'border-atelier-terracotta bg-atelier-terracotta text-white' : 'border-atelier-border'
      }">
        ${isSubSelected ? '✓' : ''}
      </div>
    `;
    pill.onclick = () => {
      selectedMediaSubOption = item.label;
      renderCurrentQuestion();
    };
    subList.appendChild(pill);
  });
  wrapper.appendChild(subList);

  container.appendChild(wrapper);
}

// Render Standard Multiple Choice Pills
function renderStandardChoices(container, optionsList, existingAns) {
  let currentSelected = existingAns.selected || '';

  optionsList.forEach((optText) => {
    const isSelected = currentSelected === optText;
    const pill = document.createElement('div');
    pill.className = `option-pill ${isSelected ? 'selected' : ''}`;
    pill.innerHTML = `
      <span class="font-medium text-sm text-atelier-ink">${optText}</span>
      <div class="w-5 h-5 rounded-full border flex items-center justify-center text-xs font-bold ${
        isSelected ? 'border-atelier-terracotta bg-atelier-terracotta text-white' : 'border-atelier-border'
      }">
        ${isSelected ? '✓' : ''}
      </div>
    `;
    pill.onclick = () => {
      currentSelected = optText;
      container.querySelectorAll('.option-pill').forEach(p => {
        p.classList.remove('selected');
        p.querySelector('div').className = 'w-5 h-5 rounded-full border flex items-center justify-center text-xs font-bold border-atelier-border';
        p.querySelector('div').textContent = '';
      });
      pill.classList.add('selected');
      pill.querySelector('div').className = 'w-5 h-5 rounded-full border flex items-center justify-center text-xs font-bold border-atelier-terracotta bg-atelier-terracotta text-white';
      pill.querySelector('div').textContent = '✓';
      answers[questions[currentStepIndex].id] = {
        ...answers[questions[currentStepIndex].id],
        selected: optText
      };
    };
    container.appendChild(pill);
  });
}

// 5. Validation & Saving Current Answer
function validateCurrentAnswer() {
  const q = questions[currentStepIndex];
  if (!q) return false;

  if (q.isMediaSelector) {
    if (!selectedMediaCategory || !selectedMediaSubOption) {
      alert('Silakan tentukan pilihan media yang kamu sukai.');
      return false;
    }
  } else {
    const ans = answers[q.id];
    if (!ans || !ans.selected) {
      alert('Silakan pilih salah satu opsi jawaban sebelum melanjutkan.');
      return false;
    }
  }
  return true;
}

function saveCurrentQuestionAnswer() {
  const q = questions[currentStepIndex];
  if (!q) return;

  const reason = document.getElementById('question-reason').value.trim();

  if (q.isMediaSelector) {
    answers[q.id] = {
      category: selectedMediaCategory,
      subOption: selectedMediaSubOption,
      reason: reason
    };
  } else {
    answers[q.id] = {
      ...answers[q.id],
      reason: reason
    };
  }
}

// 6. Final Quiz Submission
async function submitQuiz() {
  const btnNext = document.getElementById('btn-next-question');
  btnNext.disabled = true;
  btnNext.innerHTML = '<span>Menyimpan Hasil Asesmen...</span>';

  // Synthesize Key Profiling Dimensions
  // Question 1: Feeling
  const q1Ans = (answers[questions[0]?.id]?.selected) || 'Sangat senang';
  
  // Question 2: Media
  const q2Ans = answers[questions[1]?.id] || {};
  const category = q2Ans.category || '2D';
  const subOption = q2Ans.subOption || 'Media Kering';

  // Question 4: Challenge
  const q4Ans = (answers[questions[3]?.id]?.selected) || 'Pencarian Ide Awal';

  // Question 5: Learning Style
  let style = 'Visual Tutorial';
  const q5Text = answers[questions[4]?.id]?.selected || '';
  if (q5Text.includes('Visual') || q5Text.includes('gambar')) {
    style = 'Visual Tutorial';
  } else if (q5Text.includes('Kinestetik') || q5Text.includes('praktik')) {
    style = 'Kinestetik Eksploratif';
  } else if (q5Text.includes('Auditori') || q5Text.includes('demonstrasi')) {
    style = 'Auditori / Demonstrasi';
  } else if (q5Text.includes('teman') || q5Text.includes('diskusi')) {
    style = 'Sosial Kolaboratif';
  }

  const payload = {
    name: studentName,
    class_id: studentClass,
    category: category,
    sub_option: subOption,
    style: style,
    challenge: q4Ans,
    feeling: q1Ans,
    answers: answers
  };

  try {
    const res = await API.submitStudentAssessment(payload);
    if (res && res.status === 'success') {
      renderProfileCard(payload);
    } else {
      alert('Terjadi kendala saat menyimpan asesmen: ' + (res.message || 'Silakan coba lagi.'));
      btnNext.disabled = false;
      btnNext.textContent = 'Kirim Jawaban Asesmen';
    }
  } catch (err) {
    console.error('Submission error', err);
    // In case of offline/network glitch, still show the card
    renderProfileCard(payload);
  }
}

// 7. Render Personalised Artist Profile Card
function renderProfileCard(data) {
  document.getElementById('step-question').classList.add('hidden');
  document.getElementById('quiz-progress-bar').classList.add('hidden');
  document.getElementById('step-profile').classList.remove('hidden');

  // Avatar initials
  const initials = data.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  document.getElementById('card-avatar').textContent = initials;
  document.getElementById('card-name').textContent = data.name;
  document.getElementById('card-class').textContent = `Kelas ${data.class_id} · Rombel Seni`;

  // 3 Badges
  document.getElementById('card-style').textContent = data.style;
  document.getElementById('card-media').textContent = `${data.category} (${data.sub_option})`;
  document.getElementById('card-challenge').textContent = data.challenge;

  // 10 Aspects Matrix Grid
  const matrixContainer = document.getElementById('card-matrix-grid');
  matrixContainer.innerHTML = '';

  questions.forEach((q, idx) => {
    const ans = answers[q.id];
    let displayText = '-';
    if (q.isMediaSelector) {
      displayText = `${ans?.category || '2D'} - ${ans?.subOption || 'Kering'}`;
    } else {
      displayText = ans?.selected || '-';
    }

    const card = document.createElement('div');
    card.className = 'p-3 bg-atelier-warm/70 rounded-xl border border-atelier-border space-y-0.5';
    card.innerHTML = `
      <span class="block font-mono text-[10px] text-atelier-inkMuted font-bold uppercase tracking-wider">${q.category || `Aspek ${idx + 1}`}</span>
      <p class="font-medium text-xs text-atelier-ink">${displayText}</p>
      ${ans?.reason ? `<p class="text-[11px] text-atelier-inkMuted italic">"${ans.reason}"</p>` : ''}
    `;
    matrixContainer.appendChild(card);
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });
}
