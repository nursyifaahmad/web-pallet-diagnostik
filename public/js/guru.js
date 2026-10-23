// Teacher Dashboard Controller for PALLET Studio
// Platform Navigation, 9-Stage Modul PALLET, Dynamic Learning Recommendations & RPP, Rubric Gradebook & Custom Calendar

let allClassSummaries = [];
let currentGrade = 7;
let currentClass = 'VII-A';
let currentRoster = [];

// Timer State
let timerInterval = null;
let timerSeconds = 15 * 60;
let timerIsRunning = false;

// Live Monitor Polling State
let liveMonitorInterval = null;
let isLiveTabActive = false;

document.addEventListener('DOMContentLoaded', async () => {
  // Client-side authentication guard
  try {
    const authCheck = await API.checkMe();
    if (!authCheck || authCheck.status !== 'success' || !authCheck.user) {
      window.location.href = '/login/guru';
      return;
    }
  } catch (e) {
    window.location.href = '/login/guru';
    return;
  }

  setupMobileSidebarToggle();
  setupNavigation();
  setupClassSwitcher();
  await loadClassData();
  await loadQuestionsList();
  await loadCalendarEvents();
  setupRosterHandlers();
  setupQuestionModalHandlers();
  setupRubricHandlers();
  setupCalendarHandlers();

  // Start background live polling for badge counts
  startLiveMonitorPolling();

  // Default to Beranda Utama
  switchMainTab('tab-home');
});

// ========================================================
// 1. MOBILE SIDEBAR TOGGLE
// ========================================================
function setupMobileSidebarToggle() {
  const toggleBtn = document.getElementById('btn-toggle-sidebar');
  const sidebar = document.getElementById('sidebar-container');
  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('hidden');
    });
  }
}

// ========================================================
// 2. MAIN PLATFORM & 9-STAGE NAVIGATION
// ========================================================
function switchMainTab(tabId) {
  // Normalize tabId
  const cleanTabId = tabId.startsWith('nav-') ? tabId.replace('nav-', '') : tabId;
  const targetSecId = cleanTabId.replace('tab-', 'section-');

  // Hide all sections
  document.querySelectorAll('.tab-content-section').forEach(sec => sec.classList.add('hidden'));

  // Reveal target section
  const targetSec = document.getElementById(targetSecId);
  if (targetSec) {
    targetSec.classList.remove('hidden');
  }

  // Manage switcher bar: hide on home, show on other tabs
  const switcherBar = document.getElementById('class-switcher-bar');
  if (switcherBar) {
    if (cleanTabId === 'tab-home') {
      switcherBar.classList.add('hidden');
    } else {
      switcherBar.classList.remove('hidden');
    }
  }

  // Reset all platform nav buttons styling
  document.querySelectorAll('.platform-nav-btn').forEach(btn => {
    btn.classList.remove('bg-[#F3E8FF]', 'text-[#1E1B4B]', 'font-bold', 'shadow-xs', 'bg-atelier-terracottaLight', 'text-atelier-terracotta', 'border', 'border-atelier-terracotta/30');
    btn.classList.add('text-slate-700', 'font-semibold');
    const arrow = btn.querySelector('.nav-arrow');
    if (arrow) {
      arrow.classList.remove('text-[#8B5CF6]', 'text-atelier-terracotta');
      arrow.classList.add('text-slate-400');
    }
  });

  // Highlight active button
  const activeBtn = document.getElementById(`nav-${cleanTabId}`);
  if (activeBtn) {
    activeBtn.classList.remove('text-slate-700', 'font-semibold', 'text-atelier-ink', 'font-medium');
    activeBtn.classList.add('bg-[#F3E8FF]', 'text-[#1E1B4B]', 'font-bold', 'shadow-xs');
    const arrow = activeBtn.querySelector('.nav-arrow');
    if (arrow) {
      arrow.classList.remove('text-slate-400', 'text-atelier-inkMuted');
      arrow.classList.add('text-[#8B5CF6]');
    }
  }

  // Close sidebar on mobile after clicking
  const sidebar = document.getElementById('sidebar-container');
  if (sidebar && window.innerWidth < 1024) {
    sidebar.classList.add('hidden');
  }

  isLiveTabActive = (cleanTabId === 'tab-m9-tracking');

  // Tab-specific refreshes
  if (cleanTabId === 'tab-home') {
    updateHeroLivePreview(currentRoster);
  } else if (cleanTabId === 'tab-jenjang') {
    renderJenjangMatrix(allClassSummaries);
  } else if (cleanTabId === 'tab-m1-diagnostik') {
    loadQuestionsList();
    updateShareLinkAndQR();
  } else if (cleanTabId === 'tab-m2-profile') {
    populateProfileStudentSelect();
    renderSelectedStudentProfile();
  } else if (cleanTabId === 'tab-m3-analysis') {
    renderHeatmap(currentRoster);
  } else if (cleanTabId === 'tab-m4-roster') {
    renderRosterTable(currentRoster);
  } else if (cleanTabId === 'tab-m5-recommendation') {
    renderLearningRecommendations(currentRoster);
  } else if (cleanTabId === 'tab-m6-rpp') {
    const grade = currentClass.split('-')[0] || 'VII';
    const timeInput = document.getElementById('rpp-target-time-input');
    if (timeInput && (!timeInput.value || timeInput.value.includes('Kelas'))) {
      timeInput.value = `Kelas ${grade} (2 x 45 Menit / 1 Pertemuan)`;
    }
    if (isModulAjarGenerated) {
      generateModulAjarText();
    }
  } else if (cleanTabId === 'tab-m7-studio') {
    loadCalendarEvents();
  } else if (cleanTabId === 'tab-m8-rubric') {
    loadClassRubricGradebook(currentClass);
    populateRubricStudentSelect(currentRoster);
  } else if (cleanTabId === 'tab-m9-tracking') {
    fetchLiveMonitorData();
    loadClassPortfolios(currentClass);
  } else if (cleanTabId === 'tab-class-dash') {
    updateClassStats(currentRoster);
  }
}

// Dropdown toggle for Kelas Aktif in Navbar
function toggleNavClassDropdown(event) {
  if (event) event.stopPropagation();
  const menu = document.getElementById('nav-class-dropdown-menu');
  if (!menu) return;
  const isHidden = menu.classList.contains('hidden');
  if (isHidden) {
    renderNavClassDropdownItems();
    menu.classList.remove('hidden');
  } else {
    menu.classList.add('hidden');
  }
}

// Dropdown toggle for Akses / Mode in Navbar
function toggleModeDropdown(event) {
  if (event) event.stopPropagation();
  const menu = document.getElementById('mode-dropdown-menu');
  if (!menu) return;
  menu.classList.toggle('hidden');
}

// Close dropdowns when clicking outside
window.addEventListener('click', (e) => {
  const classMenu = document.getElementById('nav-class-dropdown-menu');
  const classBtn = document.getElementById('navbar-class-picker-btn');
  if (classMenu && !classMenu.classList.contains('hidden')) {
    if (!classMenu.contains(e.target) && (!classBtn || !classBtn.contains(e.target))) {
      classMenu.classList.add('hidden');
    }
  }

  const modeMenu = document.getElementById('mode-dropdown-menu');
  const modeBtn = document.getElementById('btn-mode-dropdown');
  if (modeMenu && !modeMenu.classList.contains('hidden')) {
    if (!modeMenu.contains(e.target) && (!modeBtn || !modeBtn.contains(e.target))) {
      modeMenu.classList.add('hidden');
    }
  }
});

function renderNavClassDropdownItems() {
  const container = document.getElementById('nav-class-dropdown-items');
  if (!container) return;

  const grades = [
    { grade: 7, roman: 'VII' },
    { grade: 8, roman: 'VIII' },
    { grade: 9, roman: 'IX' }
  ];
  const sections = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];

  let html = '';
  grades.forEach(g => {
    html += `
      <div>
        <span class="block text-[10px] font-mono font-bold text-slate-400 mb-1">Kelas ${g.roman}</span>
        <div class="grid grid-cols-5 gap-1 font-mono text-[11px]">
          ${sections.map(s => {
            const classId = `${g.roman}-${s}`;
            const isSelected = classId === currentClass;
            return `
              <button onclick="selectClass('${classId}'); toggleNavClassDropdown();" 
                class="px-2 py-1 rounded-lg text-center transition font-semibold cursor-pointer ${
                  isSelected 
                    ? 'bg-[#6366F1] text-white shadow-xs' 
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }">
                ${s}
              </button>
            `;
          }).join('')}
        </div>
      </div>
    `;
  });
  container.innerHTML = html;
}

function updateHeroLivePreview(roster) {
  const studentsCountEl = document.getElementById('hero-stat-students');
  if (studentsCountEl) {
    studentsCountEl.textContent = roster ? roster.length : 0;
  }

  const avatarEl = document.getElementById('hero-preview-avatar');
  const nameEl = document.getElementById('hero-preview-name');
  const subEl = document.getElementById('hero-preview-sub');
  const idEl = document.getElementById('hero-preview-id');
  const styleEl = document.getElementById('hero-preview-style');
  const mediaEl = document.getElementById('hero-preview-media');
  const ideaEl = document.getElementById('hero-preview-idea');
  const quoteEl = document.getElementById('hero-preview-quote');

  if (!avatarEl) return;

  if (roster && roster.length > 0) {
    const student = roster[0];
    const initials = student.name ? student.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() : 'ST';
    avatarEl.textContent = initials;
    nameEl.textContent = student.name;
    subEl.textContent = `Kelas ${currentClass} · Seni Rupa`;
    idEl.textContent = `ID: ${currentClass}-${String(student.attendance_no || 1).padStart(2, '0')}`;
    styleEl.textContent = student.style || 'Visual Tutorial';
    mediaEl.textContent = `${student.category || '2D'} (${student.sub_option || 'Kering'})`;
    ideaEl.textContent = student.challenge || 'Sketsa Proporsi';
    quoteEl.textContent = `“Rekomendasi Guru: Berikan contoh sketsa proporsi awal & tutorial gambar digital.”`;
  } else {
    avatarEl.textContent = 'BE';
    nameEl.textContent = 'Belum Ada Data';
    subEl.textContent = `Kelas ${currentClass} · Seni Rupa`;
    idEl.textContent = `ID: ${currentClass}-01`;
    styleEl.textContent = 'Visual Tutorial';
    mediaEl.textContent = '2D (Drawing)';
    ideaEl.textContent = 'Sketsa Proporsi';
    quoteEl.textContent = '“Rekomendasi Guru: Berikan contoh sketsa proporsi awal & tutorial gambar digital.”';
  }
}

// Sub-Tab switcher for Tahap 1: Digital Diagnostik (CRUD vs Share Link)
function switchM1SubTab(subTab) {
  const btnCrud = document.getElementById('btn-m1-crud');
  const btnShare = document.getElementById('btn-m1-share');
  const contentCrud = document.getElementById('m1-content-crud');
  const contentShare = document.getElementById('m1-content-share');

  if (subTab === 'crud') {
    btnCrud.className = 'px-4 py-2 rounded-xl text-xs font-semibold bg-atelier-terracotta text-white transition cursor-pointer';
    btnShare.className = 'px-4 py-2 rounded-xl text-xs font-semibold bg-atelier-warm text-atelier-ink hover:bg-atelier-border transition cursor-pointer';
    contentCrud.classList.remove('hidden');
    contentShare.classList.add('hidden');
  } else {
    btnShare.className = 'px-4 py-2 rounded-xl text-xs font-semibold bg-atelier-terracotta text-white transition cursor-pointer';
    btnCrud.className = 'px-4 py-2 rounded-xl text-xs font-semibold bg-atelier-warm text-atelier-ink hover:bg-atelier-border transition cursor-pointer';
    contentCrud.classList.add('hidden');
    contentShare.classList.remove('hidden');
    updateShareLinkAndQR();
  }
}

function setupNavigation() {
  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      if (confirm('Apakah Anda yakin ingin keluar dari Studio Guru?')) {
        await API.logout();
        window.location.href = '/login/guru';
      }
    });
  }

  const btnExport = document.getElementById('btn-export-excel');
  if (btnExport) {
    btnExport.addEventListener('click', () => {
      window.location.href = `/api/export/excel?class=${encodeURIComponent(currentClass)}`;
    });
  }
}

// ========================================================
// 3. CLASS SWITCHER (27 Classes: VII A-I, VIII A-I, IX A-I)
// ========================================================
const SECTIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];

function switchGradeTab(grade) {
  currentGrade = grade;
  document.querySelectorAll('.grade-tab-btn').forEach(btn => {
    btn.classList.remove('bg-atelier-terracotta', 'text-white');
    btn.classList.add('bg-atelier-warm', 'text-atelier-ink');
  });
  const activeBtn = document.getElementById(`tab-grade-${grade}`);
  if (activeBtn) {
    activeBtn.classList.remove('bg-atelier-warm', 'text-atelier-ink');
    activeBtn.classList.add('bg-atelier-terracotta', 'text-white');
  }
  renderSectionButtons();
}

function renderSectionButtons() {
  const container = document.getElementById('section-buttons-container');
  if (!container) return;
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

  // Sync grade tabs visually
  document.querySelectorAll('.grade-tab-btn').forEach(btn => {
    btn.classList.remove('bg-atelier-terracotta', 'text-white');
    btn.classList.add('bg-atelier-warm', 'text-atelier-ink');
  });
  const activeGradeBtn = document.getElementById(`tab-grade-${currentGrade}`);
  if (activeGradeBtn) {
    activeGradeBtn.classList.remove('bg-atelier-warm', 'text-atelier-ink');
    activeGradeBtn.classList.add('bg-atelier-terracotta', 'text-white');
  }

  // Update labels across all sections
  const updateLabel = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  updateLabel('active-class-badge', currentClass);
  updateLabel('nav-active-class-text', currentClass);
  updateLabel('dash-class-title', currentClass);
  updateLabel('quick-add-class-label', currentClass);
  updateLabel('roster-class-title', currentClass);
  updateLabel('heatmap-class-title', currentClass);
  updateLabel('profile-class-title', currentClass);
  updateLabel('recom-class-title', currentClass);
  updateLabel('modul-class-name', currentClass);
  updateLabel('share-class-badge', currentClass);
  updateLabel('qr-class-name', currentClass);
  updateLabel('rubric-gradebook-class', currentClass);
  updateLabel('live-class-label', currentClass);
  updateLabel('live-table-class-title', currentClass);

  renderSectionButtons();
  await loadCurrentClassDetail();
  updateShareLinkAndQR();
  fetchLiveMonitorData();
  loadClassRubricGradebook(currentClass);
}

// ========================================================
// 4. LOAD CLASS DATA & CURRENT CLASS DETAIL
// ========================================================
async function loadClassData() {
  try {
    const res = await API.getClasses();
    if (res && res.status === 'success') {
      allClassSummaries = res.data;
      renderJenjangMatrix(allClassSummaries);
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
      populateProfileStudentSelect();
      renderSelectedStudentProfile();
      renderLearningRecommendations(currentRoster);
      const grade = currentClass.split('-')[0] || 'VII';
      const timeInput = document.getElementById('rpp-target-time-input');
      if (timeInput && (!timeInput.value || timeInput.value.includes('Kelas'))) {
        timeInput.value = `Kelas ${grade} (2 x 45 Menit / 1 Pertemuan)`;
      }
      if (isModulAjarGenerated) {
        generateModulAjarText();
      }
      populateRubricStudentSelect(currentRoster);
      updateHeroLivePreview(currentRoster);
      loadClassPortfolios(currentClass);
    }
  } catch (err) {
    console.error('Failed to load class detail', err);
  }
}

function updateClassStats(roster) {
  const statTotal = document.getElementById('stat-total-students');
  if (statTotal) statTotal.textContent = `${roster ? roster.length : 0} Siswa`;

  const dashStatTotal = document.getElementById('dash-stat-total');
  if (dashStatTotal) dashStatTotal.textContent = roster ? roster.length : 0;

  const dashRosterClass = document.getElementById('dash-roster-class-name');
  if (dashRosterClass) dashRosterClass.textContent = currentClass;

  const dashClassTitle = document.getElementById('dash-class-title');
  if (dashClassTitle) dashClassTitle.textContent = currentClass;

  const dashShareClass = document.getElementById('dash-share-class-badge');
  if (dashShareClass) dashShareClass.textContent = currentClass;

  renderDashMiniCalendar();
  renderDashRosterTable(roster);

  if (!roster || roster.length === 0) {
    const elDom = document.getElementById('stat-dominant-style');
    const elMedia = document.getElementById('stat-top-media');
    if (elDom) elDom.textContent = '-';
    if (elMedia) elMedia.textContent = '-';

    const dashDom = document.getElementById('dash-stat-dominant');
    if (dashDom) dashDom.textContent = 'Visual Tutorial';

    const dashRatio = document.getElementById('dash-stat-media-ratio');
    if (dashRatio) dashRatio.textContent = '2D (0%) vs 3D (100%)';

    const dashVisualPct = document.getElementById('dash-dist-visual-pct');
    const dashVisualBar = document.getElementById('dash-dist-visual-bar');
    if (dashVisualPct) dashVisualPct.textContent = '60%';
    if (dashVisualBar) dashVisualBar.style.width = '60%';

    const dashKinPct = document.getElementById('dash-dist-kinesthetic-pct');
    const dashKinBar = document.getElementById('dash-dist-kinesthetic-bar');
    if (dashKinPct) dashKinPct.textContent = '25%';
    if (dashKinBar) dashKinBar.style.width = '25%';

    const dash2dPct = document.getElementById('dash-dist-2d-pct');
    const dash2dBar = document.getElementById('dash-dist-2d-bar');
    if (dash2dPct) dash2dPct.textContent = '0%';
    if (dash2dBar) dash2dBar.style.width = '0%';

    const dash3dPct = document.getElementById('dash-dist-3d-pct');
    const dash3dBar = document.getElementById('dash-dist-3d-bar');
    if (dash3dPct) dash3dPct.textContent = '100%';
    if (dash3dBar) dash3dBar.style.width = '100%';
    return;
  }

  // If roster has students, compute real metrics
  const styles = {};
  let count2D = 0;
  let count3D = 0;
  let countVisual = 0;
  let countKinesthetic = 0;

  roster.forEach(s => {
    styles[s.style] = (styles[s.style] || 0) + 1;
    const cat = (s.category || '').toUpperCase();
    if (cat.includes('3D')) {
      count3D++;
    } else {
      count2D++;
    }

    const st = (s.style || '').toLowerCase();
    if (st.includes('visual') || st.includes('tutorial')) countVisual++;
    if (st.includes('kinestetik') || st.includes('hands-on')) countKinesthetic++;
  });

  const dominantStyle = Object.entries(styles).sort((a,b) => b[1] - a[1])[0]?.[0] || 'Visual Tutorial';
  const topMedia = count3D >= count2D ? '3D' : '2D';

  const pct2D = Math.round((count2D / roster.length) * 100);
  const pct3D = 100 - pct2D;

  const pctVisual = Math.round((countVisual / roster.length) * 100) || 60;
  const pctKinesthetic = Math.round((countKinesthetic / roster.length) * 100) || 25;

  const elDom = document.getElementById('stat-dominant-style');
  const elMedia = document.getElementById('stat-top-media');
  if (elDom) elDom.textContent = dominantStyle;
  if (elMedia) elMedia.textContent = topMedia;

  const dashDom = document.getElementById('dash-stat-dominant');
  if (dashDom) dashDom.textContent = dominantStyle;

  const dashRatio = document.getElementById('dash-stat-media-ratio');
  if (dashRatio) dashRatio.textContent = `2D (${pct2D}%) vs 3D (${pct3D}%)`;

  const dashVisualPct = document.getElementById('dash-dist-visual-pct');
  const dashVisualBar = document.getElementById('dash-dist-visual-bar');
  if (dashVisualPct) dashVisualPct.textContent = `${pctVisual}%`;
  if (dashVisualBar) dashVisualBar.style.width = `${pctVisual}%`;

  const dashKinPct = document.getElementById('dash-dist-kinesthetic-pct');
  const dashKinBar = document.getElementById('dash-dist-kinesthetic-bar');
  if (dashKinPct) dashKinPct.textContent = `${pctKinesthetic}%`;
  if (dashKinBar) dashKinBar.style.width = `${pctKinesthetic}%`;

  const dash2dPct = document.getElementById('dash-dist-2d-pct');
  const dash2dBar = document.getElementById('dash-dist-2d-bar');
  if (dash2dPct) dash2dPct.textContent = `${pct2D}%`;
  if (dash2dBar) dash2dBar.style.width = `${pct2D}%`;

  const dash3dPct = document.getElementById('dash-dist-3d-pct');
  const dash3dBar = document.getElementById('dash-dist-3d-bar');
  if (dash3dPct) dash3dPct.textContent = `${pct3D}%`;
  if (dash3dBar) dash3dBar.style.width = `${pct3D}%`;
}

// Mini Calendar for Dashboard Kelas Aktif
function renderDashMiniCalendar() {
  const container = document.getElementById('dash-mini-calendar-grid');
  if (!container) return;

  // Matching screenshot: 2 leading empty/dots, days 1 to 31
  // Dates 5 (purple), 18 (pink), 26 (teal)
  let html = '';
  html += `<span class="py-1 text-slate-300">·</span>`;
  html += `<span class="py-1 text-slate-300">·</span>`;

  for (let day = 1; day <= 31; day++) {
    if (day === 5) {
      html += `<span class="w-6 h-6 mx-auto flex items-center justify-center rounded-lg bg-[#6366F1] text-white font-bold shadow-xs">${day}</span>`;
    } else if (day === 18) {
      html += `<span class="w-6 h-6 mx-auto flex items-center justify-center rounded-lg bg-[#EC4899] text-white font-bold shadow-xs">${day}</span>`;
    } else if (day === 26) {
      html += `<span class="w-6 h-6 mx-auto flex items-center justify-center rounded-lg bg-[#0D9488] text-white font-bold shadow-xs">${day}</span>`;
    } else {
      html += `<span class="py-1 text-slate-700">${day}</span>`;
    }
  }

  container.innerHTML = html;
}

// Roster Table in Dashboard Kelas Aktif
function renderDashRosterTable(roster) {
  const tbody = document.getElementById('dash-roster-table-body');
  if (!tbody) return;

  if (!roster || roster.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="py-10 text-center text-xs text-slate-400 italic">
          Belum ada siswa terdaftar di kelas ${currentClass}.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = roster.map(s => {
    const is3D = (s.category || '').toUpperCase().includes('3D');
    const catBadge = is3D 
      ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-pink-50 text-pink-700 border border-pink-200">3D</span>`
      : `<span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">2D</span>`;

    const initials = s.name ? s.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() : 'ST';

    return `
      <tr class="hover:bg-slate-50/80 transition group">
        <td class="py-2.5 px-3">
          <div class="flex items-center gap-2.5">
            <span class="w-7 h-7 rounded-lg ${is3D ? 'bg-pink-100 text-pink-700' : 'bg-indigo-100 text-indigo-700'} font-bold text-[11px] flex items-center justify-center flex-shrink-0">
              ${initials}
            </span>
            <div>
              <span class="font-bold text-slate-800 text-xs block">${s.name}</span>
              <span class="text-[10px] font-mono text-slate-400">Absen ${s.attendance_no || '-'} · ${s.gender || '-'}</span>
            </div>
          </div>
        </td>
        <td class="py-2.5 px-3">${catBadge}</td>
        <td class="py-2.5 px-3 font-mono text-[11px] text-slate-600">${s.sub_option || 'Kering'}</td>
        <td class="py-2.5 px-3 text-right">
          <button onclick="selectStudentForProfile(${s.id})" class="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-white text-slate-700 font-semibold text-[11px] shadow-2xs transition cursor-pointer">
            Detail →
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function filterDashRosterTable(query) {
  const q = (query || '').toLowerCase().trim();
  if (!currentRoster) return;
  const filtered = currentRoster.filter(s => 
    s.name.toLowerCase().includes(q) || 
    String(s.attendance_no).includes(q) ||
    (s.sub_option && s.sub_option.toLowerCase().includes(q))
  );
  renderDashRosterTable(filtered);
}

function selectStudentForProfile(studentId) {
  switchMainTab('tab-m2-profile');
  const sel = document.getElementById('profile-student-select');
  if (sel) {
    sel.value = studentId;
    renderSelectedStudentProfile();
  }
}

function copyDashShareLink() {
  const host = window.location.origin.includes('localhost') ? 'https://artuniverse.my.id' : window.location.origin;
  const link = `${host}/?class=${encodeURIComponent(currentClass)}`;
  navigator.clipboard.writeText(link).then(() => {
    alert(`Link asesmen siswa untuk kelas ${currentClass} berhasil disalin:\n${link}`);
  }).catch(() => {
    prompt('Salin tautan pengerjaan siswa berikut:', link);
  });
}

function showDashQrModal() {
  switchMainTab('tab-m1-diagnostik');
  switchM1SubTab('share');
}

// ========================================================
// 5. PEMETAAN JENJANG (27-ROMBEL MATRIX)
// ========================================================
function renderJenjangMatrix(summaries) {
  const container = document.getElementById('jenjang-matrix-container');
  if (!container) return;
  container.innerHTML = '';

  const grades = [
    { num: 7, roman: 'VII', label: 'Jenjang Kelas VII (Fase D Awal)' },
    { num: 8, roman: 'VIII', label: 'Jenjang Kelas VIII (Fase D Lanjutan)' },
    { num: 9, roman: 'IX', label: 'Jenjang Kelas IX (Fase D Mahir)' }
  ];

  // Map summaries by class_id
  const summaryMap = {};
  if (Array.isArray(summaries)) {
    summaries.forEach(c => {
      summaryMap[c.class_id] = c;
    });
  }

  grades.forEach(g => {
    const block = document.createElement('div');
    block.className = 'p-5 bg-white rounded-2xl border border-atelier-border space-y-3';

    block.innerHTML = `
      <div class="flex items-center justify-between border-b border-atelier-border pb-2.5">
        <div class="flex items-center gap-2">
          <span class="w-7 h-7 rounded-lg bg-atelier-terracotta text-white font-serif font-black flex items-center justify-center text-xs">
            ${g.roman}
          </span>
          <h4 class="font-serif font-bold text-base text-atelier-ink">${g.label}</h4>
        </div>
        <span class="font-mono text-xs text-atelier-inkMuted">9 Rombel (A s.d I)</span>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-2.5 pt-1" id="jenjang-grid-${g.num}">
      </div>
    `;

    container.appendChild(block);

    const grid = block.querySelector(`#jenjang-grid-${g.num}`);
    SECTIONS.forEach(sec => {
      const classId = `${g.roman}-${sec}`;
      const data = summaryMap[classId] || { student_count: 0 };
      const count = data.student_count || 0;
      const isCurrent = currentClass === classId;

      let badgeColor = 'bg-gray-100 text-gray-600 border-gray-200';
      let statusText = 'Kosong';
      if (count >= 20) {
        badgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-300';
        statusText = 'Lengkap';
      } else if (count > 0) {
        badgeColor = 'bg-amber-100 text-amber-800 border-amber-300';
        statusText = 'Sebagian';
      }

      const card = document.createElement('div');
      card.className = `p-3 rounded-xl border transition cursor-pointer text-center space-y-1 hover:shadow-md ${
        isCurrent ? 'border-atelier-terracotta bg-atelier-terracottaLight ring-2 ring-atelier-terracotta/40' : 'border-atelier-border bg-atelier-warm/30 hover:bg-white'
      }`;
      card.onclick = () => {
        selectClass(classId);
        switchMainTab('tab-class-dash');
      };

      card.innerHTML = `
        <span class="font-mono font-bold text-sm block ${isCurrent ? 'text-atelier-terracotta' : 'text-atelier-ink'}">${classId}</span>
        <span class="font-serif font-black text-lg block text-atelier-ink">${count}</span>
        <span class="text-[10px] block font-mono text-atelier-inkMuted">Siswa</span>
        <span class="inline-block px-1.5 py-0.2 text-[9px] font-mono font-bold rounded border ${badgeColor}">
          ${statusText}
        </span>
      `;
      grid.appendChild(card);
    });
  });
}

// ========================================================
// 6. STUDENT ART PROFILE (TAHAP 2)
// ========================================================
function populateProfileStudentSelect() {
  const select = document.getElementById('profile-student-select');
  if (!select) return;

  const currentVal = select.value;
  select.innerHTML = '<option value="" disabled selected>Pilih siswa rombel...</option>';

  currentRoster.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = `No. ${s.attendance_no || '-'} · ${s.name} (${s.gender || '-'})`;
    select.appendChild(opt);
  });

  if (currentVal && currentRoster.some(s => s.id == currentVal)) {
    select.value = currentVal;
  } else if (currentRoster.length > 0) {
    select.value = currentRoster[0].id;
  }
}

function renderSelectedStudentProfile() {
  const select = document.getElementById('profile-student-select');
  const container = document.getElementById('student-art-card-display');
  if (!select || !container) return;

  const studentId = select.value;
  const student = currentRoster.find(s => s.id == studentId);

  if (!student) {
    container.innerHTML = `
      <div class="p-8 text-center text-atelier-inkMuted italic bg-atelier-warm/30 rounded-2xl border border-atelier-border">
        Belum ada siswa dipilih atau rombel kelas ini masih kosong. Silakan tambahkan siswa atau pilih dari dropdown di atas.
      </div>
    `;
    return;
  }

  // Determine artistic archetype
  let archetype = 'Ilustrator Visual';
  let archetypeDesc = 'Memiliki kepekaan estetika visual yang tinggi dan nyaman bekerja dengan instruksi berbasis gambar dan demonstrasi karya.';
  if (student.category === '3D') {
    archetype = 'Eksplorator Tiga Dimensi';
    archetypeDesc = 'Sangat antusias mengolah bentuk ruang, tekstur fisik material, dan konstruksi media plastis maupun bahan daur ulang.';
  } else if (student.style && student.style.includes('Kinestetik')) {
    archetype = 'Artisan Taktil & Eksperimental';
    archetypeDesc = 'Menemukan ide terbaik melalui trial and error langsung pada material dan kebebasan mengekspresikan teknik fisik.';
  } else if (student.style && student.style.includes('Kolaboratif')) {
    archetype = 'Komunikator Artistik Komunal';
    archetypeDesc = 'Sangat hidup saat berdiskusi, bertukar gagasan kreatif dengan rekan kelompok, dan menyusun karya interaktif.';
  }

  const genderLabel = student.gender === 'L' ? 'Laki-laki (L)' : student.gender === 'P' ? 'Perempuan (P)' : 'Tidak ditentukan';

  container.innerHTML = `
    <div class="atelier-card p-6 bg-gradient-to-br from-white via-atelier-warm/30 to-atelier-terracottaLight/20 border border-atelier-border space-y-6">
      
      <!-- Top Header Profile -->
      <div class="flex flex-wrap items-start justify-between gap-4 border-b border-atelier-border pb-4">
        <div class="flex items-center gap-4">
          <div class="w-16 h-16 rounded-2xl bg-atelier-terracotta text-white flex items-center justify-center font-serif font-black text-2xl shadow-md">
            ${student.name.charAt(0)}
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span class="px-2 py-0.5 rounded font-mono font-bold text-xs bg-atelier-terracotta text-white">
                No. Absen ${student.attendance_no || '-'}
              </span>
              <span class="font-mono text-xs text-atelier-inkMuted">Kelas ${currentClass}</span>
              <span class="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-atelier-warm text-atelier-ink border border-atelier-border">
                ${genderLabel}
              </span>
            </div>
            <h3 class="font-serif font-black text-2xl text-atelier-ink mt-1">${student.name}</h3>
            <p class="font-mono text-xs text-atelier-terracotta font-bold mt-0.5">Arketipe: ${archetype}</p>
          </div>
        </div>

        <div class="flex items-center gap-2 no-print">
          <button onclick="window.print()" class="px-3 py-1.5 border border-atelier-border hover:bg-white rounded-xl text-xs font-medium transition cursor-pointer">
            🖨️ Cetak Kartu Profil
          </button>
        </div>
      </div>

      <!-- 4 Core Profile Dimensions -->
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
        <div class="p-4 bg-white rounded-xl border border-atelier-border space-y-1">
          <span class="block font-mono text-[10px] text-atelier-inkMuted uppercase">Gaya Belajar Diagnostik</span>
          <strong class="font-serif font-bold text-sm text-atelier-terracotta block">${student.style || 'Visual Tutorial'}</strong>
          <span class="text-[11px] text-atelier-inkMuted">Pendekatan pemahaman materi ajar</span>
        </div>

        <div class="p-4 bg-white rounded-xl border border-atelier-border space-y-1">
          <span class="block font-mono text-[10px] text-atelier-inkMuted uppercase">Pilihan Media Karya</span>
          <strong class="font-serif font-bold text-sm text-atelier-ochre block">${student.category || '2D'} (${student.sub_option || 'Kering'})</strong>
          <span class="text-[11px] text-atelier-inkMuted">Fokus eksplorasi alat & bahan</span>
        </div>

        <div class="p-4 bg-white rounded-xl border border-atelier-border space-y-1">
          <span class="block font-mono text-[10px] text-atelier-inkMuted uppercase">Tantangan Utama</span>
          <strong class="font-serif font-bold text-sm text-atelier-ultramarine block">${student.challenge || 'Sketsa Proporsi'}</strong>
          <span class="text-[11px] text-atelier-inkMuted">Area pendampingan (scaffolding)</span>
        </div>

        <div class="p-4 bg-white rounded-xl border border-atelier-border space-y-1">
          <span class="block font-mono text-[10px] text-atelier-inkMuted uppercase">Kondisi Afektif / Emosi</span>
          <strong class="font-serif font-bold text-sm text-atelier-sage block">😊 ${student.feeling || 'Senang & Antusias'}</strong>
          <span class="text-[11px] text-atelier-inkMuted">Kesiapan psikologis berkarya</span>
        </div>
      </div>

      <!-- Persona Description & Custom Guidance -->
      <div class="p-4 bg-white rounded-xl border border-atelier-border text-xs space-y-2">
        <strong class="font-serif font-bold text-sm text-atelier-ink block">Karakteristik Seniman Muda:</strong>
        <p class="text-atelier-ink leading-relaxed">${archetypeDesc}</p>
        <div class="p-3 bg-atelier-warm/40 rounded-lg text-atelier-inkMuted text-[11px] leading-relaxed">
          <strong class="text-atelier-ink">Rekomendasi Pemantik Studio:</strong> Sediakan bahan referensi sesuai preferensi ${student.category || '2D'} dan fasilitasi bimbingan bertahap pada tantangan ${student.challenge || 'sketsa'}.
        </div>
      </div>

    </div>
  `;
}

// ========================================================
// 7. DYNAMIC LEARNING RECOMMENDATION (TAHAP 5)
// ========================================================
function renderLearningRecommendations(roster) {
  const elTitle = document.getElementById('recom-class-title');
  if (elTitle) elTitle.textContent = currentClass;

  const dynKonten = document.getElementById('dyn-recom-konten');
  const dynProses = document.getElementById('dyn-recom-proses');
  const dynProduk = document.getElementById('dyn-recom-produk');
  const dynStudio = document.getElementById('dyn-recom-studio');

  if (!roster || roster.length === 0) {
    if (dynKonten) dynKonten.textContent = 'Sediakan pilihan media referensi: Video tutorial langkah demi langkah untuk 2D Digital & contoh fisik karya 3D untuk peminat Kinestetik.';
    if (dynProses) dynProses.textContent = 'Bentuk kelompok heterogen (3–4 orang). Pasangkan siswa peminat 2D Drawing dengan siswa peminat 3D Patung/Kriya.';
    if (dynProduk) dynProduk.textContent = 'Beri kebebasan produk akhir: Siswa dapat memilih membuat karya 2D ATAU karya 3D sesuai dengan sub-minat diagnostik mereka.';
    if (dynStudio) dynStudio.textContent = 'Atur tata letak meja studio menjadi zona kerja heterogen terpisah: Zona Meja Gambar Kering 2D dan Zona Meja Basah / 3D.';
    return;
  }

  const total = roster.length;

  // 1. Tally styles
  const styles = {};
  const media = {};
  const challenges = {};
  let maleCount = 0;
  let femaleCount = 0;

  roster.forEach(s => {
    styles[s.style || 'Visual Tutorial'] = (styles[s.style || 'Visual Tutorial'] || 0) + 1;
    media[s.category || '2D'] = (media[s.category || '2D'] || 0) + 1;
    challenges[s.challenge || 'Sketsa Proporsi'] = (challenges[s.challenge || 'Sketsa Proporsi'] || 0) + 1;
    if (s.gender === 'L') maleCount++;
    else if (s.gender === 'P') femaleCount++;
  });

  const sortedStyles = Object.entries(styles).sort((a,b) => b[1] - a[1]);
  const dominantStyle = sortedStyles[0]?.[0] || 'Visual Tutorial';
  const dominantStyleCount = sortedStyles[0]?.[1] || 0;
  const dominantStylePct = Math.round((dominantStyleCount / total) * 100);

  const sortedMedia = Object.entries(media).sort((a,b) => b[1] - a[1]);
  const count2D = media['2D'] || 0;
  const count3D = media['3D'] || 0;
  const pct2D = Math.round((count2D / total) * 100);
  const pct3D = Math.round((count3D / total) * 100);

  const sortedChallenges = Object.entries(challenges).sort((a,b) => b[1] - a[1]);
  const topChallenge = sortedChallenges[0]?.[0] || 'Sketsa Proporsi';
  const topChallengeCount = sortedChallenges[0]?.[1] || 0;
  const topChallengePct = Math.round((topChallengeCount / total) * 100);

  // Content Differentiation text
  if (dynKonten) {
    let contentHtml = `Sebanyak <strong>${dominantStylePct}% siswa (${dominantStyleCount} anak)</strong> di kelas ${currentClass} memilih modalitas <strong>${dominantStyle}</strong>. `;
    if (dominantStyle.includes('Visual')) {
      contentHtml += `Siapkan panduan rupa infografis visual langkah-demi-langkah (sketsa anatomis, kartu contoh gradasi warna, dan bagan proporsi). Sediakan video demonstrasi singkat (2-3 menit) yang dapat diputar ulang oleh siswa.`;
    } else if (dominantStyle.includes('Kinestetik')) {
      contentHtml += `Sediakan artefak fisik, contoh model karya asli yang bisa disentuh langsung, dan demonstrasi taktil teknik alat/bahan secara nyata di depan meja studio.`;
    } else if (dominantStyle.includes('Auditori')) {
      contentHtml += `Sediakan narasi kontekstual mengenai filosofi karya seni, penjelasan verbal yang runtut mengenai makna simbol visual, dan musik latar pendukung konsentrasi berkarya.`;
    } else {
      contentHtml += `Fasilitasi sesi bedah karya berkelompok dengan papan inspirasi visual kolektif (moodboard) sebelum memulai karya individual.`;
    }
    dynKonten.innerHTML = contentHtml;
  }

  // Process Differentiation (Scaffolding)
  if (dynProses) {
    let prosesHtml = `Tantangan terbesar siswa kelas ini adalah <strong>${topChallenge} (${topChallengePct}% - ${topChallengeCount} siswa)</strong>. `;
    if (topChallenge.includes('Sketsa') || topChallenge.includes('Proporsi')) {
      prosesHtml += `Terapkan <em>Scaffolding Tingkat 1</em>: berikan lembar kerja berkisi (grid guide) atau teknik bentuk geometris dasar (lingkaran, tabung, kubus) untuk mempermudah peletakan proporsi awal sebelum siswa masuk ke pewarnaan.`;
    } else if (topChallenge.includes('Warna') || topChallenge.includes('Pewarnaan')) {
      prosesHtml += `Terapkan <em>Scaffolding Tingkat 1</em>: sediakan palet uji coba warna (swatch test sheet) dan kartu panduan lingkaran warna harmoni (komplementer, analog) agar siswa tidak ragu memadukan gradasi.`;
    } else if (topChallenge.includes('Ide') || topChallenge.includes('Awal')) {
      prosesHtml += `Terapkan <em>Scaffolding Tingkat 1</em>: fasilitasi sesi curah pendapat 10 menit menggunakan kartu kata kunci bertema lingkungan sekolah, budaya lokal, atau emosi personal siswa.`;
    } else {
      prosesHtml += `Terapkan <em>Scaffolding Tingkat 1</em>: bimbingan intensif pada teknik penegasan garis kontur (finishing line) dan kerapian pembersihan sisa media.`;
    }
    dynProses.innerHTML = prosesHtml;
  }

  // Product Differentiation
  if (dynProduk) {
    dynProduk.innerHTML = `
      Kelas terbagi menjadi <strong>${pct2D}% media 2D (${count2D} siswa)</strong> dan <strong>${pct3D}% media 3D (${count3D} siswa)</strong>.
      Berikan kebebasan menghasilkan artefak akhir multi-jalur: bagi siswa 2D dapat memilih gambar ilustratif/lukisan dengan teknik kering (pensil warna/spidol) atau basah (cat air), sedangkan bagi siswa 3D diarahkan membuat objek figuratif mini/makel menggunakan bahan plastis atau daur ulang kertas.
    `;
  }

  // Studio Environment Layout
  if (dynStudio) {
    dynStudio.innerHTML = `
      <strong>Zonasi Studio Kelas ${currentClass}:</strong> 
      Bagi ruang kelas menjadi 2 zona kerja: 
      <strong>Zona A (Meja 2D Kering & Sketsa, ${count2D} meja)</strong> dialokasikan di dekat jendela untuk pencahayaan alami optimal. 
      <strong>Zona B (Meja 3D & Media Basah, ${count3D} meja)</strong> dialokasikan di area yang dekat dengan akses air bersih dan beralaskan koran/alas plastik untuk menjaga kebersihan meja kerja studio.
    `;
  }

  // Populate Personal Recommendation select
  populatePersonalSelect();
  renderPersonalRecommendation();
}

function populatePersonalSelect() {
  const select = document.getElementById('personal-student-select');
  if (!select) return;

  const currentVal = select.value;
  select.innerHTML = '<option value="" disabled selected>Pilih siswa rombel...</option>';

  currentRoster.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = `No. ${s.attendance_no || '-'} · ${s.name} (${s.style || 'Visual'} - ${s.category || '2D'})`;
    select.appendChild(opt);
  });

  if (currentVal && currentRoster.some(s => s.id == currentVal)) {
    select.value = currentVal;
  } else if (currentRoster.length > 0) {
    select.value = currentRoster[0].id;
  }
}

function renderPersonalRecommendation() {
  const select = document.getElementById('personal-student-select');
  const container = document.getElementById('personal-recom-card');
  if (!select || !container) return;

  const studentId = select.value;
  const student = currentRoster.find(s => s.id == studentId);

  if (!student) {
    container.innerHTML = '<p class="text-xs text-atelier-inkMuted italic">Pilih siswa di atas untuk melihat rekomendasi pendampingan personal.</p>';
    return;
  }

  // Find a complementary peer partner in the roster
  const peer = currentRoster.find(s => s.id !== student.id && (s.style !== student.style || s.category !== student.category));
  const peerText = peer 
    ? `<strong>No. ${peer.attendance_no || '-'} ${peer.name}</strong> (Gaya: ${peer.style || 'Visual'}, Media: ${peer.category || '2D'})`
    : 'Rekan sebaya di meja sebelah';

  container.innerHTML = `
    <div class="space-y-4">
      <!-- Student Badge Header -->
      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-atelier-border pb-3">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-atelier-terracotta text-white flex items-center justify-center font-serif font-black text-base">
            ${student.attendance_no || '#'}
          </div>
          <div>
            <h5 class="font-serif font-bold text-base text-atelier-ink">${student.name}</h5>
            <span class="text-[11px] font-mono text-atelier-inkMuted">Kelas ${currentClass} · Jenis Kelamin: ${student.gender || '-'}</span>
          </div>
        </div>
        <div class="flex flex-wrap gap-1.5">
          <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-atelier-terracottaLight text-atelier-terracotta">
            ${student.style || 'Visual Tutorial'}
          </span>
          <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-atelier-ochreLight text-atelier-ochre">
            ${student.category || '2D'} (${student.sub_option || 'Kering'})
          </span>
          <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-red-100 text-red-800">
            Kendala: ${student.challenge || 'Sketsa'}
          </span>
        </div>
      </div>

      <!-- Specific Scaffolding for this student -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div class="p-3.5 bg-atelier-warm/40 rounded-xl border border-atelier-border space-y-1">
          <strong class="text-atelier-terracotta font-mono uppercase text-[10px] block">A. Strategi Bimbingan Guru (Personal Scaffolding)</strong>
          <p class="text-atelier-ink leading-relaxed">
            Karena ${student.name} memiliki modalitas <strong>${student.style || 'Visual'}</strong> namun menghadapi kendala pada <strong>${student.challenge || 'Sketsa Proporsi'}</strong>, berikan contoh visual gambar rangka garis (wireframe) berukuran 1:1 di dekat mejanya dan dorong ia membuat 2 alternatif sketsa kasar (thumbnails) sebelum menetapkan sketsa final.
          </p>
        </div>

        <div class="p-3.5 bg-atelier-warm/40 rounded-xl border border-atelier-border space-y-1">
          <strong class="text-atelier-sage font-mono uppercase text-[10px] block">B. Rekomendasi Partner Kolaborasi (Peer Buddy)</strong>
          <p class="text-atelier-ink leading-relaxed">
            Sandingkan meja kerja ${student.name} dengan ${peerText} agar mereka dapat saling memberikan apresiasi teman sebaya dan bertukar perspektif dalam eksplorasi media ${student.category || '2D'}.
          </p>
        </div>
      </div>

      <!-- Suggested Next Action -->
      <div class="p-3 bg-white border border-atelier-border rounded-xl text-xs flex items-center justify-between">
        <span class="text-atelier-inkMuted text-[11px]">
          Target Sesi: Menyelesaikan sketsa kasar dalam 15 menit pertama dan memilih palet warna harmonis.
        </span>
        <button onclick="switchMainTab('tab-m8-rubric'); selectStudentForRubric(${student.id});" class="text-atelier-terracotta hover:underline font-mono text-[11px] font-bold cursor-pointer">
          Buka Penilaian Rubrik Siswa Ini →
        </button>
      </div>
    </div>
  `;
}

// ========================================================
// 8. DYNAMIC RPP / MODUL AJAR GENERATOR (TAHAP 6)
// ========================================================
let isModulAjarGenerated = false;

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function triggerGenerateModulAjar() {
  isModulAjarGenerated = true;
  generateModulAjarText();
  const btn = document.getElementById('btn-generate-rpp');
  if (btn) {
    const originalText = btn.innerHTML;
    btn.innerHTML = `<span class="text-emerald-300">✓</span><span>Modul Ajar Berhasil Dibuat!</span>`;
    setTimeout(() => {
      btn.innerHTML = originalText;
    }, 2000);
  }
}

function printModulAjar() {
  if (!isModulAjarGenerated) {
    triggerGenerateModulAjar();
  }
  setTimeout(() => {
    window.print();
  }, 250);
}

function generateModulAjarText() {
  const container = document.getElementById('modul-ajar-document');
  if (!container) return;

  if (!isModulAjarGenerated) {
    container.className = 'p-6 md:p-8 bg-[#FDFCFE] border border-slate-200/90 rounded-2xl min-h-[140px] text-slate-400 font-mono text-sm italic transition-all duration-300';
    container.innerHTML = `// Klik "Generate Modul Ajar Otomatis" untuk menyusun modul RPP berdiferensiasi.`;
    return;
  }

  const topicInput = document.getElementById('rpp-topic-input');
  const topic = (topicInput && topicInput.value.trim()) ? topicInput.value.trim() : 'Eksplorasi Ragam Hias Nusantara dalam Media 2D & 3D';
  const targetTimeInput = document.getElementById('rpp-target-time-input');
  const targetTime = (targetTimeInput && targetTimeInput.value.trim()) ? targetTimeInput.value.trim() : `Kelas ${currentClass.split('-')[0] || 'VII'} (2 x 45 Menit / 1 Pertemuan)`;

  const total = currentRoster.length;
  let maleCount = 0;
  let femaleCount = 0;

  const styles = {};
  const media = {};
  const challenges = {};

  currentRoster.forEach(s => {
    styles[s.style || 'Visual Tutorial'] = (styles[s.style || 'Visual Tutorial'] || 0) + 1;
    media[s.category || '2D'] = (media[s.category || '2D'] || 0) + 1;
    challenges[s.challenge || 'Sketsa Proporsi'] = (challenges[s.challenge || 'Sketsa Proporsi'] || 0) + 1;
    if (s.gender === 'L') maleCount++;
    else if (s.gender === 'P') femaleCount++;
  });

  const dominantStyle = Object.entries(styles).sort((a,b) => b[1] - a[1])[0]?.[0] || 'Visual Tutorial';
  const dominantStyleCount = styles[dominantStyle] || 0;
  const dominantStylePct = total > 0 ? Math.round((dominantStyleCount / total) * 100) : 0;

  const count2D = media['2D'] || 0;
  const count3D = media['3D'] || 0;
  const topChallenge = Object.entries(challenges).sort((a,b) => b[1] - a[1])[0]?.[0] || 'Sketsa Proporsi';

  container.className = 'p-6 md:p-8 bg-white border border-slate-200/90 rounded-3xl space-y-6 text-sm font-sans leading-relaxed text-slate-800 shadow-2xs transition-all duration-300';
  container.innerHTML = `
    <!-- Kop Modul Ajar Resmi -->
    <div class="text-center border-b-2 border-slate-900 pb-5 space-y-1.5">
      <div class="inline-block px-3 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#EDE9FE] text-[#6D28D9] border border-[#DDD6FE] uppercase mb-1">
        Kurikulum Merdeka · Fase D SMP
      </div>
      <h2 class="font-serif font-black text-xl sm:text-2xl text-slate-900 uppercase tracking-wider">MODUL AJAR SENI RUPA BERDIFERENSIASI</h2>
      <p class="font-serif text-base text-[#6366F1] font-semibold">${escapeHtml(topic)}</p>
      <div class="flex flex-wrap items-center justify-center gap-2 sm:gap-4 font-mono text-xs text-slate-500 pt-1.5">
        <span class="font-semibold text-slate-700">Satuan Pendidikan: SMP</span>
        <span>•</span>
        <span class="font-semibold text-slate-700">Target & Waktu: ${escapeHtml(targetTime)}</span>
        <span>•</span>
        <span class="font-bold text-[#6366F1]">Kelas Aktif: ${currentClass}</span>
        <span>•</span>
        <span class="font-semibold text-slate-700">Total Siswa: ${total} Anak (${maleCount} L, ${femaleCount} P)</span>
      </div>
    </div>

    <!-- I. Identitas & Capaian Pembelajaran -->
    <div class="space-y-2">
      <h3 class="font-serif font-bold text-base text-[#6366F1] uppercase tracking-wide flex items-center gap-2">
        <span>📌</span>
        <span>I. Capaian Pembelajaran (CP) & Dimensi Profil Pelajar Pancasila</span>
      </h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div class="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1.5">
          <strong class="text-slate-900 block font-semibold">Elemen Capaian Fase D:</strong>
          <p class="text-slate-600 leading-relaxed">
            <strong>Mengalami (Experiencing):</strong> Siswa mampu merefleksikan pengamatan visual lingkungan sekitar.<br>
            <strong>Menciptakan (Making):</strong> Siswa mampu mengeksplorasi ragam media dan teknik berkarya seni rupa 2D dan 3D secara mandiri dan kreatif.
          </p>
        </div>
        <div class="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1.5">
          <strong class="text-slate-900 block font-semibold">Dimensi Profil Pelajar Pancasila:</strong>
          <ul class="list-disc list-inside text-slate-600 space-y-0.5 leading-relaxed">
            <li><strong>Kreatif:</strong> Mengembangkan gagasan orisinal melalui pilihan media seni visual.</li>
            <li><strong>Mandiri:</strong> Memiliki ketekunan memecahkan kendala teknis dalam proses berkarya.</li>
            <li><strong>Bergotong Royong:</strong> Memberikan apresiasi dan masukan konstruktif dalam kerja kolaborasi.</li>
          </ul>
        </div>
      </div>
    </div>

    <!-- II. Karakteristik Diagnostik Kelas Aktif -->
    <div class="space-y-2">
      <h3 class="font-serif font-bold text-base text-[#6366F1] uppercase tracking-wide flex items-center gap-2">
        <span>📊</span>
        <span>II. Karakteristik Riil Rombel ${currentClass} (Hasil Diagnostik Aktual)</span>
      </h3>
      <div class="p-4 bg-white border border-slate-200/90 rounded-2xl text-xs space-y-2 leading-relaxed shadow-2xs">
        <p class="text-slate-800">
          Berdasarkan hasil pemetaan asesmen diagnostik terhadap <strong>${total} siswa</strong> di kelas <strong>${currentClass}</strong>:
        </p>
        <ul class="list-disc list-inside text-slate-600 space-y-1">
          <li><strong>Dominasi Modalitas Belajar:</strong> Sebanyak <strong>${dominantStylePct}% siswa (${dominantStyleCount} anak)</strong> memiliki preferensi gaya belajar <strong>${dominantStyle}</strong>.</li>
          <li><strong>Distribusi Minat Media:</strong> Terbagi menjadi <strong>${count2D} siswa (media 2D Drawing/Lukis/Grafis)</strong> dan <strong>${count3D} siswa (media 3D Kriya/Patung/Clay)</strong>.</li>
          <li><strong>Titik Hambatan Utama:</strong> Titik kendala terbanyak yang dirasakan murid saat berkarya adalah pada fase <strong>${topChallenge}</strong>.</li>
        </ul>
      </div>
    </div>

    <!-- III. Strategi Pembelajaran Berdiferensiasi -->
    <div class="space-y-2">
      <h3 class="font-serif font-bold text-base text-[#6366F1] uppercase tracking-wide flex items-center gap-2">
        <span>🎯</span>
        <span>III. Matriks Strategi Pembelajaran Berdiferensiasi</span>
      </h3>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <div class="p-4 bg-[#F5F3FF] border border-[#DDD6FE] rounded-2xl space-y-1">
          <strong class="text-[#6D28D9] font-mono text-[11px] uppercase block">1. Diferensiasi Konten:</strong>
          <p class="text-slate-700 leading-relaxed">
            Menyediakan variasi referensi ajar: Video tutorial langkah demi langkah untuk ${dominantStylePct}% siswa modalitas ${dominantStyle}, serta panduan visual infografis bagi peminat eksplorasi mandiri.
          </p>
        </div>
        <div class="p-4 bg-[#FDF2F8] border border-[#FBCFE8] rounded-2xl space-y-1">
          <strong class="text-[#BE185D] font-mono text-[11px] uppercase block">2. Diferensiasi Proses:</strong>
          <p class="text-slate-700 leading-relaxed">
            Membentuk kelompok heterogen (3–4 orang). Memberikan bimbingan scaffolding intensif pada fase perancangan sketsa awal bagi siswa dengan kendala ${topChallenge}.
          </p>
        </div>
        <div class="p-4 bg-[#F0FDFA] border border-[#CCFBF1] rounded-2xl space-y-1">
          <strong class="text-[#0F766E] font-mono text-[11px] uppercase block">3. Diferensiasi Produk:</strong>
          <p class="text-slate-700 leading-relaxed">
            Kebebasan wujud karya akhir: Siswa jalur 2D (${count2D} siswa) menghasilkan karya gambar/desain, dan jalur 3D (${count3D} siswa) membuat karya objek fisik/kriya dengan rubrik autentik setara.
          </p>
        </div>
      </div>
    </div>

    <!-- IV. Skenario Pembelajaran Studio Berwaktu -->
    <div class="space-y-2">
      <h3 class="font-serif font-bold text-base text-[#6366F1] uppercase tracking-wide flex items-center gap-2">
        <span>⏳</span>
        <span>IV. Skenario Aktivitas Studio Berwaktu</span>
      </h3>
      <div class="space-y-2 text-xs">
        <div class="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl">
          <strong class="text-slate-900 block font-semibold">A. Kegiatan Awal (15 Menit):</strong>
          <ul class="list-disc list-inside text-slate-600 mt-1 space-y-0.5">
            <li>Apersepsi, salam, dan refleksi kesiapan emosional berkarya siswa.</li>
            <li>Penyampaian tujuan pembelajaran topik <em>"${escapeHtml(topic)}"</em> dan pengenalan alur studio 3 fase.</li>
          </ul>
        </div>
        <div class="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl">
          <strong class="text-slate-900 block font-semibold">B. Kegiatan Inti Studio Berkarya (60–75 Menit):</strong>
          <ul class="list-disc list-inside text-slate-600 mt-1 space-y-0.5">
            <li><strong>Fase 1 (15 Menit - Eksplorasi & Sketsa):</strong> Siswa merancang gagasan bentuk dengan bimbingan terfokus pada ${topChallenge}.</li>
            <li><strong>Fase 2 (45 Menit - Eksekusi Media):</strong> Siswa berkarya di zona media masing-masing (Zona 2D atau Zona 3D) sesuai preferensi diagnostik.</li>
            <li><strong>Fase 3 (15 Menit - Apresiasi Sebaya):</strong> Siswa saling bertukar masukan konstruktif dengan rekan satu kelompok.</li>
          </ul>
        </div>
        <div class="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl">
          <strong class="text-slate-900 block font-semibold">C. Kegiatan Penutup (15 Menit):</strong>
          <ul class="list-disc list-inside text-slate-600 mt-1 space-y-0.5">
            <li>Refleksi pengalaman proses berkarya dan pembersihan/penataan kembali area studio seni.</li>
            <li>Dokumentasi foto proses/karya ke portofolio digital siswa untuk penilaian rubrik autentik.</li>
          </ul>
        </div>
      </div>
    </div>

    <!-- V. Pengesahan Guru & Kepala Sekolah -->
    <div class="pt-6 border-t border-slate-200 grid grid-cols-2 text-center text-xs text-slate-700">
      <div class="space-y-12">
        <p>Mengetahui,<br><span class="font-semibold text-slate-900">Kepala Sekolah SMP</span></p>
        <p class="font-bold underline text-slate-900">......................................................<br><span class="font-normal font-mono text-[10px] text-slate-500 no-underline">NIP. ..........................................</span></p>
      </div>
      <div class="space-y-12">
        <p>Guru Mata Pelajaran,<br><span class="font-semibold text-slate-900">Seni Rupa (Fase D)</span></p>
        <p class="font-bold underline text-slate-900">......................................................<br><span class="font-normal font-mono text-[10px] text-slate-500 no-underline">NIP. ..........................................</span></p>
      </div>
    </div>
  `;
}

function copyModulAjarText() {
  const container = document.getElementById('modul-ajar-document');
  if (!container) return;
  navigator.clipboard.writeText(container.innerText).then(() => {
    alert('Teks Modul Ajar Dinamis kelas ' + currentClass + ' berhasil disalin ke clipboard!');
  });
}

// ========================================================
// 9. RUBRIK PENILAIAN AUTENTIK & GRADEBOOK (TAHAP 8)
// ========================================================
async function loadClassRubricGradebook(classId) {
  const tbody = document.getElementById('rubric-gradebook-body');
  if (!tbody) return;

  tbody.innerHTML = `
    <tr>
      <td colspan="10" class="py-6 text-center text-atelier-inkMuted italic">
        Memuat rekapitulasi nilai rubrik kelas ${classId}...
      </td>
    </tr>
  `;

  try {
    const res = await API.getClassRubric(classId);
    if (res && res.status === 'success') {
      const records = res.data || [];
      renderRubricGradebookTable(records);
    }
  } catch (err) {
    console.error('Failed to load class rubric', err);
    tbody.innerHTML = `
      <tr>
        <td colspan="10" class="py-6 text-center text-red-500 italic">
          Gagal memuat rekapitulasi nilai rubrik kelas.
        </td>
      </tr>
    `;
  }
}

function renderRubricGradebookTable(records) {
  const tbody = document.getElementById('rubric-gradebook-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (records.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" class="py-8 text-center text-atelier-inkMuted italic">
          Belum ada siswa terdaftar di rombel ${currentClass}. Tambahkan siswa atau bagikan tautan asesmen.
        </td>
      </tr>
    `;
    return;
  }

  records.forEach(r => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-atelier-warm/40 transition';

    const hasScore = r.rubric_id !== null && r.total_score !== null;
    const genderBadge = r.gender === 'L' ? '<span class="text-blue-600 font-bold">L</span>' : r.gender === 'P' ? '<span class="text-pink-600 font-bold">P</span>' : '-';

    let predicateBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-gray-100 text-gray-500">Belum Dinilai</span>';
    if (hasScore) {
      if (r.total_score >= 88) {
        predicateBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800">Istimewa</span>';
      } else if (r.total_score >= 76) {
        predicateBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-100 text-blue-800">Tuntas</span>';
      } else {
        predicateBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-100 text-amber-800">Bimbingan</span>';
      }
    }

    tr.innerHTML = `
      <td class="py-3 px-3 font-mono font-bold text-center text-atelier-terracotta">${r.attendance_no || '-'}</td>
      <td class="py-3 px-3 font-semibold text-atelier-ink">${r.student_name}</td>
      <td class="py-3 px-3 font-mono text-center">${genderBadge}</td>
      <td class="py-3 px-3 font-mono text-[11px] text-center text-atelier-inkMuted">${r.style || '-'}</td>
      <td class="py-3 px-3 font-mono font-bold text-center ${hasScore ? 'text-atelier-terracotta' : 'text-gray-400'}">${hasScore ? r.process_score : '-'}</td>
      <td class="py-3 px-3 font-mono font-bold text-center ${hasScore ? 'text-atelier-ochre' : 'text-gray-400'}">${hasScore ? r.product_score : '-'}</td>
      <td class="py-3 px-3 font-mono font-black text-center text-sm ${hasScore ? 'text-atelier-ink' : 'text-gray-400'}">${hasScore ? r.total_score : '-'}</td>
      <td class="py-3 px-3 text-center">${predicateBadge}</td>
      <td class="py-3 px-3 text-[11px] text-atelier-inkMuted italic max-w-xs truncate" title="${r.notes || ''}">
        ${r.notes || '-'}
      </td>
      <td class="py-3 px-3 text-center">
        <button onclick="selectStudentForRubric(${r.student_id}, ${r.process_score || 75}, ${r.product_score || 80}, '${encodeURIComponent(r.notes || '')}')" 
          class="px-2.5 py-1 rounded-lg border border-atelier-border hover:bg-atelier-terracotta hover:text-white transition font-mono text-[11px] font-bold cursor-pointer">
          ${hasScore ? 'Edit' : 'Beri Nilai'}
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function selectStudentForRubric(studentId, proc = 75, prod = 80, encodedNotes = '') {
  const select = document.getElementById('rubric-student-select');
  if (select) {
    select.value = studentId;
  }

  const inputProc = document.getElementById('input-score-process');
  const inputProd = document.getElementById('input-score-product');
  const inputNotes = document.getElementById('rubric-notes');

  if (inputProc) inputProc.value = proc;
  if (inputProd) inputProd.value = prod;
  if (inputNotes) inputNotes.value = decodeURIComponent(encodedNotes);

  calculateRubricScore();

  // Scroll smoothly to form
  const form = document.getElementById('rubric-form');
  if (form) {
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function populateRubricStudentSelect(roster) {
  const select = document.getElementById('rubric-student-select');
  if (!select) return;

  const currentVal = select.value;
  select.innerHTML = '<option value="" disabled selected>Pilih siswa untuk dinilai...</option>';

  roster.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = `No. ${s.attendance_no || '-'} · ${s.name} (${s.gender || '-'}) - ${s.category}`;
    select.appendChild(opt);
  });

  if (currentVal && roster.some(s => s.id == currentVal)) {
    select.value = currentVal;
  }
  calculateRubricScore();
}

function calculateRubricScore() {
  const procEl = document.getElementById('input-score-process');
  const prodEl = document.getElementById('input-score-product');
  if (!procEl || !prodEl) return;

  const proc = parseInt(procEl.value) || 75;
  const prod = parseInt(prodEl.value) || 80;

  const lblProc = document.getElementById('label-score-process');
  const lblProd = document.getElementById('label-score-product');
  if (lblProc) lblProc.textContent = `${proc}/100`;
  if (lblProd) lblProd.textContent = `${prod}/100`;

  const total = Math.round((proc * 0.5) + (prod * 0.5));
  const elBadge = document.getElementById('rubric-total-score-badge');
  if (elBadge) elBadge.textContent = `Nilai: ${total}`;

  let predicate = 'Berkembang (Cukup)';
  if (total >= 88) predicate = 'Sangat Mahir (Istimewa)';
  else if (total >= 76) predicate = 'Mahir (Tuntas)';
  else if (total < 65) predicate = 'Perlu Bimbingan Khusus';

  const elPred = document.getElementById('rubric-predicate-badge');
  if (elPred) elPred.textContent = `Predikat: ${predicate}`;
}

function setupRubricHandlers() {
  const form = document.getElementById('rubric-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
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
        alert('Penilaian rubrik autentik berhasil disimpan ke server database!');
        await loadClassRubricGradebook(currentClass);
      }
    } catch (err) {
      alert('Gagal menyimpan penilaian: ' + err.message);
    }
  });
}

function downloadRubricExcel() {
  window.location.href = `/api/export/excel?class=${encodeURIComponent(currentClass)}&type=rubric`;
}

// ========================================================
// 10. KALENDER AKADEMIK & KATEGORI KUSTOM
// ========================================================
function handleCalendarCategoryChange() {
  const calType = document.getElementById('cal-type');
  const customContainer = document.getElementById('cal-type-custom-container');
  const customInput = document.getElementById('cal-type-custom');

  if (calType && customContainer) {
    if (calType.value === 'custom') {
      customContainer.classList.remove('hidden');
      if (customInput) customInput.focus();
    } else {
      customContainer.classList.add('hidden');
    }
  }
}

async function loadCalendarEvents() {
  const container = document.getElementById('calendar-events-container');
  if (!container) return;

  try {
    const res = await API.getCalendar();
    if (res && res.status === 'success') {
      const events = res.data;
      const countBadge = document.getElementById('calendar-count-badge');
      if (countBadge) countBadge.textContent = `${events.length} Kegiatan`;
      container.innerHTML = '';

      if (events.length === 0) {
        container.innerHTML = '<p class="text-xs text-atelier-inkMuted italic">Belum ada agenda kegiatan di kalender.</p>';
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
                <span class="px-1.5 py-0.2 rounded font-bold uppercase ${
                  ev.type === 'asesmen' ? 'bg-blue-100 text-blue-800' :
                  ev.type === 'praktik' ? 'bg-amber-100 text-amber-800' :
                  ev.type === 'pameran' ? 'bg-purple-100 text-purple-800' :
                  ev.type === 'deadline' ? 'bg-red-100 text-red-800' :
                  'bg-emerald-100 text-emerald-800'
                }">${ev.type}</span>
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
  const form = document.getElementById('calendar-add-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('cal-title').value.trim();
    const event_date = document.getElementById('cal-date').value;
    const typeSelect = document.getElementById('cal-type').value;

    let finalType = typeSelect;
    if (typeSelect === 'custom') {
      const customVal = document.getElementById('cal-type-custom').value.trim();
      if (!customVal) {
        alert('Tuliskan nama kategori kustom.');
        return;
      }
      finalType = customVal;
    }

    if (!title || !event_date) return;

    try {
      const res = await API.addCalendarEvent({
        title,
        event_date,
        type: finalType,
        class_id: currentClass
      });
      if (res && res.status === 'success') {
        document.getElementById('cal-title').value = '';
        const customInput = document.getElementById('cal-type-custom');
        if (customInput) customInput.value = '';
        await loadCalendarEvents();
      }
    } catch (err) {
      alert('Gagal menambah agenda: ' + err.message);
    }
  });
}

// ========================================================
// 10. PORTOFOLIO & LOG PERKEMBANGAN (TAHAP 9 CRUD)
// ========================================================
let currentPortfolios = [];

async function loadClassPortfolios(classId) {
  try {
    const cid = classId || currentClass;
    const res = await API.getPortfolios(cid);
    if (res && res.status === 'success') {
      currentPortfolios = res.data || [];
      renderPortfolioCards(currentPortfolios);
    }
  } catch (err) {
    console.error('Failed to load portfolios:', err);
  }
}

function renderPortfolioCards(portfolios) {
  const container = document.getElementById('portfolio-cards-container');
  if (!container) return;

  // If no items in database, display the default prototype cards
  const items = (portfolios && portfolios.length > 0) ? portfolios : [
    { id: 1, title: 'Eksplorasi Sketsa Karakter', category: 'KARYA 2D DRAWING', score: 88, semester: 'Semester Ganjil' },
    { id: 2, title: 'Miniatur Kerajinan Clay Fauna', category: 'KARYA 3D KRIYA', score: 85, semester: 'Semester Ganjil' }
  ];

  let html = '';
  items.forEach(item => {
    const is3D = (item.category || '').includes('3D') || (item.category || '').includes('KRIYA') || (item.category || '').includes('PATUNG');
    const tagColor = is3D ? 'text-[#EC4899]' : 'text-[#6366F1]';
    const tagBg = is3D ? 'bg-[#FDF2F8]' : 'bg-[#F3EFFE]';

    const mediaPreview = item.image_data
      ? `<div class="relative h-40 rounded-xl overflow-hidden bg-slate-100 border border-slate-200/80">
           <img src="${item.image_data}" alt="${escapeHtml(item.title)}" class="w-full h-full object-cover">
           <span class="absolute top-2 left-2 px-2.5 py-0.5 rounded-md font-mono text-[10px] font-bold ${tagBg} ${tagColor} shadow-2xs">[ ${escapeHtml(item.category)} ]</span>
         </div>`
      : `<div class="h-40 rounded-xl ${tagBg} flex items-center justify-center p-3 text-center">
           <span class="font-mono text-xs font-bold ${tagColor} tracking-wider">[ ${escapeHtml(item.category)} ]</span>
         </div>`;

    html += `
      <div class="portfolio-item-card bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-3 hover:border-purple-300 transition flex flex-col justify-between">
        <div class="space-y-3">
          ${mediaPreview}
          <div>
            <h4 class="font-bold text-slate-900 text-sm sm:text-base leading-snug">${escapeHtml(item.title)}</h4>
            <p class="text-xs text-slate-400 mt-1">Nilai: ${item.score || 85} · ${escapeHtml(item.semester || 'Semester Ganjil')}${item.student_name ? ' · ' + escapeHtml(item.student_name) : ''}</p>
            ${item.notes ? `<p class="text-[11px] text-slate-500 italic mt-1.5 line-clamp-2">“${escapeHtml(item.notes)}”</p>` : ''}
          </div>
        </div>
        <div class="flex items-center justify-between pt-2.5 border-t border-slate-100 text-xs">
          <button onclick="openEditPortfolioModal(${item.id})" class="text-[#6366F1] hover:underline font-mono font-bold flex items-center gap-1 cursor-pointer">
            <span>✏️</span><span>Ubah</span>
          </button>
          <button onclick="deletePortfolioItem(${item.id})" class="text-rose-500 hover:underline font-mono font-bold flex items-center gap-1 cursor-pointer">
            <span>🗑️</span><span>Hapus</span>
          </button>
        </div>
      </div>
    `;
  });

  // Always append Card 3 (Unggah Dokumen Karya)
  html += `
    <div onclick="openAddPortfolioModal()" class="bg-[#FAFAFA] border border-slate-200/90 hover:border-purple-300 hover:bg-purple-50/20 rounded-2xl p-6 min-h-[200px] flex flex-col items-center justify-center text-center space-y-2.5 transition cursor-pointer shadow-2xs group">
      <input type="file" id="portfolio-file-input" class="hidden" accept="image/png,image/jpeg,application/pdf" onchange="handlePortfolioUpload(event)">
      <div class="w-12 h-12 rounded-full bg-[#EDE9FE] group-hover:bg-[#DDD6FE] text-[#6366F1] text-2xl font-bold flex items-center justify-center transition shadow-2xs">
        +
      </div>
      <h4 class="text-sm font-bold text-[#6366F1] group-hover:underline">Unggah Dokumen Karya</h4>
      <p class="text-xs text-slate-400 font-mono">JPG, PNG, atau PDF</p>
    </div>
  `;

  container.innerHTML = html;
}

function openAddPortfolioModal() {
  const form = document.getElementById('form-portfolio');
  if (form) form.reset();

  const idInput = document.getElementById('form-portfolio-id');
  if (idInput) idInput.value = '';

  const imgData = document.getElementById('form-p-image-data');
  if (imgData) imgData.value = '';

  const previewBox = document.getElementById('form-p-preview-box');
  if (previewBox) previewBox.classList.add('hidden');

  const btnDelete = document.getElementById('btn-delete-portfolio');
  if (btnDelete) btnDelete.classList.add('hidden');

  const title = document.getElementById('modal-portfolio-title');
  if (title) title.textContent = 'Tambah Karya Portofolio Siswa';

  const modal = document.getElementById('modal-portfolio');
  if (modal) modal.classList.remove('hidden');
}

function openEditPortfolioModal(id) {
  const item = currentPortfolios.find(p => String(p.id) === String(id)) || {
    id,
    title: id === 1 ? 'Eksplorasi Sketsa Karakter' : 'Miniatur Kerajinan Clay Fauna',
    category: id === 1 ? 'KARYA 2D DRAWING' : 'KARYA 3D KRIYA',
    student_name: id === 1 ? 'Linely' : 'Bima Satria',
    score: id === 1 ? 88 : 85,
    semester: 'Semester Ganjil',
    notes: ''
  };

  const idInput = document.getElementById('form-portfolio-id');
  if (idInput) idInput.value = item.id || '';

  const titleInput = document.getElementById('form-p-title');
  if (titleInput) titleInput.value = item.title || '';

  const catSelect = document.getElementById('form-p-category');
  if (catSelect) catSelect.value = item.category || 'KARYA 2D DRAWING';

  const studentInput = document.getElementById('form-p-student');
  if (studentInput) studentInput.value = item.student_name || '';

  const scoreInput = document.getElementById('form-p-score');
  if (scoreInput) scoreInput.value = item.score !== undefined ? item.score : 85;

  const semSelect = document.getElementById('form-p-semester');
  if (semSelect) semSelect.value = item.semester || 'Semester Ganjil';

  const notesText = document.getElementById('form-p-notes');
  if (notesText) notesText.value = item.notes || '';

  const imgData = document.getElementById('form-p-image-data');
  const previewBox = document.getElementById('form-p-preview-box');
  const previewImg = document.getElementById('form-p-preview-img');
  const previewName = document.getElementById('form-p-preview-name');

  if (item.image_data) {
    if (imgData) imgData.value = item.image_data;
    if (previewImg) previewImg.src = item.image_data;
    if (previewName) previewName.textContent = 'Foto karya saat ini';
    if (previewBox) previewBox.classList.remove('hidden');
  } else {
    if (imgData) imgData.value = '';
    if (previewBox) previewBox.classList.add('hidden');
  }

  const btnDelete = document.getElementById('btn-delete-portfolio');
  if (btnDelete) btnDelete.classList.remove('hidden');

  const title = document.getElementById('modal-portfolio-title');
  if (title) title.textContent = 'Ubah Karya Portofolio Siswa';

  const modal = document.getElementById('modal-portfolio');
  if (modal) modal.classList.remove('hidden');
}

function closePortfolioModal() {
  const modal = document.getElementById('modal-portfolio');
  if (modal) modal.classList.add('hidden');
}

function previewPortfolioFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const previewBox = document.getElementById('form-p-preview-box');
  const previewImg = document.getElementById('form-p-preview-img');
  const previewName = document.getElementById('form-p-preview-name');
  const imgData = document.getElementById('form-p-image-data');

  if (previewName) previewName.textContent = file.name;

  if (file.type.startsWith('image/')) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      if (imgData) imgData.value = dataUrl;
      if (previewImg) previewImg.src = dataUrl;
      if (previewBox) previewBox.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  } else {
    // PDF file
    if (imgData) imgData.value = '';
    if (previewImg) previewImg.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%236366F1"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
    if (previewBox) previewBox.classList.remove('hidden');
  }
}

async function submitPortfolioForm(event) {
  event.preventDefault();

  const id = document.getElementById('form-portfolio-id')?.value;
  const title = document.getElementById('form-p-title')?.value.trim();
  const category = document.getElementById('form-p-category')?.value;
  const student_name = document.getElementById('form-p-student')?.value.trim();
  const score = Number(document.getElementById('form-p-score')?.value) || 85;
  const semester = document.getElementById('form-p-semester')?.value;
  const notes = document.getElementById('form-p-notes')?.value.trim();
  const image_data = document.getElementById('form-p-image-data')?.value || '';

  if (!title || !category) {
    alert('Judul karya dan kategori media wajib diisi!');
    return;
  }

  const payload = {
    class_id: currentClass,
    title,
    category,
    student_name,
    score,
    semester,
    notes,
    image_data
  };

  try {
    if (id) {
      // Update (PUT)
      const res = await API.updatePortfolio(id, payload);
      if (res && res.status === 'success') {
        alert('Karya portofolio berhasil diperbarui!');
      }
    } else {
      // Create (POST)
      const res = await API.createPortfolio(payload);
      if (res && res.status === 'success') {
        alert('Karya portofolio baru berhasil ditambahkan!');
      }
    }

    closePortfolioModal();
    await loadClassPortfolios(currentClass);
  } catch (err) {
    console.error('Error saving portfolio:', err);
    alert('Gagal menyimpan karya portofolio: ' + err.message);
  }
}

async function deletePortfolioItem(id) {
  if (!confirm('Apakah Anda yakin ingin menghapus karya ini dari portofolio siswa?')) return;

  try {
    const res = await API.deletePortfolio(id);
    if (res && res.status === 'success') {
      await loadClassPortfolios(currentClass);
    }
  } catch (err) {
    console.error('Error deleting portfolio:', err);
    alert('Gagal menghapus karya portofolio: ' + err.message);
  }
}

async function deleteCurrentPortfolioModal() {
  const id = document.getElementById('form-portfolio-id')?.value;
  if (!id) return;
  closePortfolioModal();
  await deletePortfolioItem(id);
}

function triggerPortfolioUpload() {
  openAddPortfolioModal();
}

function handlePortfolioUpload(event) {
  openAddPortfolioModal();
  previewPortfolioFile(event);
}

// ========================================================
// 11. LIVE MONITOR ENGINE (TAHAP 9)
// ========================================================
function startLiveMonitorPolling() {
  fetchLiveMonitorData();
  clearInterval(liveMonitorInterval);
  liveMonitorInterval = setInterval(() => {
    fetchLiveMonitorData();
  }, 3500);
}

async function fetchLiveMonitorData() {
  try {
    const res = await API.getLiveMonitor(currentClass);
    if (res && res.status === 'success') {
      const { sessions, activeCount, completedCount } = res.data;

      const sidebarBadge = document.getElementById('sidebar-live-badge');
      if (sidebarBadge) sidebarBadge.textContent = activeCount;

      const elActive = document.getElementById('live-active-count');
      const elCompleted = document.getElementById('live-completed-count');
      const elAvg = document.getElementById('live-avg-progress');

      if (elActive) elActive.textContent = `${activeCount} Siswa`;
      if (elCompleted) elCompleted.textContent = `${completedCount} Siswa`;

      let avg = 0;
      if (sessions.length > 0) {
        const sum = sessions.reduce((acc, s) => acc + (s.progressPercent || 0), 0);
        avg = Math.round(sum / sessions.length);
      }
      if (elAvg) elAvg.textContent = `${avg}%`;

      renderLiveMonitorTable(sessions);
    }
  } catch (err) {
    console.error('Failed to poll live monitor data', err);
  }
}

function renderLiveMonitorTable(sessions) {
  const tbody = document.getElementById('live-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (sessions.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="py-8 text-center text-atelier-inkMuted italic">
          Belum ada siswa yang sedang membuka asesmen di kelas ${currentClass} saat ini. Bagikan tautan kelas kepada siswa.
        </td>
      </tr>
    `;
    return;
  }

  sessions.forEach(s => {
    const isCompleted = s.status === 'completed';
    const isLastQuestion = !isCompleted && s.currentStep >= s.totalSteps;
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-atelier-warm/40 transition';

    const genderBadge = s.gender === 'L' ? '<span class="text-blue-600 font-bold">L</span>' : s.gender === 'P' ? '<span class="text-pink-600 font-bold">P</span>' : '-';

    const startClock = formatClockTime(s.createdAt);
    const startAgo = formatTimeAgo(s.createdAt);

    const lastTs = s.updatedAt || s.lastActive;
    const lastClock = formatClockTime(lastTs);
    const lastAgo = formatTimeAgo(lastTs);
    const lastDateObj = parseSafeDate(lastTs);
    const diffSec = lastDateObj ? Math.floor((new Date().getTime() - lastDateObj.getTime()) / 1000) : 999;
    const isRecent = !isCompleted && diffSec < 20;

    let statusBadgeHtml = '';
    if (isCompleted) {
      statusBadgeHtml = `
        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-bold whitespace-nowrap shadow-xs bg-blue-50 text-blue-700 border border-blue-200">
          <span class="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
          <span>Selesai ✓</span>
        </span>
      `;
    } else if (isLastQuestion) {
      statusBadgeHtml = `
        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-bold whitespace-nowrap shadow-xs bg-amber-50 text-amber-800 border border-amber-200">
          <span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
          <span>Soal Terakhir</span>
        </span>
      `;
    } else {
      statusBadgeHtml = `
        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-bold whitespace-nowrap shadow-xs bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Sedang Menjawab</span>
        </span>
      `;
    }

    tr.innerHTML = `
      <td class="py-3 px-3 font-mono font-bold text-center text-atelier-terracotta">${s.attendanceNo || '-'}</td>
      <td class="py-3 px-3 font-semibold text-atelier-ink flex items-center gap-2">
        <span class="w-2 h-2 rounded-full ${isCompleted ? 'bg-blue-500' : isLastQuestion ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500 animate-pulse'}"></span>
        <span>${s.name}</span>
      </td>
      <td class="py-3 px-3 font-mono text-center">${genderBadge}</td>
      <td class="py-3 px-3">
        <span class="font-mono text-[11px] font-bold text-atelier-terracotta">Soal ${s.currentStep}/${s.totalSteps}</span>
        <span class="block text-[10px] text-atelier-inkMuted truncate max-w-[130px]" title="${s.currentCategory}">${s.currentCategory}</span>
      </td>
      <td class="py-3 px-3">
        <div class="flex items-center gap-2">
          <div class="flex-1 bg-atelier-border h-2 rounded-full overflow-hidden">
            <div class="${isCompleted ? 'bg-blue-600' : isLastQuestion ? 'bg-amber-500' : 'bg-emerald-600'} h-full rounded-full transition-all duration-300" style="width: ${s.progressPercent}%;"></div>
          </div>
          <span class="font-mono text-[11px] font-bold ${isCompleted ? 'text-blue-600' : isLastQuestion ? 'text-amber-700' : 'text-emerald-700'}">${s.progressPercent}%</span>
        </div>
      </td>
      <td class="py-3 px-3 font-mono text-[11px] text-atelier-ochre font-medium">
        ${s.chosenMedia}
      </td>
      <td class="py-3 px-3 text-center">
        <span class="font-mono text-xs font-semibold text-atelier-ink block">${startClock} WIB</span>
        <span class="block text-[10px] text-atelier-inkMuted">${startAgo}</span>
      </td>
      <td class="py-3 px-3">
        <div class="flex items-center gap-1.5">
          <span class="w-1.5 h-1.5 rounded-full ${isCompleted ? 'bg-blue-400' : isRecent ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}"></span>
          <span class="font-mono text-xs font-bold ${isCompleted ? 'text-blue-700' : isRecent ? 'text-emerald-700' : 'text-amber-800'}">${lastAgo}</span>
        </div>
        <span class="block text-[10px] font-mono text-atelier-inkMuted ml-3">${lastClock} WIB</span>
      </td>
      <td class="py-3 px-3 text-center whitespace-nowrap">
        ${statusBadgeHtml}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Robust date parser that handles ISO strings, SQLite CURRENT_TIMESTAMP, and UTC vs local time
function parseSafeDate(dateStr) {
  if (!dateStr) return null;
  if (typeof dateStr !== 'string') return new Date(dateStr);
  // ISO with explicit timezone (Z or +/-offset)
  if (dateStr.includes('T') && (dateStr.endsWith('Z') || dateStr.includes('+') || (dateStr.lastIndexOf('-') > 7))) {
    return new Date(dateStr);
  }
  // ISO without timezone, treat as UTC
  if (dateStr.includes('T')) {
    return new Date(dateStr + 'Z');
  }
  // SQLite format "YYYY-MM-DD HH:MM:SS" (which is in UTC)
  return new Date(dateStr.replace(' ', 'T') + 'Z');
}

function formatClockTime(dateStr) {
  const d = parseSafeDate(dateStr);
  if (!d || isNaN(d.getTime())) return '-';
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  const ss = d.getSeconds().toString().padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function formatTimeAgo(dateStr) {
  const d = parseSafeDate(dateStr);
  if (!d || isNaN(d.getTime())) return 'Baru saja';
  const diffSec = Math.floor((new Date().getTime() - d.getTime()) / 1000);
  if (diffSec < 5) return 'Baru saja';
  if (diffSec < 60) return `${diffSec} detik lalu`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} menit lalu`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} jam lalu`;
  return `${Math.floor(diffHour / 24)} hari lalu`;
}

// ========================================================
// 12. ROSTER TABLE MANAGEMENT (TAHAP 4 CRUD)
// ========================================================
function renderRosterTable(students) {
  const tbody = document.getElementById('roster-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (students.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="py-8 text-center text-atelier-inkMuted italic">
          Belum ada data siswa di kelas ${currentClass}. Bagikan tautan kelas atau gunakan form input kilat di atas.
        </td>
      </tr>
    `;
    return;
  }

  students.forEach((s) => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-atelier-warm/40 transition';

    const genderBadge = s.gender === 'L' ? '<span class="text-blue-600 font-bold">L</span>' : s.gender === 'P' ? '<span class="text-pink-600 font-bold">P</span>' : '-';

    tr.innerHTML = `
      <td class="py-3 px-4 font-mono font-bold text-center text-atelier-terracotta">${s.attendance_no || '-'}</td>
      <td class="py-3 px-4 font-semibold text-atelier-ink">${escapeHtml(s.name)}</td>
      <td class="py-3 px-4 font-mono text-center">${genderBadge}</td>
      <td class="py-3 px-4">
        <span class="px-2 py-0.5 rounded-md font-mono text-[11px] font-bold bg-atelier-terracottaLight text-atelier-terracotta">
          ${escapeHtml(s.style || 'Visual Tutorial')}
        </span>
      </td>
      <td class="py-3 px-4 font-medium text-atelier-ochre">
        ${escapeHtml(s.category || '2D')} (${escapeHtml(s.sub_option || 'Kering')})
      </td>
      <td class="py-3 px-4 text-atelier-inkMuted">
        ${escapeHtml(s.challenge || 'Sketsa Proporsi')}
      </td>
      <td class="py-3 px-4 text-center whitespace-nowrap">
        <button onclick="openEditStudentModal(${s.id})" class="text-[#6366F1] hover:text-[#4F46E5] font-mono text-[11px] font-bold mr-2 cursor-pointer inline-flex items-center gap-1" title="Ubah Data Siswa">
          <span>✏️</span><span>Ubah</span>
        </button>
        <button onclick="handleDeleteStudent(${s.id})" class="text-rose-600 hover:text-rose-800 font-mono text-[11px] font-bold cursor-pointer inline-flex items-center gap-1" title="Hapus Siswa">
          <span>🗑️</span><span>Hapus</span>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function setupRosterHandlers() {
  const form = document.getElementById('quick-add-student-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const attNo = document.getElementById('quick-att').value;
      const name = document.getElementById('quick-name').value.trim();
      const gender = document.getElementById('quick-gender').value;
      const category = document.getElementById('quick-category').value;
      const style = document.getElementById('quick-style').value;

      if (!name || !attNo || !gender) return;

      try {
        const res = await API.createStudent({
          attendance_no: attNo,
          name,
          gender,
          class_id: currentClass,
          category,
          sub_option: 'Kering',
          style,
          challenge: 'Pencarian Ide Awal',
          feeling: 'Senang & Percaya Diri'
        });

        if (res && res.status === 'success') {
          document.getElementById('quick-name').value = '';
          document.getElementById('quick-att').value = '';
          document.getElementById('quick-gender').value = '';
          await loadCurrentClassDetail();
          await loadClassRubricGradebook(currentClass);
        }
      } catch (err) {
        alert('Gagal menambah siswa: ' + err.message);
      }
    });
  }

  const searchInput = document.getElementById('filter-roster-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      const filtered = currentRoster.filter(s => 
        s.name.toLowerCase().includes(q) || 
        (s.attendance_no && s.attendance_no.toString().includes(q))
      );
      renderRosterTable(filtered);
    });
  }
}

function openAddStudentModal() {
  const modal = document.getElementById('modal-student');
  if (!modal) return;
  document.getElementById('modal-student-title').textContent = `Tambah Siswa Lengkap ke Rombel ${currentClass}`;
  document.getElementById('form-student-id').value = '';

  const maxAtt = currentRoster.length > 0
    ? Math.max(...currentRoster.map(s => Number(s.attendance_no) || 0))
    : 0;
  document.getElementById('form-s-attendance').value = maxAtt + 1;
  document.getElementById('form-s-name').value = '';
  document.getElementById('form-s-gender').value = 'L';
  document.getElementById('form-s-category').value = '2D';
  document.getElementById('form-s-suboption').value = 'Kering';
  document.getElementById('form-s-style').value = 'Visual Tutorial';
  document.getElementById('form-s-challenge').value = 'Sketsa Proporsi';
  document.getElementById('form-s-feeling').value = 'Senang & Percaya Diri';

  const btnDelete = document.getElementById('btn-delete-student-modal');
  if (btnDelete) btnDelete.classList.add('hidden');

  modal.classList.remove('hidden');
}

function openEditStudentModal(id) {
  const modal = document.getElementById('modal-student');
  if (!modal) return;
  const s = currentRoster.find(item => item.id == id);
  if (!s) {
    alert('Data siswa tidak ditemukan.');
    return;
  }

  document.getElementById('modal-student-title').textContent = `Ubah Data Siswa: ${s.name}`;
  document.getElementById('form-student-id').value = s.id;
  document.getElementById('form-s-attendance').value = s.attendance_no || '';
  document.getElementById('form-s-name').value = s.name || '';
  document.getElementById('form-s-gender').value = s.gender || 'L';
  document.getElementById('form-s-category').value = s.category || '2D';
  document.getElementById('form-s-suboption').value = s.sub_option || 'Kering';
  document.getElementById('form-s-style').value = s.style || 'Visual Tutorial';
  document.getElementById('form-s-challenge').value = s.challenge || 'Sketsa Proporsi';
  document.getElementById('form-s-feeling').value = s.feeling || 'Senang & Percaya Diri';

  const btnDelete = document.getElementById('btn-delete-student-modal');
  if (btnDelete) btnDelete.classList.remove('hidden');

  modal.classList.remove('hidden');
}

function closeStudentModal() {
  const modal = document.getElementById('modal-student');
  if (modal) modal.classList.add('hidden');
  const form = document.getElementById('form-student');
  if (form) form.reset();
}

async function submitStudentForm(event) {
  event.preventDefault();
  const id = document.getElementById('form-student-id').value;
  const attendance_no = parseInt(document.getElementById('form-s-attendance').value, 10);
  const name = document.getElementById('form-s-name').value.trim();
  const gender = document.getElementById('form-s-gender').value;
  const category = document.getElementById('form-s-category').value;
  const sub_option = document.getElementById('form-s-suboption').value.trim() || 'Kering';
  const style = document.getElementById('form-s-style').value;
  const challenge = document.getElementById('form-s-challenge').value;
  const feeling = document.getElementById('form-s-feeling').value;

  if (!name || isNaN(attendance_no)) {
    alert('Nama dan No. Absen wajib diisi!');
    return;
  }

  const payload = {
    attendance_no,
    name,
    gender,
    class_id: currentClass,
    category,
    sub_option,
    style,
    challenge,
    feeling
  };

  const btnSave = document.getElementById('btn-save-student');
  if (btnSave) {
    btnSave.disabled = true;
    btnSave.textContent = 'Menyimpan...';
  }

  try {
    let res;
    if (id) {
      res = await API.updateStudent(id, payload);
    } else {
      res = await API.createStudent(payload);
    }

    if (res && res.status === 'success') {
      closeStudentModal();
      await loadCurrentClassDetail();
      await loadClassRubricGradebook(currentClass);
    } else {
      alert((res && res.message) || 'Gagal menyimpan data siswa.');
    }
  } catch (err) {
    console.error('Error saving student:', err);
    alert('Gagal menyimpan data siswa: ' + err.message);
  } finally {
    if (btnSave) {
      btnSave.disabled = false;
      btnSave.textContent = 'Simpan Data Siswa';
    }
  }
}

async function deleteCurrentStudentModal() {
  const id = document.getElementById('form-student-id').value;
  if (!id) return;
  closeStudentModal();
  await handleDeleteStudent(id);
}

async function handleDeleteStudent(id, name) {
  if (!name) {
    const s = currentRoster.find(item => item.id == id);
    name = s ? s.name : 'Siswa';
  }
  if (confirm(`Apakah Anda yakin ingin menghapus data siswa "${name}" dari rombel ${currentClass}?`)) {
    try {
      const res = await API.deleteStudent(id);
      if (res && res.status === 'success') {
        await loadCurrentClassDetail();
        await loadClassRubricGradebook(currentClass);
      } else {
        alert((res && res.message) || 'Gagal menghapus siswa.');
      }
    } catch (err) {
      alert('Gagal menghapus siswa: ' + err.message);
    }
  }
}

// ========================================================
// 13. HEATMAP & ANALISIS KELAS (TAHAP 3)
// ========================================================
function renderHeatmap(roster) {
  const stylesContainer = document.getElementById('heatmap-styles-list');
  const mediaContainer = document.getElementById('heatmap-media-list');
  const challengesContainer = document.getElementById('heatmap-challenges-list');

  if (!stylesContainer || !mediaContainer || !challengesContainer) return;

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

// ========================================================
// 14. CRUD SOAL DIAGNOSTIK & TAUTAN (TAHAP 1)
// ========================================================
let loadedQuestions = [];

async function loadQuestionsList() {
  const container = document.getElementById('questions-list-container');
  if (!container) return;
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
  if (!container) return;
  container.innerHTML = '';

  if (questions.length === 0) {
    container.innerHTML = '<p class="text-xs text-atelier-inkMuted italic">Belum ada butir soal asesmen diagnostik.</p>';
    return;
  }

  questions.forEach((q, idx) => {
    const card = document.createElement('div');
    card.className = 'p-4 bg-white rounded-xl border border-atelier-border hover:border-atelier-borderMedium transition space-y-3';
    
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

  if (!modal) return;
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
  const modal = document.getElementById('modal-question');
  if (modal) modal.classList.add('hidden');
}

function addQuestionOptionRow(val = '') {
  const container = document.getElementById('modal-options-container');
  if (!container) return;
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
  const form = document.getElementById('form-question');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
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

  const dashQrImg = document.getElementById('dash-qr-code-img');
  if (dashQrImg) {
    dashQrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(link)}`;
  }

  const dashQrCode = document.getElementById('dash-qr-access-code');
  if (dashQrCode) {
    dashQrCode.textContent = `PALLET-${currentClass.replace('-', '')}`;
  }

  const dashShareBadge = document.getElementById('dash-share-class-badge');
  if (dashShareBadge) {
    dashShareBadge.textContent = currentClass;
  }
}

function copyShareLink() {
  const linkInput = document.getElementById('share-link-input');
  if (linkInput) {
    navigator.clipboard.writeText(linkInput.value).then(() => {
      alert(`Tautan untuk Kelas ${currentClass} berhasil disalin! Siap dibagikan ke WhatsApp grup kelas.`);
    });
  }
}

// ========================================================
// 15. STUDIO TIMER & HETEROGENEOUS GROUPS (TAHAP 7)
// ========================================================
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

  const lbl = document.getElementById('timer-phase-label');
  if (lbl) lbl.textContent = phaseLabels[phase] || '';

  pauseStudioTimer();
  timerSeconds = minutes * 60;
  updateTimerDisplay();
}

function updateTimerDisplay() {
  const m = Math.floor(timerSeconds / 60).toString().padStart(2, '0');
  const s = (timerSeconds % 60).toString().padStart(2, '0');
  const el = document.getElementById('timer-display');
  if (el) el.textContent = `${m}:${s}`;
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

function generateHeteroGroups() {
  const container = document.getElementById('hetero-groups-output');
  if (!container) return;

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
            <span class="font-medium text-atelier-ink">No. ${m.attendance_no || '-'} ${m.name}</span>
            <span class="text-[10px] font-mono text-atelier-inkMuted">${m.style} · ${m.category}</span>
          </div>
        `).join('')}
      </div>
    `;
    container.appendChild(card);
  });
}
