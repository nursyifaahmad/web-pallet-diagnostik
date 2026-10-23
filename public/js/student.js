// Student Portal Quiz Controller for PALLET with Attendance No, Gender, Persistent Storage & Live Heartbeat
let questions = [];
let currentStepIndex = 0;
let studentName = '';
let studentAttendanceNo = '';
let studentGender = '';
let studentClass = '';
let sessionId = null;
let answers = {};

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

// Selected media state for Question 2 (null until explicitly chosen by student)
let selectedMediaCategory = null;
let selectedMediaSubOption = null;

// Debounce timer for server live progress sync
let liveSyncTimeout = null;

document.addEventListener('DOMContentLoaded', async () => {
  initSessionId();
  await initClasses();
  await loadQuestions();
  setupEventListeners();
  checkAndPromptDraft();
});

// 1. Session ID Generator
function initSessionId() {
  const existingDraft = getDraft();
  if (existingDraft && existingDraft.sessionId) {
    sessionId = existingDraft.sessionId;
  } else {
    sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
  }
}

// 2. Persistent Storage (localStorage) Helpers
const DRAFT_KEY = 'pallet_student_draft';

function getDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function saveDraft() {
  try {
    const draftData = {
      sessionId,
      studentName,
      studentAttendanceNo,
      studentGender,
      studentClass,
      currentStepIndex,
      selectedMediaCategory,
      selectedMediaSubOption,
      answers,
      lastUpdated: new Date().toISOString()
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draftData));

    // Show subtle auto-save badge
    const badge = document.getElementById('autosave-indicator');
    if (badge) {
      badge.classList.remove('hidden');
      badge.classList.add('flex');
    }

    // Trigger debounced live progress sync to server
    triggerServerLiveSync();
  } catch (e) {
    console.warn('Failed to save draft to localStorage', e);
  }
}

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch (e) {}
}

function clearDraftAndRestart() {
  clearDraft();
  location.reload();
}

// Check if draft exists and prompt user
function checkAndPromptDraft() {
  const draft = getDraft();
  if (draft && draft.studentName && draft.studentClass && Object.keys(draft.answers || {}).length > 0) {
    const banner = document.getElementById('draft-resume-banner');
    document.getElementById('draft-student-name').textContent = draft.studentName;
    document.getElementById('draft-student-att').textContent = draft.studentAttendanceNo || '-';
    document.getElementById('draft-student-class').textContent = `Kelas ${draft.studentClass}`;
    document.getElementById('draft-student-step').textContent = `Soal #${(draft.currentStepIndex || 0) + 1}`;
    banner.classList.remove('hidden');

    // Fill inputs ahead of time
    document.getElementById('student-name').value = draft.studentName;
    if (draft.studentAttendanceNo) document.getElementById('student-attendance').value = draft.studentAttendanceNo;
    if (draft.studentGender) document.getElementById('student-gender').value = draft.studentGender;
    document.getElementById('student-class').value = draft.studentClass;
  }
}

// Trigger Debounced Sync to Server (Live Monitor)
function triggerServerLiveSync() {
  if (!studentName || !studentClass) return;

  clearTimeout(liveSyncTimeout);
  liveSyncTimeout = setTimeout(async () => {
    const q = questions[currentStepIndex];
    await API.sendLiveProgress({
      sessionId,
      attendanceNo: studentAttendanceNo,
      studentName,
      gender: studentGender,
      classId: studentClass,
      currentStep: currentStepIndex + 1,
      totalSteps: questions.length || 10,
      currentCategory: q ? q.category : 'Pengisian Asesmen',
      answers
    });
  }, 1000);
}

// 3. Initialize 27 Classes
async function initClasses() {
  const select = document.getElementById('student-class');
  try {
    const res = await API.getClasses();
    if (res && res.status === 'success' && Array.isArray(res.data)) {
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

// 4. Load Questions Dynamically from API
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

// 5. Setup Events & Resume Handlers
function setupEventListeners() {
  const btnStart = document.getElementById('btn-start-quiz');
  const btnPrev = document.getElementById('btn-prev-question');
  const btnNext = document.getElementById('btn-next-question');
  const btnResume = document.getElementById('btn-resume-draft');
  const btnDiscard = document.getElementById('btn-discard-draft');

  // Resume Draft Handler
  if (btnResume) {
    btnResume.addEventListener('click', () => {
      const draft = getDraft();
      if (!draft) return;

      studentName = draft.studentName;
      studentAttendanceNo = draft.studentAttendanceNo || '';
      studentGender = draft.studentGender || '';
      studentClass = draft.studentClass;
      currentStepIndex = draft.currentStepIndex || 0;
      selectedMediaCategory = draft.selectedMediaCategory || null;
      selectedMediaSubOption = draft.selectedMediaSubOption || null;
      answers = draft.answers || {};

      document.getElementById('draft-resume-banner').classList.add('hidden');
      document.getElementById('step-identity').classList.add('hidden');
      document.getElementById('step-question').classList.remove('hidden');
      document.getElementById('quiz-progress-bar').classList.remove('hidden');

      renderCurrentQuestion();
    });
  }

  // Discard Draft Handler
  if (btnDiscard) {
    btnDiscard.addEventListener('click', () => {
      clearDraft();
      document.getElementById('draft-resume-banner').classList.add('hidden');
      document.getElementById('student-name').value = '';
      document.getElementById('student-attendance').value = '';
      document.getElementById('student-gender').value = '';
    });
  }

  // Realtime autosave for identity fields
  document.getElementById('student-name').addEventListener('input', (e) => {
    studentName = e.target.value.trim();
    saveDraft();
  });
  document.getElementById('student-attendance').addEventListener('input', (e) => {
    studentAttendanceNo = e.target.value.trim();
    saveDraft();
  });
  document.getElementById('student-gender').addEventListener('change', (e) => {
    studentGender = e.target.value;
    saveDraft();
  });
  document.getElementById('student-class').addEventListener('change', (e) => {
    studentClass = e.target.value;
    saveDraft();
  });

  // Start Quiz Handler
  btnStart.addEventListener('click', () => {
    const nameInput = document.getElementById('student-name');
    const attInput = document.getElementById('student-attendance');
    const genderInput = document.getElementById('student-gender');
    const classInput = document.getElementById('student-class');

    studentName = nameInput.value.trim();
    studentAttendanceNo = attInput.value.trim();
    studentGender = genderInput.value;
    studentClass = classInput.value;

    if (!studentName) {
      alert('Silakan tuliskan nama lengkapmu terlebih dahulu.');
      nameInput.focus();
      return;
    }
    if (!studentAttendanceNo) {
      alert('Silakan isi nomor absenmu.');
      attInput.focus();
      return;
    }
    if (!studentGender) {
      alert('Silakan pilih jenis kelamin.');
      genderInput.focus();
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
    document.getElementById('draft-resume-banner').classList.add('hidden');
    document.getElementById('step-identity').classList.add('hidden');
    document.getElementById('step-question').classList.remove('hidden');
    document.getElementById('quiz-progress-bar').classList.remove('hidden');

    currentStepIndex = 0;
    saveDraft();
    renderCurrentQuestion();
  });

  // Previous Question
  btnPrev.addEventListener('click', () => {
    if (currentStepIndex > 0) {
      saveCurrentQuestionAnswer();
      currentStepIndex--;
      saveDraft();
      renderCurrentQuestion();
    } else {
      document.getElementById('step-question').classList.add('hidden');
      document.getElementById('quiz-progress-bar').classList.add('hidden');
      document.getElementById('step-identity').classList.remove('hidden');
    }
  });

  // Next / Submit Question
  btnNext.addEventListener('click', async () => {
    if (!validateCurrentAnswer()) {
      return;
    }

    saveCurrentQuestionAnswer();
    saveDraft();

    if (currentStepIndex < questions.length - 1) {
      currentStepIndex++;
      saveDraft();
      renderCurrentQuestion();
    } else {
      await submitQuiz();
    }
  });

  // Realtime autosave for reason textarea
  document.getElementById('question-reason').addEventListener('input', () => {
    saveCurrentQuestionAnswer();
    saveDraft();
    const reasonVal = document.getElementById('question-reason').value.trim();
    if (reasonVal) {
      const q = questions[currentStepIndex];
      if (q) {
        const ans = answers[q.id];
        const isChoiceSelected = q.isMediaSelector
          ? Boolean(selectedMediaCategory && selectedMediaSubOption)
          : Boolean(ans && ans.selected && ans.selected.trim() !== '');
        if (isChoiceSelected) {
          hideValidationAlert();
        }
      }
    }
  });
}

// Helper to display & hide inline validation warning
function showValidationAlert(message) {
  const alertEl = document.getElementById('question-validation-alert');
  const msgEl = document.getElementById('question-validation-msg');
  if (alertEl && msgEl) {
    msgEl.textContent = message || 'Pertanyaan ini wajib dijawab sebelum kamu dapat melanjutkan.';
    alertEl.classList.remove('hidden');
    alertEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } else {
    alert(message);
  }
}

function hideValidationAlert() {
  const alertEl = document.getElementById('question-validation-alert');
  if (alertEl) {
    alertEl.classList.add('hidden');
  }
}

// 6. Render Question Card
function renderCurrentQuestion() {
  hideValidationAlert();
  const q = questions[currentStepIndex];
  if (!q) return;

  const total = questions.length;
  const currentNum = currentStepIndex + 1;
  const percent = Math.round((currentNum / total) * 100);

  document.getElementById('progress-step-text').textContent = `Soal ${currentNum} dari ${total}`;
  document.getElementById('progress-percent-text').textContent = `${percent}% Selesai`;
  document.getElementById('progress-fill').style.width = `${percent}%`;

  document.getElementById('question-category').textContent = q.category || `Aspek ${currentNum}`;
  document.getElementById('question-title').textContent = q.title;
  document.getElementById('question-subtitle').textContent = q.subtitle || '';
  document.getElementById('reason-label').textContent = q.reason_label || 'Tuliskan alasan atau keterangan tambahan:';

  const existingAns = answers[q.id] || {};
  document.getElementById('question-reason').value = existingAns.reason || '';

  const container = document.getElementById('question-options-container');
  container.innerHTML = '';

  if (q.isMediaSelector) {
    renderMediaSelector(container, existingAns);
  } else {
    renderStandardChoices(container, q.options || [], existingAns);
  }

  const nextLabel = document.getElementById('btn-next-label');
  if (currentStepIndex === questions.length - 1) {
    nextLabel.textContent = 'Kirim Jawaban Asesmen';
  } else {
    nextLabel.textContent = 'Lanjutkan';
  }

  window.scrollTo({ top: 80, behavior: 'smooth' });
}

// Render Media Selector (2D vs 3D and sub-options)
function renderMediaSelector(container, existingAns) {
  selectedMediaCategory = existingAns.category || selectedMediaCategory || null;
  selectedMediaSubOption = existingAns.subOption || selectedMediaSubOption || null;

  const wrapper = document.createElement('div');
  wrapper.className = 'space-y-4';

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
      selectedMediaSubOption = null; // Do NOT auto-pick sub-option; require student to choose!
      hideValidationAlert();
      saveCurrentQuestionAnswer();
      saveDraft();
      renderCurrentQuestion();
    };
    catGrid.appendChild(catBtn);
  });
  wrapper.appendChild(catGrid);

  if (selectedMediaCategory) {
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
        hideValidationAlert();
        saveCurrentQuestionAnswer();
        saveDraft();
        renderCurrentQuestion();
      };
      subList.appendChild(pill);
    });
    wrapper.appendChild(subList);
  } else {
    const hint = document.createElement('p');
    hint.className = 'text-xs text-atelier-inkMuted italic p-3 bg-atelier-warm rounded-xl border border-atelier-border text-center';
    hint.textContent = 'Pilih salah satu dimensi (2D atau 3D) di atas terlebih dahulu untuk menentukan spesifikasi media.';
    wrapper.appendChild(hint);
  }

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
      hideValidationAlert();
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
      saveCurrentQuestionAnswer();
      saveDraft();
    };
    container.appendChild(pill);
  });
}

// 7. Validation & Answer Storing (All Questions & Essay Fields Are Required)
function validateCurrentAnswer() {
  const q = questions[currentStepIndex];
  if (!q) return false;

  // 1. Validasi Pilihan Opsi / Media
  if (q.isMediaSelector) {
    if (!selectedMediaCategory) {
      showValidationAlert('Pertanyaan ini wajib dijawab: Silakan pilih salah satu dimensi karya (2D atau 3D) terlebih dahulu.');
      return false;
    }
    if (!selectedMediaSubOption) {
      showValidationAlert(`Pertanyaan ini wajib dijawab: Silakan tentukan spesifikasi media ${selectedMediaCategory} yang kamu sukai.`);
      return false;
    }
  } else {
    const ans = answers[q.id];
    if (!ans || !ans.selected || typeof ans.selected !== 'string' || ans.selected.trim() === '') {
      showValidationAlert('Pertanyaan ini wajib dijawab: Silakan pilih salah satu opsi jawaban sebelum melanjutkan.');
      return false;
    }
  }

  // 2. Validasi Pertanyaan Esai / Isian Singkat
  const reasonVal = document.getElementById('question-reason')?.value?.trim() || '';
  if (!reasonVal) {
    showValidationAlert('Pertanyaan esai/alasan refleksi ini wajib diisi sebelum kamu dapat melanjutkan ke soal berikutnya.');
    const reasonEl = document.getElementById('question-reason');
    if (reasonEl) {
      reasonEl.focus();
      reasonEl.classList.add('ring-2', 'ring-atelier-terracotta', 'border-atelier-terracotta');
      setTimeout(() => {
        reasonEl.classList.remove('ring-2', 'ring-atelier-terracotta', 'border-atelier-terracotta');
      }, 2000);
    }
    return false;
  }

  hideValidationAlert();
  return true;
}

function saveCurrentQuestionAnswer() {
  const q = questions[currentStepIndex];
  if (!q) return;

  const reason = document.getElementById('question-reason')?.value?.trim() || '';

  if (q.isMediaSelector) {
    if (selectedMediaCategory && selectedMediaSubOption) {
      answers[q.id] = {
        category: selectedMediaCategory,
        subOption: selectedMediaSubOption,
        reason: reason
      };
    } else if (answers[q.id]) {
      answers[q.id].reason = reason;
    }
  } else {
    if (answers[q.id]) {
      answers[q.id] = {
        ...answers[q.id],
        reason: reason
      };
    } else if (reason) {
      answers[q.id] = {
        reason: reason
      };
    }
  }
}

// 8. Final Quiz Submission with Comprehensive Required Check (Choices & Essay)
async function submitQuiz() {
  const btnNext = document.getElementById('btn-next-question');
  btnNext.disabled = true;
  btnNext.innerHTML = '<span>Memverifikasi Kelengkapan Jawaban...</span>';

  // 1. Double check that ALL active questions and their essay fields are answered
  for (let i = 0; i < questions.length; i++) {
    const qItem = questions[i];
    const aItem = answers[qItem.id];
    let isChoiceAnswered = false;

    if (qItem.isMediaSelector) {
      isChoiceAnswered = Boolean(aItem && aItem.category && aItem.subOption);
    } else {
      isChoiceAnswered = Boolean(aItem && aItem.selected && typeof aItem.selected === 'string' && aItem.selected.trim() !== '');
    }

    if (!isChoiceAnswered) {
      currentStepIndex = i;
      saveDraft();
      renderCurrentQuestion();
      showValidationAlert(`Pilihan opsi pada Soal #${i + 1} (${qItem.title}) belum dijawab! Semua pertanyaan asesmen wajib dijawab.`);
      btnNext.disabled = false;
      btnNext.innerHTML = '<span>Kirim Jawaban Asesmen</span>';
      return;
    }

    const hasReason = Boolean(aItem && aItem.reason && typeof aItem.reason === 'string' && aItem.reason.trim() !== '');
    if (!hasReason) {
      currentStepIndex = i;
      saveDraft();
      renderCurrentQuestion();
      showValidationAlert(`Pertanyaan esai/alasan pada Soal #${i + 1} belum diisi! Pertanyaan esai wajib diisi sebelum mengirim hasil asesmen.`);
      document.getElementById('question-reason')?.focus();
      btnNext.disabled = false;
      btnNext.innerHTML = '<span>Kirim Jawaban Asesmen</span>';
      return;
    }
  }

  btnNext.innerHTML = '<span>Menyimpan Hasil Asesmen...</span>';

  const q1Ans = (answers[questions[0]?.id]?.selected) || 'Sangat senang';
  const q2Ans = answers[questions[1]?.id] || {};
  const category = q2Ans.category || '2D';
  const subOption = q2Ans.subOption || 'Media Kering';
  const q4Ans = (answers[questions[3]?.id]?.selected) || 'Pencarian Ide Awal';

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
    sessionId,
    attendance_no: studentAttendanceNo,
    name: studentName,
    gender: studentGender,
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
      clearDraft();
      renderProfileCard(payload);
    } else {
      alert('Terjadi kendala saat menyimpan asesmen: ' + (res.message || 'Silakan coba lagi.'));
      btnNext.disabled = false;
      btnNext.textContent = 'Kirim Jawaban Asesmen';
    }
  } catch (err) {
    console.error('Submission error', err);
    clearDraft();
    renderProfileCard(payload);
  }
}

// 9. Render Personalised Artist Profile Card
function renderProfileCard(data) {
  document.getElementById('step-question').classList.add('hidden');
  document.getElementById('quiz-progress-bar').classList.add('hidden');
  document.getElementById('step-profile').classList.remove('hidden');

  const initials = data.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  document.getElementById('card-avatar').textContent = initials;
  document.getElementById('card-name').textContent = data.name;
  document.getElementById('card-class').textContent = `Kelas ${data.class_id} · Rombel Seni`;

  const genderLabel = (data.gender === 'L' || data.gender === 'Laki-laki') ? 'Laki-laki' : 'Perempuan';
  document.getElementById('card-meta').textContent = `No. Absen: ${data.attendance_no || '-'} · ${genderLabel} · Fase D (SMP)`;

  document.getElementById('card-style').textContent = data.style;
  document.getElementById('card-media').textContent = `${data.category} (${data.sub_option})`;
  document.getElementById('card-challenge').textContent = data.challenge;

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
