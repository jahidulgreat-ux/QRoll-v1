/* ═══════════════════════════════════════════
   QRoll — app.js
   Complete Application Logic
═══════════════════════════════════════════ */

/* ── Firebase Config ── */
const firebaseConfig = {
  apiKey: "AIzaSyCtO9_7w7Lb-UawTB8iZbwQXXosv2SBCog",
  authDomain: "acs-classes.firebaseapp.com",
  databaseURL: "https://acs-classes-default-rtdb.firebaseio.com",
  projectId: "acs-classes",
  storageBucket: "acs-classes.firebasestorage.app",
  messagingSenderId: "731640781565",
  appId: "1:731640781565:web:3d211de6b3782e9a03fc94",
  measurementId: "G-F2H5RC9VFF"
};

/* ── Cloudinary Config ── */
const CLOUD = {
  name: "dh7iftwxa",
  preset: "unsigned_upload",
  folder: "qroll_reports"
};

/* ── SMS Config ── */
const SMS_KEY = "ekGKVZh3N8HE5MAaymjpvWJfPBzo4OUTsLDI92SliRrFtngub1IJO2jhmSAtfn6l0QBqTWd9oPHKw3k8";

/* ── Global State ── */
let app_fb, db, auth;
let currentUser = null;
let teacherProfile = null;
let allStudents = {};
let todayAttendance = {};
let currentStudentId = null;
let activeFilter = 'all';
let selectedRepDate = null;
let selectedMonth = null;
let reportData = {};
let qrStream = null;
let qrScanAnimFrame = null;
let qrFoundStudent = null;
let donutChart = null;
let weeklyChart = null;
let studentBarChart = null;
let dbListeners = [];

const AVATAR_COLORS = ['#0A10B8','#1555FF','#0891B2','#FF6633','#7C3AED','#16A34A','#D97706','#DC2626'];
const CLASSES = ['Class 1','Class 2','Class 3','Class 4','Class 5','Class 6','Class 7','Class 8','Class 9','Class 10','Class 11','Class 12','UG Year 1','UG Year 2','UG Year 3','UG Year 4'];

/* ═══════════════════════════════════════════
   INIT
═══════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  try {
    app_fb = firebase.initializeApp(firebaseConfig);
    db = firebase.database();
    auth = firebase.auth();
  } catch(e) { console.error('Firebase init:', e); }

  lucide.createIcons();
  initOnboarding();

  auth && auth.onAuthStateChanged(user => {
    if (user) {
      currentUser = user;
      loadTeacherAndGo();
    } else {
      currentUser = null;
      const seen = localStorage.getItem('qroll_onboarded');
      showScreen(seen ? 'screen-auth' : 'screen-onboarding');
    }
  });
});

function initIcons() { try { lucide.createIcons(); } catch(e){} }

/* ═══════════════════════════════════════════
   SCREEN NAVIGATION
═══════════════════════════════════════════ */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => {
    s.style.display = 'none';
    s.classList.remove('active');
  });
  const target = document.getElementById(id);
  if (target) {
    target.style.display = 'flex';
    target.classList.add('active');
  }
  initIcons();
}

function openSlideScreen(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.display = 'flex';
  el.classList.add('active');
  requestAnimationFrame(() => el.classList.add('sliding-in'));
  initIcons();
}

function closeSlideScreen(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('sliding-out');
  setTimeout(() => {
    el.style.display = 'none';
    el.classList.remove('active','sliding-in','sliding-out');
  }, 250);
}

function openModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.display = 'flex';
  el.classList.add('active');
  requestAnimationFrame(() => el.classList.add('modal-in'));
  initIcons();
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.display = 'none';
  el.classList.remove('active','modal-in');
}

/* ── Tab Switching ── */
function switchTab(tab) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active-panel'));
  document.querySelectorAll('.nav-tab').forEach(n => n.classList.remove('active-nav'));
  const panel = document.getElementById('tab-' + tab);
  const navBtn = document.querySelector('.nav-tab[data-tab="' + tab + '"]');
  if (panel) panel.classList.add('active-panel');
  if (navBtn) navBtn.classList.add('active-nav');
  initIcons();
  if (tab === 'dashboard') refreshDashboard();
  if (tab === 'students') renderStudentsList();
  if (tab === 'reports') initReportsTab();
  if (tab === 'profile') renderProfile();
}

/* ═══════════════════════════════════════════
   ONBOARDING
═══════════════════════════════════════════ */
let obIndex = 0;

function initOnboarding() {
  buildClassPickers();
  buildDatePills();
  buildMonthPills();
  setTimeout(() => {
    const bar = document.getElementById('setup-bar');
    if (bar) bar.style.width = '100%';
  }, 400);
}

const obNextBtn = document.getElementById('ob-next-btn');
const obSkipBtn = document.getElementById('ob-skip-btn');
if (obNextBtn) {
  obNextBtn.addEventListener('click', () => {
    obIndex++;
    if (obIndex >= 3) { finishOnboarding(); return; }
    const wrap = document.getElementById('ob-slides-wrap');
    if (wrap) {
      wrap.style.transition = 'transform .4s cubic-bezier(.22,1,.36,1)';
      wrap.style.transform = 'translateX(-' + (obIndex * 100) + '%)';
    }
    document.querySelectorAll('.ob-dot').forEach((d,i) => d.classList.toggle('active', i === obIndex));
    if (obIndex === 2) obNextBtn.textContent = 'Get Started';
  });
}
if (obSkipBtn) obSkipBtn.addEventListener('click', finishOnboarding);

function finishOnboarding() {
  localStorage.setItem('qroll_onboarded','1');
  showScreen('screen-auth');
}

/* ═══════════════════════════════════════════
   AUTH
═══════════════════════════════════════════ */
function toLogin() {
  document.getElementById('signup-wrap').style.display = 'none';
  document.getElementById('login-wrap').style.display = 'block';
  document.getElementById('auth-hero-sub').textContent = 'Welcome back, Teacher';
  initIcons();
}
function toSignup() {
  document.getElementById('login-wrap').style.display = 'none';
  document.getElementById('signup-wrap').style.display = 'block';
  document.getElementById('auth-hero-sub').textContent = 'Create your teacher account';
  initIcons();
}

async function doSignup() {
  const name = v('su-name');
  const email = v('su-email');
  const pass = document.getElementById('su-pass').value;
  if (!name || !email || !pass) { toast('Fill in all fields', 'error'); return; }
  if (pass.length < 6) { toast('Password must be at least 6 characters', 'error'); return; }
  try {
    const cred = await auth.createUserWithEmailAndPassword(email, pass);
    await cred.user.updateProfile({ displayName: name });
    await db.ref('users/' + cred.user.uid).set({ name, email, createdAt: Date.now() });
    currentUser = cred.user;
    showScreen('screen-setup');
  } catch(e) { toast(friendlyAuthError(e), 'error'); }
}

async function doLogin() {
  const email = v('li-email');
  const pass = document.getElementById('li-pass').value;
  if (!email || !pass) { toast('Fill in all fields', 'error'); return; }
  try {
    await auth.signInWithEmailAndPassword(email, pass);
  } catch(e) { toast(friendlyAuthError(e), 'error'); }
}

async function doGoogle() {
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    await auth.signInWithPopup(provider);
  } catch(e) { toast('Google sign-in failed', 'error'); }
}

async function doForgot() {
  const email = v('li-email');
  if (!email) { toast('Enter your email first', 'warning'); return; }
  try {
    await auth.sendPasswordResetEmail(email);
    toast('Password reset email sent!');
  } catch(e) { toast(friendlyAuthError(e), 'error'); }
}

async function doSignOut() {
  if (!confirm('Sign out of QRoll?')) return;
  cleanupListeners();
  await auth.signOut();
  allStudents = {}; todayAttendance = {}; teacherProfile = null;
  showScreen('screen-auth');
}

function doChangePassword() {
  if (!currentUser?.email) { toast('No email on account', 'warning'); return; }
  auth.sendPasswordResetEmail(currentUser.email)
    .then(() => toast('Password reset email sent!'))
    .catch(() => toast('Failed to send reset email', 'error'));
}

function friendlyAuthError(e) {
  const c = e.code || '';
  if (c.includes('email-already')) return 'Email already in use';
  if (c.includes('wrong-password') || c.includes('invalid-credential')) return 'Incorrect email or password';
  if (c.includes('user-not-found')) return 'No account with this email';
  if (c.includes('weak-password')) return 'Password too weak';
  if (c.includes('invalid-email')) return 'Invalid email address';
  return e.message || 'Authentication failed';
}

function togglePwd(id, btn) {
  const inp = document.getElementById(id);
  if (!inp) return;
  inp.type = inp.type === 'password' ? 'text' : 'password';
  btn.innerHTML = inp.type === 'password' ? '<i data-lucide="eye"></i>' : '<i data-lucide="eye-off"></i>';
  initIcons();
}

async function loadTeacherAndGo() {
  try {
    const snap = await db.ref('users/' + currentUser.uid).get();
    teacherProfile = snap.exists() ? snap.val() : null;
    if (!teacherProfile?.schoolName) {
      showScreen('screen-setup');
    } else {
      goToMain();
    }
  } catch(e) { goToMain(); }
}

/* ═══════════════════════════════════════════
   SCHOOL SETUP
═══════════════════════════════════════════ */
function buildClassPickers() {
  ['class-picker-opts','ep-class-picker-opts'].forEach(id => {
    const cont = document.getElementById(id);
    if (!cont) return;
    cont.innerHTML = CLASSES.map(c =>
      '<div class="bs-opt" onclick="pickClass(\'' + c + '\',\'' + id + '\')">' + c + '</div>'
    ).join('');
  });
  initIcons();
}

function openPicker(hiddenId, labelId, pickerId) {
  const el = document.getElementById(pickerId);
  if (el) el.style.display = 'flex';
  initIcons();
}
function closePicker(pickerId) {
  const el = document.getElementById(pickerId);
  if (el) el.style.display = 'none';
}

function pickClass(val, optsId) {
  if (optsId === 'class-picker-opts') {
    setVal('setup-class', val);
    const lbl = document.getElementById('setup-class-label');
    if (lbl) { lbl.textContent = val; lbl.classList.add('has-val'); }
    closePicker('class-picker');
  } else {
    setVal('ep-class', val);
    const lbl = document.getElementById('ep-class-label');
    if (lbl) { lbl.textContent = val; lbl.classList.add('has-val'); }
    closePicker('ep-class-picker');
  }
  document.querySelectorAll('#' + optsId + ' .bs-opt').forEach(o => {
    o.classList.toggle('selected', o.textContent === val);
  });
}

async function saveSetup() {
  const school = v('setup-school');
  const cls = v('setup-class');
  if (!school || !cls) { toast('School name and class are required', 'error'); return; }
  try {
    const data = {
      name: currentUser.displayName || teacherProfile?.name || 'Teacher',
      email: currentUser.email,
      schoolName: school,
      address: v('setup-addr'),
      principalName: v('setup-principal'),
      class: cls,
      section: v('setup-section'),
      updatedAt: Date.now()
    };
    await db.ref('users/' + currentUser.uid).update(data);
    teacherProfile = Object.assign({}, teacherProfile, data);
    goToMain();
  } catch(e) { toast('Failed to save: ' + e.message, 'error'); }
}

/* ═══════════════════════════════════════════
   MAIN APP BOOTSTRAP
═══════════════════════════════════════════ */
function goToMain() {
  showScreen('screen-main');
  loadAllStudents();
  setupDashboardListener();
  switchTab('dashboard');
}

function cleanupListeners() {
  dbListeners.forEach(ref => { try { ref.off(); } catch(e){} });
  dbListeners = [];
}

/* ═══════════════════════════════════════════
   FIREBASE DATA LOADERS
═══════════════════════════════════════════ */
function loadAllStudents() {
  if (!currentUser) return;
  const ref = db.ref('users/' + currentUser.uid + '/students');
  dbListeners.push(ref);
  ref.on('value', snap => {
    allStudents = snap.val() || {};
    renderStudentsList();
    updateFilterChips();
    refreshDashboard();
  });
}

function setupDashboardListener() {
  if (!currentUser) return;
  const today = todayStr(new Date());
  const ref = db.ref('users/' + currentUser.uid + '/attendance/' + today);
  dbListeners.push(ref);
  ref.on('value', snap => {
    todayAttendance = snap.val() || {};
    refreshDashboard();
  });
}

/* ═══════════════════════════════════════════
   DASHBOARD
═══════════════════════════════════════════ */
function refreshDashboard() {
  if (!teacherProfile) return;
  const now = new Date();
  const h = now.getHours();
  const greeting = h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening';
  setText('dash-greeting', greeting);
  setText('dash-date', formatDate(now));
  setText('dash-name', teacherProfile.name || 'Teacher');
  const sub = [teacherProfile.class, teacherProfile.section ? 'Section ' + teacherProfile.section : '', teacherProfile.schoolName].filter(Boolean).join(' · ');
  setText('dash-sub', sub);

  const total = Object.keys(allStudents).length;
  let present = 0, absent = 0, late = 0;
  Object.values(todayAttendance).forEach(a => {
    if (a.status === 'present') present++;
    else if (a.status === 'absent') absent++;
    else if (a.status === 'late') late++;
  });

  setText('ms-total', total);
  setText('ms-present', present);
  setText('ms-absent', absent);
  setText('sc-absent', absent);
  setText('sc-days', getDaysInCurrentMonth());
  setText('sc-month', now.toLocaleString('default',{month:'long',year:'numeric'}));

  const pct = total > 0 ? Math.round(((present + late) / total) * 100) : 0;
  setText('donut-pct', pct + '%');
  setText('dl-present', present);
  setText('dl-absent', absent);
  setText('dl-late', late);
  setText('sc-week', pct + '%');
  setText('sc-mavg', pct + '%');
  setText('sc-sms', absent > 0 ? 'SMS sent to ' + absent + ' parent' + (absent > 1 ? 's' : '') : 'No absences today');

  renderDonutChart(present, absent, late, total);
  renderAbsentees();
}

function renderDonutChart(present, absent, late, total) {
  const ctx = document.getElementById('donut-chart');
  if (!ctx) return;
  const notMarked = Math.max(0, total - present - absent - late);
  if (donutChart) { donutChart.destroy(); donutChart = null; }
  donutChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      datasets: [{
        data: [present || 0.01, absent || 0.01, late || 0.01, notMarked || 0.01],
        backgroundColor: ['#16A34A','#DC2626','#D97706','#E8EAF6'],
        borderWidth: 0, hoverOffset: 4
      }]
    },
    options: {
      cutout: '72%', responsive: false,
      plugins: { legend:{display:false}, tooltip:{enabled:false} },
      animation: { animateRotate:true, duration:1200, easing:'easeOutQuart' }
    }
  });
}

function renderAbsentees() {
  const cont = document.getElementById('dash-absentees');
  if (!cont) return;
  const absentList = Object.entries(allStudents).filter(([id]) => todayAttendance[id]?.status === 'absent');
  if (absentList.length === 0) {
    cont.innerHTML = '<div class="no-absentees">All present today!</div>';
    return;
  }
  cont.innerHTML = absentList.map(([id, stu]) => {
    const smsSent = todayAttendance[id]?.smsSent;
    const color = avatarColor(stu.name);
    return '<div class="absentee-chip">' +
      '<div class="ac-avatar" style="background:' + color + '20;color:' + color + '">' + (stu.name||'?')[0].toUpperCase() + '</div>' +
      '<div class="ac-name">' + esc(stu.name) + '</div>' +
      '<span class="badge badge-absent">ABSENT</span>' +
      (smsSent ? '<div class="ac-sms"><i data-lucide="check-circle" style="width:11px;height:11px"></i> SMS Sent</div>' : '') +
      '</div>';
  }).join('');
  initIcons();
}

/* ═══════════════════════════════════════════
   STUDENTS
═══════════════════════════════════════════ */
function renderStudentsList() {
  const cont = document.getElementById('students-list');
  const empty = document.getElementById('stu-empty');
  if (!cont) return;

  const keys = Object.keys(allStudents);
  const search = (document.getElementById('stu-search')?.value || '').toLowerCase();

  let filtered = keys.filter(id => {
    const s = allStudents[id];
    const matchSearch = !search || (s.name||'').toLowerCase().includes(search) || (s.rollNo||'').toLowerCase().includes(search);
    const status = todayAttendance[id]?.status || 'notmarked';
    const matchFilter = activeFilter === 'all' || status === activeFilter;
    return matchSearch && matchFilter;
  });

  filtered.sort((a,b) => {
    const sa = todayAttendance[a]?.status, sb = todayAttendance[b]?.status;
    if (sa === 'absent' && sb !== 'absent') return -1;
    if (sb === 'absent' && sa !== 'absent') return 1;
    return (allStudents[a].rollNo||'').localeCompare(allStudents[b].rollNo||'',undefined,{numeric:true});
  });

  if (empty) empty.style.display = keys.length === 0 ? 'flex' : 'none';
  cont.querySelectorAll('.stu-row,.empty-state:not(#stu-empty)').forEach(r => r.remove());

  if (filtered.length === 0 && keys.length > 0) {
    const d = document.createElement('div');
    d.className = 'empty-state';
    d.innerHTML = '<h3>No student found</h3><p>Check the name or roll number.</p>';
    cont.appendChild(d);
    return;
  }

  filtered.forEach(id => {
    const s = allStudents[id];
    const status = todayAttendance[id]?.status;
    const color = avatarColor(s.name);
    const roll = (s.rollNo||'').toString().padStart(2,'0');
    const badge = status
      ? '<span class="badge badge-' + status + '">' + status.toUpperCase() + '</span>'
      : '<span class="badge badge-notmarked">— Not Marked</span>';
    const row = document.createElement('div');
    row.className = 'stu-row';
    row.innerHTML =
      '<div class="stu-avatar" style="background:' + color + '">' + (s.name||'?')[0].toUpperCase() + '</div>' +
      '<div class="stu-info"><div class="stu-name-row"><span class="stu-name">' + esc(s.name) + '</span>' + badge + '</div>' +
      '<div class="stu-meta">Roll: ' + roll + ' · Father: ' + esc(s.fatherName||'--') + '</div></div>' +
      '<i data-lucide="chevron-right" class="stu-arr"></i>';
    row.addEventListener('click', () => openStudentDetail(id));
    cont.appendChild(row);
  });
  updateFilterChips();
  initIcons();
}

function updateFilterChips() {
  const total = Object.keys(allStudents).length;
  let present = 0, absent = 0, late = 0;
  Object.values(todayAttendance).forEach(a => {
    if (a.status === 'present') present++;
    else if (a.status === 'absent') absent++;
    else if (a.status === 'late') late++;
  });
  const chips = document.getElementById('filter-chips');
  if (!chips) return;
  chips.querySelector('[data-filter="all"]').textContent = 'All (' + total + ')';
  chips.querySelector('[data-filter="present"]').textContent = 'Present (' + present + ')';
  chips.querySelector('[data-filter="absent"]').textContent = 'Absent (' + absent + ')';
  chips.querySelector('[data-filter="late"]').textContent = 'Late (' + late + ')';
}

function filterStudents(val) {
  const clear = document.getElementById('search-clear');
  if (clear) clear.style.display = val ? 'flex' : 'none';
  renderStudentsList();
}

function clearSearch() {
  const inp = document.getElementById('stu-search');
  if (inp) inp.value = '';
  filterStudents('');
}

function setFilter(filter, btn) {
  activeFilter = filter;
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('chip-active'));
  btn.classList.add('chip-active');
  renderStudentsList();
}

/* ── Add Student ── */
function openAddStudent() {
  ['add-name','add-roll','add-dob','add-father','add-mother','add-phone','add-addr'].forEach(id => setVal(id,''));
  openModal('modal-add-stu');
}
function closeAddStudent() { closeModal('modal-add-stu'); }

async function saveStudent() {
  const name = v('add-name');
  const roll = v('add-roll');
  if (!name || !roll) { toast('Name and roll number are required', 'error'); return; }
  try {
    const ref = db.ref('users/' + currentUser.uid + '/students').push();
    const id = ref.key;
    const qrData = 'QROLL|' + currentUser.uid + '|' + id + '|' + name + '|' + roll;
    await ref.set({
      name, rollNo: roll, dob: v('add-dob'),
      fatherName: v('add-father'), motherName: v('add-mother'),
      parentPhone: v('add-phone'), address: v('add-addr'),
      qrData, createdAt: Date.now()
    });
    closeAddStudent();
    toast('Student added & QR code generated!');
    switchTab('students');
  } catch(e) { toast('Failed to add student: ' + e.message, 'error'); }
}

/* ── Edit Student ── */
function editCurrentStudent() {
  closeStudentMore();
  const s = allStudents[currentStudentId];
  if (!s) return;
  setVal('es-name', s.name); setVal('es-roll', s.rollNo); setVal('es-dob', s.dob);
  setVal('es-father', s.fatherName); setVal('es-mother', s.motherName);
  setVal('es-phone', s.parentPhone); setVal('es-addr', s.address);
  openModal('modal-edit-stu');
}
function closeEditStudent() { closeModal('modal-edit-stu'); }

async function updateStudent() {
  if (!currentStudentId) return;
  const name = v('es-name'), roll = v('es-roll');
  if (!name || !roll) { toast('Name and roll number are required', 'error'); return; }
  try {
    const qrData = 'QROLL|' + currentUser.uid + '|' + currentStudentId + '|' + name + '|' + roll;
    await db.ref('users/' + currentUser.uid + '/students/' + currentStudentId).update({
      name, rollNo: roll, dob: v('es-dob'), fatherName: v('es-father'),
      motherName: v('es-mother'), parentPhone: v('es-phone'), address: v('es-addr'), qrData
    });
    closeEditStudent();
    toast('Student updated!');
    openStudentDetail(currentStudentId);
  } catch(e) { toast('Update failed: ' + e.message, 'error'); }
}

async function deleteCurrentStudent() {
  if (!currentStudentId) return;
  if (!confirm('Delete this student? All attendance data will be removed.')) return;
  try {
    await db.ref('users/' + currentUser.uid + '/students/' + currentStudentId).remove();
    closeStudentDetail();
    closeStudentMore();
    toast('Student deleted');
  } catch(e) { toast('Delete failed: ' + e.message, 'error'); }
}

/* ── Student Detail ── */
async function openStudentDetail(id) {
  currentStudentId = id;
  const s = allStudents[id];
  if (!s) return;
  const color = avatarColor(s.name);
  const roll = (s.rollNo||'').toString().padStart(2,'0');
  const av = document.getElementById('det-avatar');
  if (av) { av.textContent = (s.name||'?')[0].toUpperCase(); av.style.background = color; }
  setText('det-header-name', s.name);
  setText('det-name', s.name);
  setText('det-meta', 'Roll: ' + roll + ' · ' + (teacherProfile?.class||''));
  setText('det-parent', 'Father: ' + (s.fatherName||'--'));
  setText('det-phone', s.parentPhone||'--');
  openSlideScreen('screen-stu-detail');
  try {
    const snap = await db.ref('users/' + currentUser.uid + '/attendance').get();
    const attData = snap.val() || {};
    let present = 0, absent = 0, late = 0;
    const log = [];
    Object.entries(attData).forEach(([date, dayData]) => {
      const entry = dayData[id];
      if (entry) {
        if (entry.status === 'present') present++;
        else if (entry.status === 'absent') absent++;
        else if (entry.status === 'late') late++;
        log.push({ date, ...entry });
      }
    });
    log.sort((a,b) => b.date.localeCompare(a.date));
    setText('det-present', present);
    setText('det-absent', absent);
    setText('det-late', late);
    const total = present + absent + late;
    setText('det-pct', total > 0 ? Math.round((present/total)*100) + '%' : '0%');
    renderStudentBarChart(id, attData);
    renderStudentHeatmap(id, attData);
    renderStudentLog(log);
  } catch(e) { console.error(e); }
}

function closeStudentDetail() {
  closeSlideScreen('screen-stu-detail');
  if (studentBarChart) { studentBarChart.destroy(); studentBarChart = null; }
}

function openStudentMore() {
  const s = document.getElementById('stu-more-sheet');
  if (s) s.style.display = 'flex';
  initIcons();
}
function closeStudentMore() {
  const s = document.getElementById('stu-more-sheet');
  if (s) s.style.display = 'none';
}

function renderStudentBarChart(stuId, attData) {
  const ctx = document.getElementById('stu-bar-chart');
  if (!ctx) return;
  if (studentBarChart) { studentBarChart.destroy(); studentBarChart = null; }
  const now = new Date();
  const year = now.getFullYear(), month = now.getMonth();
  const days = new Date(year, month+1, 0).getDate();
  const labels = [], colors = [], vals = [];
  for (let d = 1; d <= days; d++) {
    const ds = year + '-' + String(month+1).padStart(2,'0') + '-' + String(d).padStart(2,'0');
    const entry = attData[ds]?.[stuId];
    labels.push(String(d));
    if (!entry) { colors.push('#E8EAF6'); vals.push(0.2); }
    else if (entry.status === 'present') { colors.push('#0A10B8'); vals.push(1); }
    else if (entry.status === 'absent') { colors.push('#DC2626'); vals.push(1); }
    else if (entry.status === 'late') { colors.push('#D97706'); vals.push(0.7); }
    else { colors.push('#E8EAF6'); vals.push(0.2); }
  }
  studentBarChart = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ data: vals, backgroundColor: colors, borderRadius: 4, maxBarThickness: 10 }] },
    options: {
      responsive: true,
      plugins: { legend:{display:false}, tooltip:{enabled:false} },
      scales: {
        x: { grid:{display:false}, ticks:{font:{size:9},color:'#A0A5C8'} },
        y: { display:false, min:0, max:1 }
      },
      animation: { duration:800 }
    }
  });
}

function renderStudentHeatmap(stuId, attData) {
  const cont = document.getElementById('stu-heatmap');
  if (!cont) return;
  const now = new Date();
  renderHeatmapGrid(cont, now.getFullYear(), now.getMonth(), stuId, attData);
}

function renderHeatmapGrid(cont, year, month, stuId, attData) {
  const days = ['M','T','W','T','F','S','S'];
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const offset = firstDay === 0 ? 6 : firstDay - 1;
  let html = days.map(d => '<div class="hm-day-header">' + d + '</div>').join('');
  for (let i = 0; i < offset; i++) html += '<div class="hm-cell hm-empty"></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = year + '-' + String(month+1).padStart(2,'0') + '-' + String(d).padStart(2,'0');
    const entry = stuId ? attData[ds]?.[stuId] : null;
    const isFuture = new Date(ds) > new Date();
    let cls = 'hm-cell hm-future';
    if (!isFuture) {
      if (!entry) cls = 'hm-cell hm-empty';
      else if (entry.status === 'present') cls = 'hm-cell hm-present';
      else if (entry.status === 'absent') cls = 'hm-cell hm-absent';
      else if (entry.status === 'late') cls = 'hm-cell hm-late';
    }
    html += '<div class="' + cls + '">' + d + '</div>';
  }
  cont.innerHTML = html;
}

function renderStudentLog(entries) {
  const cont = document.getElementById('stu-att-log');
  if (!cont) return;
  if (entries.length === 0) {
    cont.innerHTML = '<div style="padding:16px;text-align:center;color:var(--tx2)">No attendance records yet</div>';
    return;
  }
  cont.innerHTML = entries.map((e,i) =>
    '<div class="att-log-row">' +
    '<div class="log-date">' + formatDateShort(e.date) + '</div>' +
    '<div class="log-right">' +
    '<span class="badge badge-' + (e.status||'notmarked') + '">' + (e.status||'--').toUpperCase() + '</span>' +
    '<div class="log-time">' + (e.time ? new Date(e.time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : '--') + '</div>' +
    (e.smsSent ? '<div class="log-sms"><i data-lucide="check-circle" style="width:11px;height:11px"></i> SMS sent</div>' : '') +
    '</div></div>'
  ).join('');
  initIcons();
}

function exportStudentLog() {
  const s = allStudents[currentStudentId];
  if (!s) return;
  toast('Exporting log for ' + s.name + '...', 'warning');
}

async function sendManualSMS() {
  closeStudentMore();
  const s = allStudents[currentStudentId];
  if (!s?.parentPhone) { toast('No phone number on file', 'error'); return; }
  const sent = await sendSMS(s.parentPhone, s.name, todayStr(new Date()));
  toast(sent ? 'SMS sent to parent!' : 'Opened WhatsApp for manual send', sent ? 'success' : 'warning');
}

/* ── Student QR ── */
function openStudentQR() {
  closeStudentMore();
  const s = allStudents[currentStudentId];
  if (!s) return;
  const roll = (s.rollNo||'').toString().padStart(2,'0');
  setText('qr-disp-name', s.name);
  setText('qr-disp-roll', 'Roll: ' + roll);
  setText('qr-disp-class', [teacherProfile?.class, teacherProfile?.section ? 'Sec ' + teacherProfile.section : ''].filter(Boolean).join(' · '));
  setText('qr-card-school', teacherProfile?.schoolName || 'School');
  const container = document.getElementById('qr-render');
  container.innerHTML = '';
  const qrData = s.qrData || ('QROLL|' + currentUser.uid + '|' + currentStudentId + '|' + s.name + '|' + s.rollNo);
  try {
    new QRCode(container, { text: qrData, width: 220, height: 220, colorDark: '#0A10B8', colorLight: '#FFFFFF', correctLevel: QRCode.CorrectLevel.H });
  } catch(e) {
    container.innerHTML = '<img src="https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=' + encodeURIComponent(qrData) + '&color=0A10B8&bgcolor=FFFFFF" style="width:220px;height:220px;border-radius:8px">';
  }
  openSlideScreen('screen-stu-qr');
}

function closeStudentQR() { closeSlideScreen('screen-stu-qr'); }

async function downloadQR() {
  const s = allStudents[currentStudentId];
  if (!s) return;
  const btn = document.getElementById('qr-dl-btn');
  const canvas = document.querySelector('#qr-render canvas');
  const img = document.querySelector('#qr-render img');
  if (canvas) {
    if (btn) { btn.innerHTML = '<i data-lucide="loader-2"></i> Uploading...'; initIcons(); }
    canvas.toBlob(async blob => {
      const url = await uploadToCloudinary(blob, s.name + '_QR.png');
      if (url) {
        window.open(url, '_blank');
        if (btn) { btn.innerHTML = '<i data-lucide="external-link"></i> Open QR'; initIcons(); }
        toast('QR code ready!');
      } else {
        const a = document.createElement('a');
        a.download = s.name + '_QR.png';
        a.href = canvas.toDataURL();
        a.click();
        if (btn) { btn.innerHTML = '<i data-lucide="download"></i> Download QR Code'; initIcons(); }
      }
    });
  } else if (img) {
    const a = document.createElement('a');
    a.href = img.src; a.download = s.name + '_QR.png'; a.click();
  }
}

function shareQR() {
  const s = allStudents[currentStudentId];
  if (!s) return;
  const text = 'QR Code for ' + s.name + ' (Roll: ' + s.rollNo + ') — QRoll';
  if (navigator.share) navigator.share({ title: 'Student QR Code', text }).catch(()=>{});
  else toast('Copy: ' + text, 'warning');
}

/* ═══════════════════════════════════════════
   QR SCANNER
═══════════════════════════════════════════ */
async function openScanner() {
  const scanScreen = document.getElementById('screen-scanner');
  if (scanScreen) scanScreen.style.display = 'flex';
  resetQRPanel();
  try {
    qrStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    const video = document.getElementById('qr-video');
    video.srcObject = qrStream;
    await video.play();
    qrScanAnimFrame = requestAnimationFrame(scanQRFrame);
  } catch(e) {
    toast('Camera access denied. Please allow camera.', 'error');
    closeScanner();
  }
}

function closeScanner() {
  if (qrStream) { qrStream.getTracks().forEach(t => t.stop()); qrStream = null; }
  if (qrScanAnimFrame) { cancelAnimationFrame(qrScanAnimFrame); qrScanAnimFrame = null; }
  const s = document.getElementById('screen-scanner');
  if (s) s.style.display = 'none';
  showScreen('screen-main');
}

function toggleFlash() {
  if (!qrStream) return;
  const track = qrStream.getVideoTracks()[0];
  if (!track) return;
  const caps = track.getCapabilities ? track.getCapabilities() : {};
  if (!caps.torch) { toast('Flash not available', 'warning'); return; }
  const cur = (track.getSettings ? track.getSettings() : {}).torch || false;
  track.applyConstraints({ advanced: [{ torch: !cur }] });
}

function scanQRFrame() {
  const video = document.getElementById('qr-video');
  if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) {
    qrScanAnimFrame = requestAnimationFrame(scanQRFrame);
    return;
  }
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
  if (code) { handleQRResult(code.data); return; }
  qrScanAnimFrame = requestAnimationFrame(scanQRFrame);
}

async function handleQRResult(raw) {
  cancelAnimationFrame(qrScanAnimFrame);
  setQRState('scanning');
  const parts = raw.split('|');
  if (parts[0] !== 'QROLL' || parts[1] !== currentUser.uid || !parts[2]) {
    setQRState('unknown'); resumeScanning(); return;
  }
  const studentId = parts[2];
  const student = allStudents[studentId];
  if (!student) { setQRState('unknown'); resumeScanning(); return; }
  qrFoundStudent = { id: studentId, ...student };
  const existing = todayAttendance[studentId];
  if (existing) {
    const detail = document.getElementById('qr-already-detail');
    if (detail) detail.textContent = student.name + ' — ' + existing.status.toUpperCase() + ' at ' + (existing.time ? new Date(existing.time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : '--');
    setQRState('already'); resumeScanning(); return;
  }
  const color = avatarColor(student.name);
  const av = document.getElementById('qr-found-avatar');
  if (av) { av.textContent = (student.name||'?')[0].toUpperCase(); av.style.background = color; }
  setText('qr-found-name', student.name);
  setText('qr-found-roll', 'Roll: ' + (student.rollNo||'').toString().padStart(2,'0'));
  const timeEl = document.getElementById('qr-found-time');
  if (timeEl) timeEl.textContent = new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  setQRState('found');
}

function setQRState(state) {
  ['ready','scanning','found','already','unknown'].forEach(s => {
    const el = document.getElementById('qr-state-' + s);
    if (el) el.style.display = s === state ? 'block' : 'none';
  });
  initIcons();
}

function resetQRPanel() {
  qrFoundStudent = null;
  setQRState('ready');
}

function resumeScanning() {
  setTimeout(() => {
    if (qrStream) qrScanAnimFrame = requestAnimationFrame(scanQRFrame);
  }, 2000);
}

async function markFromQR(status) {
  if (!qrFoundStudent) return;
  const { id, name, parentPhone } = qrFoundStudent;
  const now = new Date();
  const dateKey = todayStr(now);
  try {
    await db.ref('users/' + currentUser.uid + '/attendance/' + dateKey + '/' + id).set({
      status, time: now.toISOString(), smsSent: false, smsTimestamp: null
    });
    todayAttendance[id] = { status, time: now.toISOString(), smsSent: false };
    if (status === 'absent' && parentPhone) {
      const sent = await sendSMS(parentPhone, name, dateKey);
      if (sent) {
        await db.ref('users/' + currentUser.uid + '/attendance/' + dateKey + '/' + id).update({ smsSent: true, smsTimestamp: now.toISOString() });
        todayAttendance[id].smsSent = true;
      }
    }
    closeScanner();
    showAttendanceConfirmed(name, status, now);
  } catch(e) { toast('Failed to mark attendance: ' + e.message, 'error'); }
}

/* ═══════════════════════════════════════════
   ATTENDANCE CONFIRMED SCREEN
═══════════════════════════════════════════ */
function showAttendanceConfirmed(name, status, time) {
  setText('att-conf-name', name);
  setText('att-conf-status', status.toUpperCase());
  setText('att-conf-time', 'Marked at ' + time.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}));
  const screen = document.getElementById('screen-att-conf');
  if (screen) screen.style.display = 'flex';
  const prog = document.getElementById('att-prog');
  if (prog) {
    prog.style.width = '0%';
    prog.style.transition = 'none';
    requestAnimationFrame(() => {
      prog.style.transition = 'width 2.5s linear';
      prog.style.width = '100%';
    });
  }
  setTimeout(closeAttConf, 2500);
  initIcons();
}

function closeAttConf() {
  const screen = document.getElementById('screen-att-conf');
  if (screen) screen.style.display = 'none';
  openScanner();
}

/* ═══════════════════════════════════════════
   SMS
═══════════════════════════════════════════ */
async function sendSMS(phone, studentName, date, msg) {
  const cleanPhone = phone.replace(/\D/g,'').replace(/^91/,'').replace(/^0/,'');
  const message = msg || ('Dear Parent, your ward ' + studentName + ' was absent on ' + formatDateShort(date) + '. -QRoll');
  try {
    const res = await fetch('https://www.fast2sms.com/dev/bulkV2', {
      method: 'POST',
      headers: { 'authorization': SMS_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ route: 'q', message, numbers: cleanPhone, flash: 0 })
    });
    const data = await res.json();
    if (data.return) return true;
  } catch(e) {}
  // WhatsApp fallback
  window.open('https://wa.me/91' + cleanPhone + '?text=' + encodeURIComponent(message), '_blank');
  return false;
}

/* ═══════════════════════════════════════════
   REPORTS
═══════════════════════════════════════════ */
function initReportsTab() {
  buildDatePills();
  buildWeekOptions();
  buildMonthPills();
  if (!selectedRepDate) selectedRepDate = todayStr(new Date());
  loadDailyReport(selectedRepDate);
}

function switchRepTab(tab, btn) {
  document.querySelectorAll('.rep-tab').forEach(t => t.classList.remove('rep-tab-active'));
  btn.classList.add('rep-tab-active');
  document.getElementById('rep-daily').style.display = tab === 'daily' ? 'block' : 'none';
  document.getElementById('rep-weekly').style.display = tab === 'weekly' ? 'block' : 'none';
  document.getElementById('rep-monthly').style.display = tab === 'monthly' ? 'block' : 'none';
  if (tab === 'daily') loadDailyReport(selectedRepDate);
  if (tab === 'weekly') loadWeekly();
  if (tab === 'monthly') loadMonthly();
}

function buildDatePills() {
  const cont = document.getElementById('date-pills');
  if (!cont) return;
  const today = new Date();
  if (!selectedRepDate) selectedRepDate = todayStr(today);
  cont.innerHTML = '';
  for (let i = -3; i <= 3; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const str = todayStr(d);
    const pill = document.createElement('div');
    pill.className = 'date-pill' + (str === selectedRepDate ? ' dp-active' : '');
    pill.innerHTML = '<div class="dp-day">' + d.getDate() + '</div><div class="dp-wday">' + d.toLocaleDateString('en',{weekday:'short'}) + '</div>';
    pill.addEventListener('click', () => {
      document.querySelectorAll('.date-pill').forEach(p => p.classList.remove('dp-active'));
      pill.classList.add('dp-active');
      selectedRepDate = str;
      loadDailyReport(str);
    });
    cont.appendChild(pill);
  }
}

function reportDateNav(dir) {
  const d = new Date(selectedRepDate || todayStr(new Date()));
  d.setDate(d.getDate() + dir);
  selectedRepDate = todayStr(d);
  buildDatePills();
  loadDailyReport(selectedRepDate);
}

async function loadDailyReport(dateStr) {
  if (!currentUser) return;
  try {
    const snap = await db.ref('users/' + currentUser.uid + '/attendance/' + dateStr).get();
    const attDay = snap.val() || {};
    const total = Object.keys(allStudents).length;
    let present = 0, absent = 0, late = 0;
    Object.values(attDay).forEach(a => {
      if (a.status === 'present') present++;
      else if (a.status === 'absent') absent++;
      else if (a.status === 'late') late++;
    });
    setText('r-total', total); setText('r-present', present); setText('r-absent', absent); setText('r-late', late);
    const rate = total > 0 ? ((present + late) / total * 100).toFixed(1) : '0.0';
    setText('r-rate', 'Attendance Rate: ' + rate + '%');
    const tbody = document.getElementById('rep-daily-rows');
    if (tbody) {
      const students = Object.entries(allStudents).sort((a,b) => (a[1].rollNo||'').localeCompare(b[1].rollNo||'',undefined,{numeric:true}));
      tbody.innerHTML = students.map(([id, s]) => {
        const att = attDay[id];
        const status = att?.status || 'notmarked';
        const time = att?.time ? new Date(att.time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : '--';
        return '<div class="att-row"><span class="att-roll">' + (s.rollNo||'').toString().padStart(2,'0') + '</span><span class="att-name">' + esc(s.name) + '</span><span class="badge badge-' + status + '">' + (status === 'notmarked' ? '—' : status.toUpperCase()) + '</span><span class="att-time">' + time + '</span></div>';
      }).join('');
    }
    reportData = { type: 'daily', date: dateStr, present, absent, late, total, rate, attDay };
  } catch(e) { console.error(e); }
}

function buildWeekOptions() {
  const sel = document.getElementById('week-select');
  if (!sel) return;
  const now = new Date();
  sel.innerHTML = '';
  for (let w = 0; w < 5; w++) {
    const start = new Date(now.getFullYear(), now.getMonth(), 1 + w * 7);
    if (start.getMonth() !== now.getMonth()) break;
    const end = new Date(start); end.setDate(start.getDate() + 6);
    const maxDay = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
    const label = 'Week ' + (w+1) + ' (' + start.getDate() + '–' + Math.min(end.getDate(), maxDay) + ' ' + now.toLocaleString('default',{month:'short'}) + ')';
    const opt = document.createElement('option');
    opt.value = w; opt.textContent = label;
    sel.appendChild(opt);
  }
}

async function loadWeekly() {
  if (!currentUser) return;
  const sel = document.getElementById('week-select');
  const wk = sel ? parseInt(sel.value) || 0 : 0;
  const now = new Date();
  const weekStart = new Date(now.getFullYear(), now.getMonth(), 1 + wk * 7);
  const dayNames = ['Mon','Tue','Wed','Thu','Fri'];
  const vals = [], dates = [];
  for (let d = 0; d < 5; d++) {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + d);
    const ds = todayStr(day); dates.push(ds);
    try {
      const snap = await db.ref('users/' + currentUser.uid + '/attendance/' + ds).get();
      const att = snap.val() || {};
      const total = Object.keys(allStudents).length;
      const present = Object.values(att).filter(a => a.status === 'present' || a.status === 'late').length;
      vals.push(total > 0 ? Math.round((present/total)*100) : 0);
    } catch { vals.push(0); }
  }
  const ctx = document.getElementById('weekly-chart');
  if (!ctx) return;
  if (weeklyChart) { weeklyChart.destroy(); weeklyChart = null; }
  weeklyChart = new Chart(ctx, {
    type: 'bar',
    data: { labels: dayNames, datasets: [{ data: vals, backgroundColor: '#0A10B8', borderRadius: 6, maxBarThickness: 40 }] },
    options: {
      responsive: true,
      plugins: { legend:{display:false} },
      scales: {
        x: { grid:{display:false}, ticks:{font:{size:12},color:'#5A5F8A'} },
        y: { min:0, max:100, ticks:{callback:v=>v+'%',font:{size:10},color:'#A0A5C8'}, grid:{color:'#E8EAF6'} }
      },
      animation: { duration:800 }
    }
  });
  const best = Math.max(...vals), worst = Math.min(...vals), avg = Math.round(vals.reduce((a,b)=>a+b,0)/vals.length);
  const statsEl = document.getElementById('weekly-stats');
  if (statsEl) statsEl.innerHTML = '<div class="ws-card"><div class="ws-val green-text">' + best + '%</div><div class="ws-lbl">Best Day</div></div><div class="ws-card"><div class="ws-val red-text">' + worst + '%</div><div class="ws-lbl">Worst Day</div></div><div class="ws-card"><div class="ws-val navy-text">' + avg + '%</div><div class="ws-lbl">Average</div></div>';
  reportData = { type: 'weekly', vals, days: dayNames, dates, avg };
}

function buildMonthPills() {
  const cont = document.getElementById('month-pills');
  if (!cont) return;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const now = new Date();
  if (selectedMonth === null) selectedMonth = now.getMonth();
  cont.innerHTML = months.map((m, i) =>
    '<div class="month-pill' + (i === selectedMonth ? ' mp-active' : '') + '" onclick="selectMonth(' + i + ', this)">' + m + '</div>'
  ).join('');
}

function selectMonth(m, el) {
  document.querySelectorAll('.month-pill').forEach(p => p.classList.remove('mp-active'));
  el.classList.add('mp-active');
  selectedMonth = m;
  loadMonthly();
}

async function loadMonthly() {
  if (!currentUser) return;
  const now = new Date();
  const year = now.getFullYear();
  const month = selectedMonth !== null ? selectedMonth : now.getMonth();
  try {
    const snap = await db.ref('users/' + currentUser.uid + '/attendance').get();
    const attData = snap.val() || {};
    const cont = document.getElementById('monthly-heatmap');
    if (cont) renderMonthlyHeatmap(cont, year, month, attData);

    const monthPrefix = year + '-' + String(month+1).padStart(2,'0');
    const absenceCount = {};
    Object.entries(attData).forEach(([date, dayData]) => {
      if (!date.startsWith(monthPrefix)) return;
      Object.entries(dayData).forEach(([stuId, entry]) => {
        if (entry.status === 'absent') absenceCount[stuId] = (absenceCount[stuId]||0) + 1;
      });
    });
    const sorted = Object.entries(absenceCount).sort((a,b)=>b[1]-a[1]).slice(0,5);
    const attList = document.getElementById('attention-list');
    if (attList) {
      attList.innerHTML = sorted.length === 0
        ? '<div style="padding:16px;color:var(--tx2)">No absences this month</div>'
        : sorted.map(([id, cnt]) => {
          const s = allStudents[id];
          if (!s) return '';
          const color = avatarColor(s.name);
          const pct = cnt > 0 ? Math.round((cnt / getDaysInCurrentMonth()) * 100) : 0;
          return '<div class="attn-row"><div class="stu-avatar" style="background:' + color + ';width:40px;height:40px;font-size:16px">' + (s.name||'?')[0].toUpperCase() + '</div><div style="flex:1"><div class="stu-name">' + esc(s.name) + '</div><div class="stu-meta">' + cnt + ' absence' + (cnt>1?'s':'') + ' (' + pct + '%)</div></div><span class="badge ' + (pct>30?'badge-absent':'badge-late') + '">' + (pct>30?'HIGH':'MODERATE') + '</span></div>';
        }).join('');
      initIcons();
    }
    reportData = { type: 'monthly', year, month, absenceCount, attData };
  } catch(e) { console.error(e); }
}

function renderMonthlyHeatmap(cont, year, month, attData) {
  const days = ['M','T','W','T','F','S','S'];
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const offset = firstDay === 0 ? 6 : firstDay - 1;
  const total = Object.keys(allStudents).length;
  let html = days.map(d => '<div class="hm-day-header">' + d + '</div>').join('');
  for (let i = 0; i < offset; i++) html += '<div class="hm-cell hm-empty"></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = year + '-' + String(month+1).padStart(2,'0') + '-' + String(d).padStart(2,'0');
    const dayData = attData[ds] || {};
    const present = Object.values(dayData).filter(a => a.status === 'present' || a.status === 'late').length;
    const isFuture = new Date(ds) > new Date();
    let cls = 'hm-cell hm-empty';
    if (!isFuture && total > 0 && Object.keys(dayData).length > 0) {
      const pct = present / total;
      cls = 'hm-cell ' + (pct >= 0.85 ? 'hm-present' : pct >= 0.5 ? 'hm-late' : 'hm-absent');
    } else if (isFuture) cls = 'hm-cell hm-future';
    html += '<div class="' + cls + '">' + d + '</div>';
  }
  cont.innerHTML = html;
}

async function generateReport(type) {
  if (!currentUser) return;
  openModal('modal-rep-preview');
  const now = new Date();
  const school = teacherProfile?.schoolName || 'School';
  const cls = [teacherProfile?.class, teacherProfile?.section ? 'Sec ' + teacherProfile.section : ''].filter(Boolean).join(' · ');
  let title = '', bodyHtml = '';

  if (type === 'daily') {
    title = 'Daily Report — ' + formatDateShort(reportData.date || selectedRepDate);
    const students = Object.entries(allStudents).sort((a,b) => (a[1].rollNo||'').localeCompare(b[1].rollNo||'',undefined,{numeric:true}));
    bodyHtml = '<div class="rep-school-hdr">' + esc(school) + '</div><div class="rep-class-info">' + esc(cls) + ' · ' + formatDateShort(reportData.date || selectedRepDate) + '</div>' +
      '<table class="rep-summary-table"><tr><th>Total</th><th>Present</th><th>Absent</th><th>Rate</th></tr><tr><td>' + (reportData.total||0) + '</td><td>' + (reportData.present||0) + '</td><td>' + (reportData.absent||0) + '</td><td>' + (reportData.rate||0) + '%</td></tr></table>' +
      '<table class="rep-summary-table"><tr><th>Roll</th><th>Name</th><th>Status</th><th>Time</th></tr>' +
      students.map(([id, s]) => {
        const att = (reportData.attDay||{})[id];
        const status = att?.status || '—';
        const time = att?.time ? new Date(att.time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : '—';
        return '<tr><td>' + (s.rollNo||'').toString().padStart(2,'0') + '</td><td>' + esc(s.name) + '</td><td>' + status + '</td><td>' + time + '</td></tr>';
      }).join('') + '</table><div class="rep-footer">Generated by QRoll · ' + now.toLocaleDateString() + '</div>';
  } else if (type === 'weekly') {
    title = 'Weekly Report';
    bodyHtml = '<div class="rep-school-hdr">' + esc(school) + '</div><div class="rep-class-info">' + esc(cls) + '</div>' +
      '<table class="rep-summary-table"><tr>' + (reportData.days||[]).map(d=>'<th>' + d + '</th>').join('') + '</tr><tr>' + (reportData.vals||[]).map(v=>'<td>' + v + '%</td>').join('') + '</tr></table>' +
      '<p style="margin-top:12px;font-size:14px"><strong>Weekly Average: ' + (reportData.avg||'--') + '%</strong></p><div class="rep-footer">Generated by QRoll · ' + now.toLocaleDateString() + '</div>';
  } else {
    title = 'Monthly Report — ' + new Date(now.getFullYear(), selectedMonth, 1).toLocaleString('default',{month:'long',year:'numeric'});
    bodyHtml = '<div class="rep-school-hdr">' + esc(school) + '</div><div class="rep-class-info">' + esc(cls) + '</div>' +
      '<table class="rep-summary-table"><tr><th>Student</th><th>Absences</th></tr>' +
      Object.entries(reportData.absenceCount||{}).sort((a,b)=>b[1]-a[1]).map(([id,cnt]) => {
        const s = allStudents[id]; return s ? '<tr><td>' + esc(s.name) + '</td><td>' + cnt + '</td></tr>' : '';
      }).join('') + '</table><div class="rep-footer">Generated by QRoll · ' + now.toLocaleDateString() + '</div>';
  }

  setText('rep-prev-title', title);
  const card = document.getElementById('rep-preview-card');
  if (card) card.innerHTML = bodyHtml;
  reportData._title = title;
  reportData._body = bodyHtml;
}

function closeRepPreview() { closeModal('modal-rep-preview'); }

function downloadPDF() {
  const btn = document.getElementById('pdf-btn');
  if (btn) { btn.innerHTML = '<i data-lucide="loader-2"></i> Generating...'; initIcons(); }
  setTimeout(async () => {
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      doc.setFont('helvetica','bold');
      doc.setFontSize(16);
      doc.setTextColor(10,16,184);
      doc.text('QRoll — Attendance Report', 14, 20);
      doc.setFontSize(11);
      doc.setTextColor(90,95,138);
      doc.setFont('helvetica','normal');
      doc.text((teacherProfile?.schoolName||'School') + ' | ' + (teacherProfile?.class||''), 14, 30);
      doc.text(reportData._title || 'Report', 14, 38);
      const tables = document.getElementById('rep-preview-card')?.querySelectorAll('table');
      let y = 50;
      if (tables && doc.autoTable) {
        tables.forEach(table => {
          doc.autoTable({ html: table, startY: y, margin:{left:14,right:14}, styles:{fontSize:9}, headStyles:{fillColor:[10,16,184]}, alternateRowStyles:{fillColor:[244,246,255]} });
          y = (doc.lastAutoTable?.finalY || y) + 10;
        });
      }
      doc.setFontSize(8); doc.setTextColor(160);
      doc.text('Generated by QRoll — Smart School Attendance System', 14, doc.internal.pageSize.height - 10);
      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = (reportData._title||'QRoll_Report').replace(/[^a-z0-9]/gi,'_') + '.pdf'; a.click();
      if (btn) { btn.innerHTML = '<i data-lucide="check"></i> Downloaded!'; initIcons(); }
      setTimeout(() => { if (btn) { btn.innerHTML = '<i data-lucide="file-text"></i> Download as PDF'; initIcons(); } }, 3000);
      uploadToCloudinary(blob, 'QRoll_Report_' + Date.now() + '.pdf');
    } catch(e) {
      toast('PDF error: ' + e.message, 'error');
      if (btn) { btn.innerHTML = '<i data-lucide="file-text"></i> Download as PDF'; initIcons(); }
    }
  }, 100);
}

function downloadCSV() {
  const students = Object.entries(allStudents).sort((a,b) => (a[1].rollNo||'').localeCompare(b[1].rollNo||'',undefined,{numeric:true}));
  const rows = [['Roll No','Name','Father Name','Phone','Status','Time']];
  students.forEach(([id, s]) => {
    const att = (reportData.attDay||{})[id];
    rows.push([(s.rollNo||'').toString().padStart(2,'0'), s.name||'', s.fatherName||'', s.parentPhone||'', att?.status||'not marked', att?.time ? new Date(att.time).toLocaleTimeString() : '--']);
  });
  const csv = rows.map(r => r.map(c => '"' + String(c).replace(/"/g,'""') + '"').join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (reportData._title||'QRoll_Report').replace(/[^a-z0-9]/gi,'_') + '.csv';
  a.click();
  toast('CSV downloaded!');
}

function shareWhatsApp() {
  const text = 'Attendance Report from QRoll\n' + (reportData._title||'') + '\nSchool: ' + (teacherProfile?.schoolName||'') + '\nClass: ' + (teacherProfile?.class||'') + '\n\nGenerated by QRoll App';
  window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
}

/* ═══════════════════════════════════════════
   PROFILE
═══════════════════════════════════════════ */
function renderProfile() {
  if (!teacherProfile) return;
  const initial = (teacherProfile.name || 'T')[0].toUpperCase();
  const av = document.getElementById('prof-avatar');
  if (av) { av.textContent = initial; av.style.background = avatarColor(teacherProfile.name); }
  setText('prof-name', teacherProfile.name || 'Teacher');
  const roleStr = [teacherProfile.class, teacherProfile.section ? 'Sec ' + teacherProfile.section : ''].filter(Boolean).join(' · ');
  setText('prof-role', 'Class Teacher' + (roleStr ? ' — ' + roleStr : ''));
  setText('prof-school-name', teacherProfile.schoolName || 'School');
  const card = document.getElementById('prof-info-card');
  if (card) {
    const rows = [
      {icon:'building-2', label:'School Name', val: teacherProfile.schoolName},
      {icon:'user-round', label:'Principal', val: teacherProfile.principalName},
      {icon:'map-pin', label:'Address', val: teacherProfile.address},
      {icon:'layers', label:'Class', val: teacherProfile.class},
      {icon:'bookmark', label:'Section', val: teacherProfile.section || '—'},
      {icon:'mail', label:'Email', val: teacherProfile.email}
    ];
    card.innerHTML = rows.map(r =>
      '<div class="info-row"><i data-lucide="' + r.icon + '" class="ir-icon"></i><div style="flex:1"><div style="font-size:12px;color:var(--tx3);font-family:\'DM Sans\'">' + r.label + '</div><div class="ir-text" style="margin-top:2px">' + esc(r.val||'—') + '</div></div></div>'
    ).join('');
    initIcons();
  }
}

function openEditProfile() {
  if (!teacherProfile) return;
  setVal('ep-name', teacherProfile.name);
  setVal('ep-school', teacherProfile.schoolName);
  setVal('ep-addr', teacherProfile.address);
  setVal('ep-principal', teacherProfile.principalName);
  setVal('ep-section', teacherProfile.section);
  setVal('ep-class', teacherProfile.class);
  const lbl = document.getElementById('ep-class-label');
  if (lbl && teacherProfile.class) { lbl.textContent = teacherProfile.class; lbl.classList.add('has-val'); }
  openModal('modal-edit-profile');
}

function closeEditProfile() { closeModal('modal-edit-profile'); }

async function saveProfile() {
  const name = v('ep-name'), school = v('ep-school'), cls = v('ep-class');
  if (!name || !school) { toast('Name and school are required', 'error'); return; }
  try {
    const data = { name, schoolName: school, address: v('ep-addr'), principalName: v('ep-principal'), class: cls, section: v('ep-section'), updatedAt: Date.now() };
    await db.ref('users/' + currentUser.uid).update(data);
    teacherProfile = Object.assign({}, teacherProfile, data);
    closeEditProfile();
    renderProfile();
    refreshDashboard();
    toast('Profile updated!');
  } catch(e) { toast('Update failed: ' + e.message, 'error'); }
}

/* ═══════════════════════════════════════════
   CLOUDINARY UPLOAD
═══════════════════════════════════════════ */
async function uploadToCloudinary(blob, filename) {
  try {
    const fd = new FormData();
    fd.append('file', blob, filename);
    fd.append('upload_preset', CLOUD.preset);
    fd.append('folder', CLOUD.folder);
    const ext = (filename.split('.').pop() || '').toLowerCase();
    const isImage = ['jpg','jpeg','png','gif','webp'].includes(ext);
    const url = 'https://api.cloudinary.com/v1_1/' + CLOUD.name + (isImage ? '/image' : '/raw') + '/upload';
    const res = await fetch(url, { method: 'POST', body: fd });
    const data = await res.json();
    return data.secure_url || null;
  } catch(e) { return null; }
}

/* ═══════════════════════════════════════════
   UTILITY HELPERS
═══════════════════════════════════════════ */
function todayStr(date) {
  return date.getFullYear() + '-' + String(date.getMonth()+1).padStart(2,'0') + '-' + String(date.getDate()).padStart(2,'0');
}

function formatDate(date) {
  return date.toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
}

function formatDateShort(str) {
  if (!str) return '--';
  const d = new Date(str + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
}

function getDaysInCurrentMonth() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth()+1, 0).getDate();
}

function avatarColor(name) {
  if (!name) return AVATAR_COLORS[0];
  const ch = (name[0]||'A').toUpperCase().charCodeAt(0) - 65;
  const groups = [[0,1,2],[3,4,5],[6,7,8],[9,10,11],[12,13,14],[15,16,17],[18,19,20],[21,22,23,24,25]];
  for (let i = 0; i < groups.length; i++) if (groups[i].includes(ch)) return AVATAR_COLORS[i];
  return AVATAR_COLORS[Math.abs(ch) % AVATAR_COLORS.length];
}

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function v(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val || '';
}

/* ══════════════════════════════════════
   TOAST
══════════════════════════════════════ */
function toast(msg, type) {
  type = type || 'success';
  const cont = document.getElementById('toast-container');
  if (!cont) return;
  const icons = { success:'check-circle', error:'x-circle', warning:'alert-triangle' };
  const t = document.createElement('div');
  t.className = 'toast toast-' + type;
  t.innerHTML = '<i data-lucide="' + (icons[type]||'info') + '" style="width:18px;height:18px;flex-shrink:0"></i><span>' + esc(msg) + '</span>';
  cont.appendChild(t);
  try { lucide.createIcons({ nodes: [t] }); } catch(e){}
  const dismiss = () => { t.classList.add('toast-out'); setTimeout(() => t.remove(), 300); };
  t.addEventListener('click', dismiss);
  setTimeout(dismiss, 3500);
}

/* ══════════════════════════════════════
   END OF QRoll app.js
══════════════════════════════════════ */
