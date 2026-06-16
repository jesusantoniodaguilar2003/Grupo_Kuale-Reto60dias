/* =============================================
   Reto 60 Días · Buenos Hábitos
   app.js — v5.0 Firebase
   ============================================= */

/* ─── Firebase config ─── */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, onSnapshot }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA611-DTiBzEVCWrgx3viz97SPi5_MeQnM",
  authDomain: "reto60dias-kuale.firebaseapp.com",
  projectId: "reto60dias-kuale",
  storageBucket: "reto60dias-kuale.firebasestorage.app",
  messagingSenderId: "1035947441835",
  appId: "1:1035947441835:web:bff8066f84a9af1a4341ee"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

/* ─── Hábitos por defecto ─── */
const DEFAULT_HABITS = [
  { icon: "💧", name: "Tomar 2L de agua" },
  { icon: "🏃", name: "30 min de actividad física" },
  { icon: "🥗", name: "Alimentación Saludable" },
  { icon: "😴", name: "Dormir 7-8 horas" },
  { icon: "🚫", name: "Sin comida chatarra" },
  { icon: "🧘", name: "5 min de mindfulness" },
  { icon: "📵", name: "Sin pantallas 1h antes de dormir" },
  { icon: "📱", name: "Máx. 30 min en redes sociales" },
  { icon: "🚶", name: "Pausas Activas" },
  { icon: "🙏", name: "Reconocer 1 logro del día" },
];

const DAYS        = 60;
const WEEK_DAYS   = 7;
const TOTAL_WEEKS = Math.ceil(DAYS / WEEK_DAYS);
const ADMIN_USER  = "admin";
const ADMIN_PASS  = "admin";

/* ─── App state ─── */
let HABITS      = [];
let curUser     = null;
let isAdmin     = false;
let curTab      = "tracker";
let curWeek     = 0;
let uData       = { data: {}, joinDate: "", password: "" };
let adminChart1 = null;
let adminChart2 = null;
let _midnightTimer = null;
let _pendingDelete = null;

/* ══════════════════════════════════════
   FIREBASE HELPERS
══════════════════════════════════════ */

/* ── Hábitos ── */
async function loadHabits() {
  try {
    const snap = await getDoc(doc(db, "config", "habits"));
    if (snap.exists() && snap.data().list) {
      HABITS = snap.data().list;
    } else {
      HABITS = DEFAULT_HABITS.map(h => ({ ...h }));
      await saveHabits();
    }
  } catch {
    HABITS = DEFAULT_HABITS.map(h => ({ ...h }));
  }
}

async function saveHabits() {
  await setDoc(doc(db, "config", "habits"), { list: HABITS });
}

/* ── Usuarios ── */
async function getUser(uname) {
  const snap = await getDoc(doc(db, "users", uname));
  return snap.exists() ? snap.data() : null;
}

async function saveUser(uname, data) {
  await setDoc(doc(db, "users", uname), data, { merge: true });
}

async function deleteUserDoc(uname) {
  await deleteDoc(doc(db, "users", uname));
  // delete progress subcollection
  const progSnap = await getDocs(collection(db, "users", uname, "progress"));
  const dels = progSnap.docs.map(d => deleteDoc(d.ref));
  await Promise.all(dels);
}

async function getAllUserDocs() {
  const snap = await getDocs(collection(db, "users"));
  return snap.docs.map(d => ({ name: d.id, ...d.data() }));
}

/* ── Progreso ── */
async function loadProgress(uname) {
  const snap = await getDoc(doc(db, "users", uname, "progress", "data"));
  return snap.exists() ? (snap.data().grid || {}) : {};
}

async function saveProgress(uname, grid, lastSaved) {
  await setDoc(doc(db, "users", uname, "progress", "data"), { grid, lastSaved });
}

/* ══════════════════════════════════════
   LOADING SCREEN
══════════════════════════════════════ */
function showLoading(msg = "Cargando...") {
  document.getElementById("loading-screen").style.display = "flex";
  document.getElementById("loading-msg").textContent = msg;
}
function hideLoading() {
  document.getElementById("loading-screen").style.display = "none";
}

/* ══════════════════════════════════════
   AUTH
══════════════════════════════════════ */
async function doLogin() {
  const u   = document.getElementById("au").value.trim();
  const p   = document.getElementById("ap").value;
  const err = document.getElementById("auth-err");

  if (!u) { err.textContent = "Escribe tu nombre de usuario."; return; }
  if (!p) { err.textContent = "Escribe tu contraseña."; return; }

  showLoading("Verificando...");

  try {
    /* Admin */
    if (u === ADMIN_USER) {
      if (p === ADMIN_PASS) {
        curUser = u; isAdmin = true;
        err.textContent = "";
        await launchMain();
      } else {
        hideLoading();
        err.textContent = "Contraseña incorrecta.";
      }
      return;
    }

    /* Usuario normal */
    const userData = await getUser(u);

    if (userData) {
      if (userData.password === p) {
        curUser = u; isAdmin = false;
        uData.joinDate  = userData.joinDate || "";
        uData.password  = userData.password;
        uData.lastSaved = userData.lastSaved || null;
        uData.data      = await loadProgress(u);
        err.textContent = "";
        await launchMain();
      } else {
        hideLoading();
        err.textContent = "Contraseña incorrecta. ¿La olvidaste? Usa la opción de abajo.";
      }
    } else {
      /* primer acceso */
      if (p.length < 4) { hideLoading(); err.textContent = "Elige una contraseña de al menos 4 caracteres."; return; }
      const joinDate = new Date().toISOString().split("T")[0];
      await saveUser(u, { password: p, joinDate });
      curUser = u; isAdmin = false;
      uData = { data: {}, joinDate, password: p, lastSaved: null };
      err.textContent = "";
      await launchMain();
    }
  } catch(e) {
    hideLoading();
    err.textContent = "Error de conexión. Verifica tu internet.";
    console.error(e);
  }
}

function doLogout() {
  curUser = null; isAdmin = false; curTab = "tracker"; curWeek = 0;
  uData = { data: {}, joinDate: "", password: "" };
  if (_midnightTimer) clearTimeout(_midnightTimer);
  document.getElementById("auth-screen").style.display  = "flex";
  document.getElementById("main-screen").style.display  = "none";
  document.getElementById("au").value = "";
  document.getElementById("ap").value = "";
  document.getElementById("auth-err").textContent = "";
}

async function launchMain() {
  await loadHabits();
  hideLoading();
  document.getElementById("auth-screen").style.display = "none";
  document.getElementById("main-screen").style.display  = "block";
  const chip = document.getElementById("user-chip");
  chip.textContent = isAdmin ? "Administrador" : curUser;
  chip.className   = isAdmin ? "admin-chip" : "user-chip";
  buildTabs();
  renderTab(isAdmin ? "admin" : "tracker");
  if (!isAdmin) scheduleMidnightSave();
}

/* ─── Recover password ─── */
async function doRecover() {
  const u   = document.getElementById("rec-user").value.trim();
  const p1  = document.getElementById("rec-pass").value;
  const p2  = document.getElementById("rec-pass2").value;
  const err = document.getElementById("recover-err");

  if (!u)            { err.textContent = "Escribe tu nombre de usuario."; return; }
  if (p1.length < 4) { err.textContent = "Mínimo 4 caracteres."; return; }
  if (p1 !== p2)     { err.textContent = "Las contraseñas no coinciden."; return; }

  try {
    const userData = await getUser(u);
    if (!userData) { err.textContent = "No existe un usuario con ese nombre."; return; }
    await saveUser(u, { password: p1 });
    err.style.color = "var(--green)";
    err.textContent = "✓ Contraseña actualizada.";
    setTimeout(() => {
      document.getElementById("recover-modal").style.display = "none";
      err.textContent = ""; err.style.color = "";
    }, 2000);
  } catch {
    err.textContent = "Error de conexión.";
  }
}

/* ══════════════════════════════════════
   TABS
══════════════════════════════════════ */
function buildTabs() {
  const nav  = document.getElementById("tab-nav");
  const tabs = isAdmin
    ? [{ id: "admin", label: "Panel admin" }, { id: "habitos", label: "Gestionar hábitos" }]
    : [{ id: "tracker", label: "Mi reto" }];
  nav.innerHTML = tabs.map(t =>
    `<button class="tab-btn" data-tab="${t.id}">${t.label}</button>`
  ).join("");
  nav.querySelectorAll(".tab-btn").forEach(btn =>
    btn.addEventListener("click", () => renderTab(btn.dataset.tab))
  );
}

function setActiveTab(tab) {
  document.querySelectorAll(".tab-btn").forEach(b =>
    b.classList.toggle("active", b.dataset.tab === tab)
  );
}

function renderTab(tab) {
  curTab = tab;
  setActiveTab(tab);
  if      (tab === "tracker") renderTracker();
  else if (tab === "admin")   renderAdmin();
  else if (tab === "habitos") renderHabitos();
}

/* ══════════════════════════════════════
   TRACKER
══════════════════════════════════════ */
function gs(d, h) { return (uData.data || {})[`${d}_${h}`] || 0; }
function cs(d, h) {
  if (!uData.data) uData.data = {};
  uData.data[`${d}_${h}`] = (gs(d, h) + 1) % 3;
}

/* ── Auto-save ── */
async function autoSave() {
  const lastSaved = new Date().toISOString();
  uData.lastSaved = lastSaved;
  await saveProgress(curUser, uData.data, lastSaved);
  await saveUser(curUser, { lastSaved });
}

/* ── Midnight auto-save ── */
function scheduleMidnightSave() {
  if (_midnightTimer) clearTimeout(_midnightTimer);
  const now  = new Date();
  const next = new Date(now);
  next.setHours(23, 59, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  _midnightTimer = setTimeout(async () => {
    if (curUser && !isAdmin) {
      await autoSave();
      sendReminderNotification("¡Día guardado! 💪", "Tu progreso de hoy quedó registrado.");
    }
    scheduleMidnightSave();
  }, next - now);
}

/* ── Web Notifications ── */
function requestNotification() {
  if (!("Notification" in window)) { alert("Tu navegador no soporta notificaciones."); return; }
  if (Notification.permission === "granted") {
    scheduleReminderNotification(); updateNotifyBtn();
    showToast("✓ Recordatorio activado para las 8:00 PM");
  } else if (Notification.permission !== "denied") {
    Notification.requestPermission().then(perm => {
      if (perm === "granted") { scheduleReminderNotification(); updateNotifyBtn(); showToast("✓ Recordatorio activado"); }
    });
  } else {
    showToast("Notificaciones bloqueadas en la configuración del navegador.");
  }
}

function scheduleReminderNotification() {
  const now = new Date(), next = new Date(now);
  next.setHours(20, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  setTimeout(() => {
    sendReminderNotification("⏰ Reto 60 días · Kuale", "¡No olvides registrar tus hábitos de hoy!");
    scheduleReminderNotification();
  }, next - now);
}

function sendReminderNotification(title, body) {
  if (Notification.permission === "granted") new Notification(title, { body, icon: "logo-icon-new.png" });
}

function updateNotifyBtn() {
  const btn = document.getElementById("notify-btn");
  if (!btn) return;
  const granted = "Notification" in window && Notification.permission === "granted";
  btn.classList.toggle("notify-active", granted);
  btn.title = granted ? "Recordatorio activado" : "Activar recordatorio a las 8:00 PM";
}

/* ── Toast ── */
function showToast(msg) {
  let t = document.getElementById("app-toast");
  if (!t) { t = document.createElement("div"); t.id = "app-toast"; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 3000);
}

function getWeekDays() {
  const start = curWeek * WEEK_DAYS, days = [];
  for (let i = 0; i < WEEK_DAYS; i++) { const d = start + i; if (d < DAYS) days.push(d); }
  return days;
}

function calcStats() {
  const days = getWeekDays();
  let wDone = 0;
  days.forEach(d => HABITS.forEach((_, hi) => { if (gs(d, hi) === 1) wDone++; }));
  const wPct = Math.round(wDone / (days.length * HABITS.length) * 100);

  let perfect = 0, streak = 0, sActive = true, tDone = 0;
  for (let d = 0; d < DAYS; d++) {
    let allD = true, anyM = false;
    HABITS.forEach((_, hi) => {
      const s = gs(d, hi);
      if (s > 0) anyM = true;
      if (s !== 1) allD = false;
      if (s === 1) tDone++;
    });
    if (anyM && allD) perfect++;
    if (sActive) { if (anyM && allD) streak++; else if (anyM) { streak = 0; sActive = false; } }
  }
  const daysWithData = new Set(
    Object.keys(uData.data || {}).filter(k => (uData.data || {})[k] > 0).map(k => k.split("_")[0])
  ).size;
  const totalDenom = daysWithData * HABITS.length;
  const totalPct   = totalDenom > 0 ? Math.round(tDone / totalDenom * 100) : 0;
  return { wPct, perfect, streak, totalPct };
}

function renderTracker() {
  const days = getWeekDays();
  const st   = calcStats();
  const lastSaved = uData.lastSaved
    ? new Date(uData.lastSaved).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })
    : null;
  let html = "";

  html += `<div class="controls">
    <div class="week-nav">
      <button id="prev-week"><i class="ti ti-chevron-left"></i></button>
      <span class="week-label">Semana ${curWeek + 1}</span>
      <button id="next-week"><i class="ti ti-chevron-right"></i></button>
    </div>
    <div class="autosave-badge" id="autosave-badge">
      <i class="ti ti-check"></i>
      ${lastSaved ? `Guardado a las ${lastSaved}` : "Se guarda automáticamente"}
    </div>
    <button class="btn-summary" id="summary-btn"><i class="ti ti-chart-bar"></i> Ver mi resumen</button>
    <button class="btn-notify" id="notify-btn"><i class="ti ti-bell"></i></button>
  </div>`;

  html += `<div class="week-overview">`;
  for (let w = 0; w < TOTAL_WEEKS; w++) {
    const s = w * WEEK_DAYS; let marked = false;
    for (let d = s; d < Math.min(s + WEEK_DAYS, DAYS); d++)
      HABITS.forEach((_, hi) => { if (gs(d, hi) > 0) marked = true; });
    const cls = w === curWeek ? "active" : marked ? "has-data" : "";
    html += `<span class="week-pill ${cls}" data-w="${w}">Sem. ${w + 1}</span>`;
  }
  html += `</div>`;

  html += `<div class="stats-bar">
    <div class="stat-card"><div class="stat-num">${st.wPct}%</div><div class="stat-label">Esta semana</div></div>
    <div class="stat-card"><div class="stat-num">${st.perfect}</div><div class="stat-label">Días perfectos</div></div>
    <div class="stat-card"><div class="stat-num">${st.streak}d</div><div class="stat-label">Racha actual</div></div>
    <div class="stat-card"><div class="stat-num">${st.totalPct}%</div><div class="stat-label">Total general</div></div>
  </div>`;

  html += `<div class="table-wrap"><table>
    <thead><tr><th class="habit-col">Hábito</th>`;
  days.forEach(d => { html += `<th class="${d === 0 ? "today-col" : ""}">Día&nbsp;${d + 1}</th>`; });
  html += `<th>%</th></tr></thead><tbody>`;

  HABITS.forEach((h, hi) => {
    const daysRegistered = new Set(
      Object.keys(uData.data || {}).filter(k => (uData.data || {})[k] > 0).map(k => k.split("_")[0])
    );
    let done = 0;
    daysRegistered.forEach(dayStr => { if (gs(parseInt(dayStr), hi) === 1) done++; });
    const total = daysRegistered.size;
    const pct   = total > 0 ? Math.round(done / total * 100) : 0;
    const badge = h.isNew ? `<span class="new-badge">nuevo</span>` : "";
    html += `<tr><td class="habit-name"><span class="habit-icon">${h.icon}</span>${h.name}${badge}</td>`;
    days.forEach(d => {
      const s = gs(d, hi);
      html += `<td class="${d === 0 ? "today-col" : ""}">
        <button class="check-btn ${s === 1 ? "done" : s === 2 ? "fail" : ""}" data-d="${d}" data-h="${hi}">
          ${s === 1 ? "✓" : s === 2 ? "✗" : ""}
        </button></td>`;
    });
    html += `<td class="row-progress">
      <div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
      <div class="pct-label">${pct}%</div>
    </td></tr>`;
  });
  html += `</tbody></table></div>`;

  html += `<div class="legend-card">
    <div class="legend-title"><i class="ti ti-info-circle"></i> ¿Cómo registrar?</div>
    <div class="legend-steps">
      <div class="legend-step">
        <span class="check-btn done" style="pointer-events:none;width:28px;height:28px;font-size:14px">✓</span>
        <div><strong>1 clic</strong><br><span>Cumplido</span></div>
      </div>
      <div class="legend-step">
        <span class="check-btn fail" style="pointer-events:none;width:28px;height:28px;font-size:14px">✗</span>
        <div><strong>2 clics</strong><br><span>No cumplido</span></div>
      </div>
      <div class="legend-step">
        <span class="check-btn" style="pointer-events:none;width:28px;height:28px"></span>
        <div><strong>3 clics</strong><br><span>Borrar marca</span></div>
      </div>
    </div>
  </div>`;

  html += `<div class="mindfulness-section">
    <h2><i class="ti ti-brain"></i> Ejercicios de mindfulness (5 min)</h2>
    <p class="section-sub">Rota estos ejercicios cada día</p>
    <div class="cards-grid">`;
  [
    {icon:"🌬️",title:"Respiración 4-7-8",time:"5 min",desc:"Inhala 4 seg, retén 7, exhala 8. Repite 4 veces. Reduce el estrés de inmediato."},
    {icon:"🧍",title:"Escaneo corporal",time:"5 min",desc:"Recorre tu cuerpo mentalmente de pies a cabeza. ¿Dónde hay tensión? Suéltala al exhalar."},
    {icon:"👁️",title:"Los 5 sentidos",time:"3-5 min",desc:"5 cosas que ves, 4 que tocas, 3 que escuchas, 2 que hueles, 1 que saboreas."},
    {icon:"🙏",title:"Minuto de gratitud",time:"2-5 min",desc:"Una cosa que salió bien hoy. Visualízala y deja que genere sensación positiva."},
    {icon:"⬜",title:"Respiración cuadrada",time:"4-5 min",desc:"Inhala 4 → retén 4 → exhala 4 → retén 4. Repite 5 veces."},
  ].forEach(m => {
    html += `<div class="m-card"><div class="m-card-header"><div class="m-card-icon">${m.icon}</div>
      <div><div class="m-card-title">${m.title}</div><div class="m-card-time">${m.time}</div></div>
      </div><p>${m.desc}</p></div>`;
  });
  html += `</div></div>`;

  document.getElementById("page-content").innerHTML = html;

  document.getElementById("prev-week").addEventListener("click", () => { if (curWeek > 0) { curWeek--; renderTracker(); } });
  document.getElementById("next-week").addEventListener("click", () => { if (curWeek < TOTAL_WEEKS - 1) { curWeek++; renderTracker(); } });
  document.getElementById("summary-btn").addEventListener("click", openSummary);
  document.getElementById("notify-btn").addEventListener("click", requestNotification);
  updateNotifyBtn();

  document.querySelectorAll(".check-btn[data-d]").forEach(btn => {
    btn.addEventListener("click", async function () {
      cs(parseInt(this.dataset.d), parseInt(this.dataset.h));
      renderTracker();
      await autoSave();
    });
  });

  document.querySelectorAll(".week-pill").forEach(p => {
    p.addEventListener("click", function () { curWeek = parseInt(this.dataset.w); renderTracker(); });
  });
}

/* ─── Summary modal ─── */
function openSummary() {
  let tDone = 0, perfect = 0;
  for (let d = 0; d < DAYS; d++) {
    let allD = true, anyM = false;
    HABITS.forEach((_, hi) => {
      const s = gs(d, hi);
      if (s > 0) anyM = true; if (s !== 1) allD = false; if (s === 1) tDone++;
    });
    if (anyM && allD) perfect++;
  }
  const daysWithData = new Set(
    Object.keys(uData.data || {}).filter(k => (uData.data || {})[k] > 0).map(k => k.split("_")[0])
  ).size;
  const pct = daysWithData > 0 ? Math.round(tDone / (daysWithData * HABITS.length) * 100) : 0;

  let rows = "";
  HABITS.forEach((h, hi) => {
    let done = 0, daysCounted = new Set();
    for (let d = 0; d < DAYS; d++) {
      const s = gs(d, hi); if (s > 0) daysCounted.add(d); if (s === 1) done++;
    }
    const total = daysCounted.size;
    const p = total > 0 ? Math.round(done / total * 100) : 0;
    rows += `<li><span>${h.icon} ${h.name}</span>
      <span class="habit-pct${p < 50 && total > 0 ? " low" : ""}">${total > 0 ? p + "%" : "—"}</span></li>`;
  });

  document.getElementById("sum-content").innerHTML = `
    <div class="modal-stats">
      <div class="modal-stat"><div class="num">${pct}%</div><div class="lbl">Cumplimiento total</div></div>
      <div class="modal-stat"><div class="num">${perfect}</div><div class="lbl">Días perfectos</div></div>
      <div class="modal-stat"><div class="num">${daysWithData}</div><div class="lbl">Días registrados</div></div>
      <div class="modal-stat"><div class="num">${tDone}</div><div class="lbl">Hábitos cumplidos</div></div>
    </div>
    <ul class="modal-habit-list">${rows}</ul>`;
  document.getElementById("sum-modal").style.display = "flex";
}

/* ══════════════════════════════════════
   ADMIN DASHBOARD
══════════════════════════════════════ */
function getUserStats(ud) {
  const d = ud.data || {};
  let tDone = 0, perfect = 0, streak = 0, sActive = true;
  for (let day = 0; day < DAYS; day++) {
    let allD = true, anyM = false;
    HABITS.forEach((_, hi) => {
      const s = d[`${day}_${hi}`] || 0;
      if (s > 0) anyM = true; if (s !== 1) allD = false; if (s === 1) tDone++;
    });
    if (anyM && allD) perfect++;
    if (sActive) { if (anyM && allD) streak++; else if (anyM) { streak = 0; sActive = false; } }
  }
  const daysWithData = new Set(Object.keys(d).filter(k => d[k] > 0).map(k => k.split("_")[0])).size;
  const denom = daysWithData * HABITS.length;
  return { pct: denom > 0 ? Math.round(tDone / denom * 100) : 0, perfect, streak, daysWithData, joinDate: ud.joinDate || "—" };
}

async function renderAdmin() {
  const pc = document.getElementById("page-content");
  pc.innerHTML = `<div class="empty-admin"><i class="ti ti-loader" style="font-size:2rem;display:block;margin-bottom:.75rem;opacity:.4;animation:spin 1s linear infinite"></i>Cargando datos...</div>`;

  try {
    const allUsers = (await getAllUserDocs()).filter(u => u.name !== ADMIN_USER);

    // Load progress for each user
    const usersWithProgress = await Promise.all(allUsers.map(async u => {
      const grid = await loadProgress(u.name);
      return { ...u, data: grid };
    }));

    if (usersWithProgress.length === 0) {
      pc.innerHTML = `<div class="empty-admin">
        <i class="ti ti-users" style="font-size:3rem;display:block;margin-bottom:1rem;opacity:.3"></i>
        <p>Aún no hay usuarios registrados.</p>
      </div>`;
      return;
    }

    const stats      = usersWithProgress.map(u => ({ ...u, ...getUserStats(u) }));
    const avgPct     = Math.round(stats.reduce((a, s) => a + s.pct, 0) / stats.length);
    const avgDays    = Math.round(stats.reduce((a, s) => a + s.daysWithData, 0) / stats.length);
    const totalPerfect = stats.reduce((a, s) => a + s.perfect, 0);
    const top        = [...stats].sort((a, b) => b.pct - a.pct).slice(0, 5);
    const medals     = ["🥇","🥈","🥉","4°","5°"];
    const mColors    = ["#FFD700","#C0C0C0","#CD7F32","var(--gray-400)","var(--gray-400)"];

    let html = `<div class="admin-summary-grid">
      <div class="admin-card"><div class="num">${stats.length}</div><div class="lbl">Participantes</div></div>
      <div class="admin-card"><div class="num">${avgPct}%</div><div class="lbl">Cumplimiento promedio</div></div>
      <div class="admin-card"><div class="num">${avgDays}</div><div class="lbl">Días prom. registrados</div></div>
      <div class="admin-card"><div class="num">${totalPerfect}</div><div class="lbl">Días perfectos (total)</div></div>
    </div>`;

    /* Top */
    html += `<div class="top-section">
      <div class="chart-title" style="margin-bottom:12px">
        <i class="ti ti-trophy" style="color:var(--green);margin-right:6px"></i>Top participantes
      </div><div class="top-list">`;
    top.forEach((s, i) => {
      const statusCls = s.pct >= 70 ? "badge-green" : s.pct >= 40 ? "badge-gray" : "badge-red";
      html += `<div class="top-row ${i === 0 ? "top-first" : ""}">
        <span class="top-medal" style="color:${mColors[i]}">${medals[i]}</span>
        <div class="top-avatar">${s.name.charAt(0).toUpperCase()}</div>
        <div class="top-info">
          <button class="user-link top-name" data-uname="${s.name}">${s.name}</button>
          <div class="top-meta">${s.daysWithData} días · ${s.perfect} perfectos · racha ${s.streak}d</div>
        </div>
        <div class="top-right">
          <div class="top-pct">${s.pct}%</div>
          <span class="badge ${statusCls}" style="font-size:10px">${s.pct >= 70 ? "En buen camino" : s.pct >= 40 ? "En progreso" : "Necesita apoyo"}</span>
        </div>
      </div>`;
    });
    html += `</div></div>`;

    /* Charts */
    const chartH = Math.max(180, stats.length * 44 + 60);
    html += `<div class="charts-row">
      <div class="chart-card"><div class="chart-title">Cumplimiento por usuario</div>
        <div style="position:relative;height:${chartH}px"><canvas id="chart-users"></canvas></div></div>
      <div class="chart-card"><div class="chart-title">Días registrados por usuario</div>
        <div style="position:relative;height:${chartH}px"><canvas id="chart-days"></canvas></div></div>
    </div>`;

    /* Table */
    html += `<div class="admin-table-section">
      <div class="chart-title">Detalle por usuario <span style="font-size:11px;font-weight:400;color:var(--gray-400)">— clic en nombre para ver progreso</span></div>
      <div class="table-wrap"><table class="users-table">
        <thead><tr>
          <th>Usuario</th><th>Se unió</th><th>Días registrados</th>
          <th>Cumplimiento</th><th>Racha</th><th>Días perfectos</th><th>Estado</th><th>Acciones</th>
        </tr></thead><tbody>`;

    stats.sort((a, b) => b.pct - a.pct).forEach(s => {
      const statusCls = s.pct >= 70 ? "badge-green" : s.pct >= 40 ? "badge-gray" : "badge-red";
      const statusTxt = s.pct >= 70 ? "En buen camino" : s.pct >= 40 ? "En progreso" : "Necesita apoyo";
      html += `<tr>
        <td><button class="user-link" data-uname="${s.name}">${s.name}</button></td>
        <td>${s.joinDate}</td><td>${s.daysWithData} / 60</td>
        <td><div class="inline-bar"><div class="inline-bar-fill" style="width:${s.pct}%"></div></div>${s.pct}%</td>
        <td>${s.streak}d</td><td>${s.perfect}</td>
        <td><span class="badge ${statusCls}">${statusTxt}</span></td>
        <td class="td-actions">
          <button class="btn-action btn-edit" data-uname="${s.name}"><i class="ti ti-lock"></i> Contraseña</button>
          <button class="btn-action btn-delete" data-uname="${s.name}"><i class="ti ti-trash"></i></button>
        </td></tr>`;
    });
    html += `</tbody></table></div></div>`;

    /* Edit pass modal */
    html += `<div id="edit-pass-modal" class="modal-bg" style="display:none">
      <div class="modal-box" style="max-width:380px">
        <div class="modal-hdr"><h2>Cambiar contraseña</h2><button id="close-edit-pass"><i class="ti ti-x"></i></button></div>
        <p style="font-size:13px;color:var(--gray-600);margin-bottom:1rem">Usuario: <strong id="edit-pass-uname"></strong></p>
        <label>Nueva contraseña</label>
        <input id="ep-pass" type="password" placeholder="Mínimo 4 caracteres">
        <label style="margin-top:12px">Confirmar contraseña</label>
        <input id="ep-pass2" type="password" placeholder="Repite la contraseña">
        <button class="btn-green" id="do-edit-pass" style="margin-top:1.25rem">Guardar contraseña</button>
        <div class="auth-err" id="edit-pass-err" style="min-height:18px;margin-top:8px"></div>
      </div></div>`;

    pc.innerHTML = html;

    /* Store stats for detail modal */
    pc._statsData = stats;

    pc.querySelectorAll(".user-link").forEach(btn => {
      btn.addEventListener("click", () => {
        const s = stats.find(x => x.name === btn.dataset.uname);
        if (s) openUserDetail(s);
      });
    });
    pc.querySelectorAll(".btn-edit").forEach(btn => btn.addEventListener("click", () => openEditPass(btn.dataset.uname)));
    pc.querySelectorAll(".btn-delete").forEach(btn => btn.addEventListener("click", () => deleteUser(btn.dataset.uname)));

    document.getElementById("close-edit-pass").addEventListener("click", () => {
      document.getElementById("edit-pass-modal").style.display = "none";
    });
    document.getElementById("edit-pass-modal").addEventListener("click", function(e) {
      if (e.target === this) this.style.display = "none";
    });
    document.getElementById("do-edit-pass").addEventListener("click", doEditPass);

    /* Charts */
    if (adminChart1) { adminChart1.destroy(); adminChart1 = null; }
    if (adminChart2) { adminChart2.destroy(); adminChart2 = null; }
    const sorted  = [...stats].sort((a, b) => b.pct - a.pct);
    const names   = sorted.map(s => s.name);
    const pcts    = sorted.map(s => s.pct);
    const daysArr = sorted.map(s => s.daysWithData);
    const colors  = pcts.map(p => p >= 70 ? "#ed1c24" : p >= 40 ? "#888780" : "#D85A30");

    adminChart1 = new Chart(document.getElementById("chart-users"), {
      type: "bar",
      data: { labels: names, datasets: [{ label: "%", data: pcts, backgroundColor: colors, borderRadius: 4 }] },
      options: { indexAxis: "y", responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { max: 100, ticks: { callback: v => v + "%" } }, y: { ticks: { font: { size: 11 } } } } }
    });
    adminChart2 = new Chart(document.getElementById("chart-days"), {
      type: "bar",
      data: { labels: names, datasets: [{ label: "Días", data: daysArr, backgroundColor: "#f5a0a3", borderRadius: 4 }] },
      options: { indexAxis: "y", responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { max: 60 }, y: { ticks: { font: { size: 11 } } } } }
    });

  } catch(e) {
    pc.innerHTML = `<div class="empty-admin"><p style="color:var(--red)">Error al cargar datos: ${e.message}</p></div>`;
    console.error(e);
  }
}

/* ── User detail modal ── */
function openUserDetail(s) {
  document.getElementById("ud-title").textContent = s.name;
  const statusCls = s.pct >= 70 ? "badge-green" : s.pct >= 40 ? "badge-gray" : "badge-red";
  const statusTxt = s.pct >= 70 ? "En buen camino" : s.pct >= 40 ? "En progreso" : "Necesita apoyo";
  const d = s.data || {};

  let weeksHtml = "";
  for (let w = 0; w < TOTAL_WEEKS; w++) {
    const startDay = w * WEEK_DAYS, days = [];
    for (let i = 0; i < WEEK_DAYS; i++) { const day = startDay + i; if (day < DAYS) days.push(day); }
    let wDone = 0, wPerfect = 0;
    const wDays = new Set();
    days.forEach(day => {
      let allD = true, anyM = false;
      HABITS.forEach((_, hi) => {
        const sv = d[`${day}_${hi}`] || 0;
        if (sv > 0) { anyM = true; wDays.add(day); }
        if (sv !== 1) allD = false;
        if (sv === 1) wDone++;
      });
      if (anyM && allD) wPerfect++;
    });
    const wDenom = wDays.size * HABITS.length;
    const wPct   = wDenom > 0 ? Math.round(wDone / wDenom * 100) : 0;
    const hasData = wDays.size > 0;

    let thead = `<tr><th class="wt-habit">Hábito</th>`;
    days.forEach(day => { thead += `<th class="wt-day">Día ${day + 1}</th>`; });
    thead += `<th class="wt-pct">%</th></tr>`;

    let tbody = "";
    HABITS.forEach((h, hi) => {
      let hDone = 0;
      days.forEach(day => { if ((d[`${day}_${hi}`] || 0) === 1) hDone++; });
      const hPct = wDays.size > 0 ? Math.round(hDone / wDays.size * 100) : null;
      tbody += `<tr><td class="wt-habit-name"><span class="habit-icon">${h.icon}</span>${h.name}</td>`;
      days.forEach(day => {
        const sv = d[`${day}_${hi}`] || 0;
        const cls = sv === 1 ? "wc-done" : sv === 2 ? "wc-fail" : "wc-empty";
        tbody += `<td class="wt-cell"><span class="${cls}">${sv === 1 ? "✓" : sv === 2 ? "✗" : ""}</span></td>`;
      });
      const pCls = hPct !== null && hPct < 50 ? "low" : "";
      tbody += `<td class="wt-pct-val ${pCls}">${hPct !== null ? hPct + "%" : "—"}</td></tr>`;
    });

    const pctColor = wPct >= 70 ? "var(--green)" : wPct >= 40 ? "var(--gray-600)" : "var(--red)";
    weeksHtml += `<div class="week-accordion ${w === 0 ? "open" : ""}">
      <button class="week-acc-header">
        <span class="wah-label"><i class="ti ti-chevron-right wah-icon"></i>Semana ${w + 1}
          <span style="font-size:11px;font-weight:400;color:var(--gray-400);margin-left:6px">Días ${startDay + 1}–${Math.min(startDay + WEEK_DAYS, DAYS)}</span>
        </span>
        <span class="wah-stats">${hasData
          ? `<span style="color:${pctColor};font-weight:600">${wPct}%</span>
             <span style="color:var(--gray-400);font-size:11px;margin-left:8px">${wDone} cumplidos · ${wPerfect} día${wPerfect !== 1 ? "s" : ""} perfecto${wPerfect !== 1 ? "s" : ""}</span>`
          : `<span style="color:var(--gray-400);font-size:11px">Sin datos</span>`}</span>
      </button>
      <div class="week-acc-body">
        <div class="wt-wrap"><table class="week-table"><thead>${thead}</thead><tbody>${tbody}</tbody></table></div>
      </div></div>`;
  }

  document.getElementById("ud-content").innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:1.25rem;flex-wrap:wrap">
      <div style="width:44px;height:44px;border-radius:50%;background:var(--green-light);display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:600;color:var(--green-dark)">
        ${s.name.charAt(0).toUpperCase()}</div>
      <div><div style="font-weight:600;font-size:15px">${s.name}</div>
        <div style="font-size:12px;color:var(--gray-400)">Se unió el ${s.joinDate}</div></div>
      <span class="badge ${statusCls}" style="margin-left:auto">${statusTxt}</span>
    </div>
    <div class="modal-stats" style="margin-bottom:1.5rem">
      <div class="modal-stat"><div class="num">${s.pct}%</div><div class="lbl">Cumplimiento total</div></div>
      <div class="modal-stat"><div class="num">${s.perfect}</div><div class="lbl">Días perfectos</div></div>
      <div class="modal-stat"><div class="num">${s.daysWithData}/60</div><div class="lbl">Días registrados</div></div>
      <div class="modal-stat"><div class="num">${s.streak}d</div><div class="lbl">Racha actual</div></div>
    </div>
    <div style="font-size:13px;font-weight:600;margin-bottom:4px">Progreso por semana</div>
    <div class="ud-legend" style="margin-bottom:12px">
      <span class="wc-done ud-leg-dot"></span>Cumplido
      <span class="wc-fail ud-leg-dot" style="margin-left:10px"></span>No cumplido
      <span class="wc-empty ud-leg-dot" style="margin-left:10px"></span>Sin marcar
    </div>
    <div class="weeks-accordion">${weeksHtml}</div>`;

  document.querySelectorAll(".week-acc-header").forEach(btn => {
    btn.addEventListener("click", () => btn.closest(".week-accordion").classList.toggle("open"));
  });
  document.getElementById("user-detail-modal").style.display = "flex";
}

/* ── Delete user ── */
let _pendingDeleteName = null;
function deleteUser(uname) {
  _pendingDeleteName = uname;
  document.getElementById("confirm-uname").textContent = uname;
  document.getElementById("confirm-modal").style.display = "flex";
}

/* ── Edit password ── */
function openEditPass(uname) {
  document.getElementById("edit-pass-uname").textContent = uname;
  document.getElementById("ep-pass").value  = "";
  document.getElementById("ep-pass2").value = "";
  document.getElementById("edit-pass-err").textContent = "";
  document.getElementById("edit-pass-modal").dataset.uname = uname;
  document.getElementById("edit-pass-modal").style.display = "flex";
}

async function doEditPass() {
  const uname = document.getElementById("edit-pass-modal").dataset.uname;
  const p1    = document.getElementById("ep-pass").value;
  const p2    = document.getElementById("ep-pass2").value;
  const err   = document.getElementById("edit-pass-err");
  if (p1.length < 4) { err.textContent = "Mínimo 4 caracteres."; return; }
  if (p1 !== p2)     { err.textContent = "Las contraseñas no coinciden."; return; }
  try {
    await saveUser(uname, { password: p1 });
    err.style.color = "var(--green)";
    err.textContent = "✓ Contraseña actualizada.";
    setTimeout(() => { document.getElementById("edit-pass-modal").style.display = "none"; }, 1200);
  } catch { err.textContent = "Error al guardar."; }
}

/* ══════════════════════════════════════
   GESTIONAR HÁBITOS (admin)
══════════════════════════════════════ */
function renderHabitos() {
  const pc = document.getElementById("page-content");

  const rows = HABITS.map((h, i) => `
    <tr>
      <td class="hab-td-icon">${h.icon}</td>
      <td class="hab-td-name">${h.name}</td>
      <td class="hab-td-actions">
        <button class="btn-action btn-hab-up" data-i="${i}" ${i === 0 ? "disabled" : ""}><i class="ti ti-chevron-up"></i></button>
        <button class="btn-action btn-hab-down" data-i="${i}" ${i === HABITS.length - 1 ? "disabled" : ""}><i class="ti ti-chevron-down"></i></button>
        <button class="btn-action btn-hab-edit" data-i="${i}" title="Editar"><i class="ti ti-pencil"></i></button>
        <button class="btn-action btn-delete" data-i="${i}"><i class="ti ti-trash"></i></button>
      </td>
    </tr>`).join("");

  pc.innerHTML = `
    <div class="hab-manager">
      <div class="hab-header">
        <div>
          <div class="chart-title" style="margin-bottom:4px">
            <i class="ti ti-list-check" style="color:var(--green);margin-right:6px"></i>Hábitos del reto
          </div>
          <p style="font-size:12px;color:var(--gray-400)">Los cambios se sincronizan para todos los usuarios en tiempo real.</p>
        </div>
        <button class="btn-summary" id="btn-add-habit" style="height:38px"><i class="ti ti-plus"></i> Agregar hábito</button>
      </div>
      <div class="table-wrap" style="margin-top:1rem">
        <table class="hab-table">
          <thead><tr>
            <th style="width:60px;text-align:center">Ícono</th>
            <th style="text-align:left;padding-left:14px">Nombre del hábito</th>
            <th style="width:130px;text-align:center">Acciones</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="hab-footer">
        <span style="font-size:12px;color:var(--gray-400)">${HABITS.length} hábito${HABITS.length !== 1 ? "s" : ""}</span>
        <button class="btn-action" id="btn-reset-habits" style="color:var(--gray-400)">
          <i class="ti ti-refresh"></i> Restaurar predeterminados
        </button>
      </div>
    </div>

    <div id="add-habit-modal" class="modal-bg" style="display:none">
      <div class="modal-box" style="max-width:400px">
        <div class="modal-hdr"><h2>Agregar hábito</h2><button id="close-add-habit"><i class="ti ti-x"></i></button></div>
        <label>Ícono (emoji)</label>
        <div class="emoji-picker-wrap">
          <input id="hab-icon" type="text" placeholder="Pega un emoji: 🏋️" maxlength="4" style="width:80px;text-align:center;font-size:22px">
          <div class="emoji-suggestions">
            ${["🏋️","🚴","🥦","🍎","💤","🧴","📖","🎯","🏊","🤸","🧃","🦷","🌿","🎵","🧠","💪","🛌","🚿","✍️","🍵"]
              .map(e => `<button class="emoji-opt" data-e="${e}">${e}</button>`).join("")}
          </div>
        </div>
        <label style="margin-top:14px">Nombre del hábito</label>
        <input id="hab-name" type="text" placeholder="Ej: Leer 20 minutos" maxlength="60">
        <button class="btn-green" id="do-add-habit" style="margin-top:1.25rem"><i class="ti ti-plus"></i> Agregar</button>
        <div class="auth-err" id="add-habit-err" style="min-height:18px;margin-top:8px"></div>
      </div>
    </div>

    <!-- Edit habit modal -->
    <div id="edit-habit-modal" class="modal-bg" style="display:none">
      <div class="modal-box" style="max-width:400px">
        <div class="modal-hdr"><h2>Editar hábito</h2><button id="close-edit-habit"><i class="ti ti-x"></i></button></div>
        <label>Ícono (emoji)</label>
        <div class="emoji-picker-wrap">
          <input id="edit-hab-icon" type="text" maxlength="4" style="width:80px;text-align:center;font-size:22px">
          <div class="emoji-suggestions">
            ${["🏋️","🚴","🥦","🍎","💤","🧴","📖","🎯","🏊","🤸","🧃","🦷","🌿","🎵","🧠","💪","🛌","🚿","✍️","🍵"]
              .map(e => `<button class="emoji-opt-edit" data-e="${e}">${e}</button>`).join("")}
          </div>
        </div>
        <label style="margin-top:14px">Nombre del hábito</label>
        <input id="edit-hab-name" type="text" maxlength="60">
        <button class="btn-green" id="do-edit-habit" style="margin-top:1.25rem"><i class="ti ti-check"></i> Guardar cambios</button>
        <div class="auth-err" id="edit-habit-err" style="min-height:18px;margin-top:8px"></div>
      </div>
    </div>`;

  document.getElementById("btn-add-habit").addEventListener("click", () => {
    document.getElementById("hab-icon").value = "";
    document.getElementById("hab-name").value = "";
    document.getElementById("add-habit-err").textContent = "";
    document.getElementById("add-habit-modal").style.display = "flex";
  });
  document.getElementById("close-add-habit").addEventListener("click", () => {
    document.getElementById("add-habit-modal").style.display = "none";
  });
  document.getElementById("add-habit-modal").addEventListener("click", function(e) {
    if (e.target === this) this.style.display = "none";
  });
  pc.querySelectorAll(".emoji-opt").forEach(btn => {
    btn.addEventListener("click", () => { document.getElementById("hab-icon").value = btn.dataset.e; });
  });
  document.getElementById("do-add-habit").addEventListener("click", async () => {
    const icon = document.getElementById("hab-icon").value.trim();
    const name = document.getElementById("hab-name").value.trim();
    const err  = document.getElementById("add-habit-err");
    if (!icon) { err.textContent = "Elige o pega un emoji."; return; }
    if (!name || name.length < 3) { err.textContent = "Escribe un nombre válido."; return; }
    HABITS.push({ icon, name });
    await saveHabits();
    document.getElementById("add-habit-modal").style.display = "none";
    showToast(`✓ Hábito "${name}" agregado`);
    renderHabitos();
  });
  /* edit habit modal */
  document.getElementById("close-edit-habit").addEventListener("click", () => {
    document.getElementById("edit-habit-modal").style.display = "none";
  });
  document.getElementById("edit-habit-modal").addEventListener("click", function(e) {
    if (e.target === this) this.style.display = "none";
  });
  pc.querySelectorAll(".emoji-opt-edit").forEach(btn => {
    btn.addEventListener("click", () => { document.getElementById("edit-hab-icon").value = btn.dataset.e; });
  });
  pc.querySelectorAll(".btn-hab-edit").forEach(btn => {
    btn.addEventListener("click", () => {
      const i = parseInt(btn.dataset.i);
      document.getElementById("edit-hab-icon").value = HABITS[i].icon;
      document.getElementById("edit-hab-name").value = HABITS[i].name;
      document.getElementById("edit-habit-err").textContent = "";
      document.getElementById("edit-habit-modal").dataset.i = i;
      document.getElementById("edit-habit-modal").style.display = "flex";
    });
  });
  document.getElementById("do-edit-habit").addEventListener("click", async () => {
    const i    = parseInt(document.getElementById("edit-habit-modal").dataset.i);
    const icon = document.getElementById("edit-hab-icon").value.trim();
    const name = document.getElementById("edit-hab-name").value.trim();
    const err  = document.getElementById("edit-habit-err");
    if (!icon) { err.textContent = "Elige o pega un emoji."; return; }
    if (!name || name.length < 3) { err.textContent = "Escribe un nombre válido."; return; }
    HABITS[i] = { icon, name };
    await saveHabits();
    document.getElementById("edit-habit-modal").style.display = "none";
    showToast(`✓ Hábito actualizado`);
    renderHabitos();
  });

  pc.querySelectorAll(".btn-hab-up").forEach(btn => {
    btn.addEventListener("click", async () => {
      const i = parseInt(btn.dataset.i);
      if (i === 0) return;
      [HABITS[i - 1], HABITS[i]] = [HABITS[i], HABITS[i - 1]];
      await saveHabits(); renderHabitos();
    });
  });
  pc.querySelectorAll(".btn-hab-down").forEach(btn => {
    btn.addEventListener("click", async () => {
      const i = parseInt(btn.dataset.i);
      if (i === HABITS.length - 1) return;
      [HABITS[i], HABITS[i + 1]] = [HABITS[i + 1], HABITS[i]];
      await saveHabits(); renderHabitos();
    });
  });
  pc.querySelectorAll(".btn-delete").forEach(btn => {
    btn.addEventListener("click", async () => {
      const i = parseInt(btn.dataset.i);
      if (HABITS.length <= 1) { showToast("Debe haber al menos 1 hábito."); return; }
      const name = HABITS[i].name;
      HABITS.splice(i, 1);
      await saveHabits();
      showToast(`Hábito "${name}" eliminado`);
      renderHabitos();
    });
  });
  document.getElementById("btn-reset-habits").addEventListener("click", async () => {
    if (!confirm("¿Restaurar los hábitos predeterminados?")) return;
    HABITS = DEFAULT_HABITS.map(h => ({ ...h }));
    await saveHabits();
    showToast("✓ Hábitos restaurados");
    renderHabitos();
  });
}

/* ══════════════════════════════════════
   INIT
══════════════════════════════════════ */
document.getElementById("login-btn").addEventListener("click", doLogin);
document.getElementById("au").addEventListener("keydown", e => { if (e.key === "Enter") document.getElementById("ap").focus(); });
document.getElementById("ap").addEventListener("keydown", e => { if (e.key === "Enter") doLogin(); });
document.getElementById("logout-btn").addEventListener("click", doLogout);

document.getElementById("close-modal").addEventListener("click", () => { document.getElementById("sum-modal").style.display = "none"; });
document.getElementById("sum-modal").addEventListener("click", function(e) { if (e.target === this) this.style.display = "none"; });

document.getElementById("recover-btn").addEventListener("click", () => { document.getElementById("recover-modal").style.display = "flex"; });
document.getElementById("close-recover").addEventListener("click", () => {
  document.getElementById("recover-modal").style.display = "none";
  document.getElementById("recover-err").textContent = "";
  document.getElementById("recover-err").style.color = "";
});
document.getElementById("recover-modal").addEventListener("click", function(e) {
  if (e.target === this) { this.style.display = "none"; document.getElementById("recover-err").textContent = ""; }
});
document.getElementById("do-recover").addEventListener("click", doRecover);

document.getElementById("close-ud").addEventListener("click", () => { document.getElementById("user-detail-modal").style.display = "none"; });
document.getElementById("user-detail-modal").addEventListener("click", function(e) { if (e.target === this) this.style.display = "none"; });

document.getElementById("confirm-cancel").addEventListener("click", () => {
  document.getElementById("confirm-modal").style.display = "none"; _pendingDeleteName = null;
});
document.getElementById("confirm-modal").addEventListener("click", function(e) {
  if (e.target === this) { this.style.display = "none"; _pendingDeleteName = null; }
});
document.getElementById("confirm-ok").addEventListener("click", async () => {
  if (!_pendingDeleteName) return;
  showLoading("Eliminando usuario...");
  try {
    await deleteUserDoc(_pendingDeleteName);
    _pendingDeleteName = null;
    document.getElementById("confirm-modal").style.display = "none";
    hideLoading();
    renderAdmin();
  } catch { hideLoading(); showToast("Error al eliminar usuario."); }
});