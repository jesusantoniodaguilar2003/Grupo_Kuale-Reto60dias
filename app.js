/* =============================================
   Reto 60 Días · Buenos Hábitos
   app.js — v3.0
   ============================================= */

const HABITS = [
  { icon: "💧", name: "Tomar 2L de agua" },
  { icon: "🏃", name: "30 min de actividad física" },
  { icon: "🥗", name: "Comer frutas y verduras" },
  { icon: "😴", name: "Dormir 7-8 horas" },
  { icon: "🚫", name: "Sin comida chatarra" },
  { icon: "🧘", name: "5 min de mindfulness" },
  { icon: "📵", name: "Sin pantallas 1h antes de dormir" },
  { icon: "📱", name: "Máx. 30 min en redes sociales", isNew: true },
  { icon: "🚶", name: "Moverse entre reuniones" },
  { icon: "🙏", name: "Reconocer 1 logro del día" },
];

const MINDFULNESS = [
  {
    icon: "🌬️", title: "Respiración 4-7-8", time: "5 minutos",
    desc: "Inhala 4 segundos, retén 7, exhala lentamente en 8. Repite 4 veces. Activa el sistema nervioso parasimpático y reduce el estrés de forma inmediata. Ideal al inicio de la jornada o antes de una reunión importante.",
  },
  {
    icon: "🧍", title: "Escaneo corporal", time: "5 minutos",
    desc: "Cierra los ojos y recorre mentalmente tu cuerpo de pies a cabeza: ¿dónde hay tensión? Sin juzgar, solo observa. Termina soltando esa tensión al exhalar. Funciona muy bien después de horas frente a la pantalla.",
  },
  {
    icon: "👁️", title: "Los 5 sentidos", time: "3-5 minutos",
    desc: "Nombra: 5 cosas que ves, 4 que puedes tocar, 3 que escuchas, 2 que hueles, 1 que podrías saborear. Ancla la mente al momento presente. Es discreto y se puede hacer en el escritorio.",
  },
  {
    icon: "🙏", title: "Minuto de gratitud", time: "2-5 minutos",
    desc: "Cierra los ojos y piensa en una cosa que salió bien hoy, por pequeña que sea. Visualízala y deja que produzca una sensación positiva. Entrena al cerebro a notar lo positivo.",
  },
  {
    icon: "⬜", title: "Respiración cuadrada", time: "4-5 minutos",
    desc: "Inhala 4 seg → retén 4 → exhala 4 → retén 4. Repite 5 veces. Técnica usada por equipos de alto rendimiento para mantener la calma bajo presión. Perfecta tras la comida.",
  },
];

const DAYS        = 60;
const WEEK_DAYS   = 7;
const TOTAL_WEEKS = Math.ceil(DAYS / WEEK_DAYS);
const ADMIN_USER  = "admin";
const ADMIN_PASS  = "admin";

/* ─── App state ─── */
let curUser     = null;
let isAdmin     = false;
let curTab      = "tracker";
let curWeek     = 0;
let uData       = {};
let adminChart1 = null;
let adminChart2 = null;

/* ══════════════════════════════════════
   STORAGE
══════════════════════════════════════ */
function getUsers() {
  try { return JSON.parse(localStorage.getItem("r60_users") || "{}"); } catch { return {}; }
}
function saveUsers(u) {
  localStorage.setItem("r60_users", JSON.stringify(u));
}
function getUserData(uname) {
  const u = getUsers();
  return u[uname] || { data: {}, joinDate: new Date().toISOString().split("T")[0], password: "" };
}
function saveUserData(uname, ud) {
  const u = getUsers();
  u[uname] = ud;
  saveUsers(u);
}
function getAllUsers() {
  const u = getUsers();
  return Object.entries(u).map(([name, d]) => ({ name, ...d }));
}

/* ══════════════════════════════════════
   AUTH
══════════════════════════════════════ */
function doLogin() {
  const u   = document.getElementById("au").value.trim();
  const p   = document.getElementById("ap").value;
  const err = document.getElementById("auth-err");

  if (!u) { err.textContent = "Escribe tu nombre de usuario."; return; }
  if (!p) { err.textContent = "Escribe tu contraseña."; return; }

  /* Admin */
  if (u === ADMIN_USER) {
    if (p === ADMIN_PASS) {
      curUser = u; isAdmin = true;
      err.textContent = "";
      launchMain();
    } else {
      err.textContent = "Contraseña incorrecta.";
    }
    return;
  }

  /* Usuario normal */
  const users = getUsers();

  if (users[u]) {
    /* usuario existente — verificar contraseña */
    if (users[u].password === p) {
      curUser = u; isAdmin = false;
      uData   = getUserData(u);
      err.textContent = "";
      launchMain();
    } else {
      err.textContent = "Contraseña incorrecta. ¿La olvidaste? Usa la opción de abajo.";
    }
  } else {
    /* primer acceso — registrar con la contraseña elegida */
    if (p.length < 4) { err.textContent = "Elige una contraseña de al menos 4 caracteres."; return; }
    const newUser = {
      data:     {},
      joinDate: new Date().toISOString().split("T")[0],
      password: p,
    };
    users[u] = newUser;
    saveUsers(users);
    curUser = u; isAdmin = false;
    uData   = newUser;
    err.textContent = "";
    launchMain();
  }
}

function doLogout() {
  curUser = null; isAdmin = false; curTab = "tracker"; curWeek = 0;
  document.getElementById("auth-screen").style.display = "flex";
  document.getElementById("main-screen").style.display = "none";
  document.getElementById("au").value  = "";
  document.getElementById("ap").value  = "";
  document.getElementById("auth-err").textContent = "";
}

function launchMain() {
  document.getElementById("auth-screen").style.display = "none";
  document.getElementById("main-screen").style.display = "block";
  const chip = document.getElementById("user-chip");
  chip.textContent = isAdmin ? "Administrador" : curUser;
  chip.className   = isAdmin ? "admin-chip" : "user-chip";
  buildTabs();
  renderTab(isAdmin ? "admin" : "tracker");
  if (!isAdmin) scheduleMidnightSave();
}

/* ─── Recover password ─── */
function doRecover() {
  const u   = document.getElementById("rec-user").value.trim();
  const p1  = document.getElementById("rec-pass").value;
  const p2  = document.getElementById("rec-pass2").value;
  const err = document.getElementById("recover-err");

  if (!u)       { err.textContent = "Escribe tu nombre de usuario."; return; }
  if (p1.length < 4) { err.textContent = "La contraseña debe tener al menos 4 caracteres."; return; }
  if (p1 !== p2) { err.textContent = "Las contraseñas no coinciden."; return; }

  const users = getUsers();
  if (!users[u]) { err.textContent = "No existe un usuario con ese nombre."; return; }

  users[u].password = p1;
  saveUsers(users);
  err.style.color = "var(--green)";
  err.textContent = "✓ Contraseña actualizada. Ya puedes iniciar sesión.";
  setTimeout(() => {
    document.getElementById("recover-modal").style.display = "none";
    err.textContent = "";
    err.style.color = "";
  }, 2000);
}

/* ══════════════════════════════════════
   TABS
══════════════════════════════════════ */
function buildTabs() {
  const nav  = document.getElementById("tab-nav");
  const tabs = isAdmin
    ? [{ id: "admin", label: "Panel admin" }]
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
function autoSave() {
  uData.lastSaved = new Date().toISOString();
  saveUserData(curUser, uData);
}

/* ── Midnight auto-save scheduler ── */
let _midnightTimer = null;
function scheduleMidnightSave() {
  if (_midnightTimer) clearTimeout(_midnightTimer);
  const now  = new Date();
  const next = new Date(now);
  next.setHours(23, 59, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  const ms = next - now;
  _midnightTimer = setTimeout(() => {
    if (curUser && !isAdmin) {
      autoSave();
      sendReminderNotification("¡Día guardado! 💪", "Tu progreso de hoy quedó registrado. ¡Mañana sigue adelante!");
    }
    scheduleMidnightSave();
  }, ms);
}

/* ── Web Notifications ── */
function requestNotification() {
  if (!("Notification" in window)) {
    alert("Tu navegador no soporta notificaciones.");
    return;
  }
  if (Notification.permission === "granted") {
    scheduleReminderNotification();
    updateNotifyBtn();
    showToast("✓ Recordatorio activado para las 8:00 PM");
  } else if (Notification.permission !== "denied") {
    Notification.requestPermission().then(perm => {
      if (perm === "granted") {
        scheduleReminderNotification();
        updateNotifyBtn();
        showToast("✓ Recordatorio activado para las 8:00 PM");
      }
    });
  } else {
    showToast("Notificaciones bloqueadas. Actívalas en la configuración del navegador.");
  }
}

function scheduleReminderNotification() {
  /* fire daily at 8pm */
  const now  = new Date();
  const next = new Date(now);
  next.setHours(20, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  const ms = next - now;
  setTimeout(() => {
    sendReminderNotification(
      "⏰ Reto 60 días · Kuale",
      "¡No olvides registrar tus hábitos de hoy! Tienes hasta las 11:59 PM."
    );
    scheduleReminderNotification();
  }, ms);
}

function sendReminderNotification(title, body) {
  if (Notification.permission === "granted") {
    new Notification(title, {
      body,
      icon: "logo-icon.png",
    });
  }
}

function updateNotifyBtn() {
  const btn = document.getElementById("notify-btn");
  if (!btn) return;
  const granted = "Notification" in window && Notification.permission === "granted";
  btn.classList.toggle("notify-active", granted);
  btn.title = granted ? "Recordatorio diario activado" : "Activar recordatorio diario a las 8:00 PM";
}

/* ── Toast ── */
function showToast(msg) {
  let t = document.getElementById("app-toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "app-toast";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 3000);
}

function getWeekDays() {
  const start = curWeek * WEEK_DAYS;
  const days  = [];
  for (let i = 0; i < WEEK_DAYS; i++) { const d = start + i; if (d < DAYS) days.push(d); }
  return days;
}

function calcStats() {
  const days = getWeekDays();

  /* Esta semana: cumplidos / (días de esta semana × hábitos) */
  let wDone = 0;
  days.forEach(d => HABITS.forEach((_, hi) => {
    if (gs(d, hi) === 1) wDone++;
  }));
  const wDenom = days.length * HABITS.length;
  const wPct   = Math.round(wDone / wDenom * 100);

  /* Total general: cumplidos / (días transcurridos × hábitos)
     "transcurrido" = día que tiene al menos 1 hábito marcado O que ya pasó
     Para ser justo usamos días marcados como base (el usuario solo registra días activos) */
  let perfect = 0, streak = 0, sActive = true, tDone = 0, tMark = 0;
  for (let d = 0; d < DAYS; d++) {
    let allD = true, anyM = false, dayDone = 0, dayTotal = 0;
    HABITS.forEach((_, hi) => {
      const s = gs(d, hi);
      if (s > 0) { anyM = true; dayTotal++; }
      if (s === 1) { tDone++; dayDone++; }
      if (s !== 1) allD = false;
      if (s > 0) tMark++;
    });
    if (anyM && allD) perfect++;
    if (sActive) { if (anyM && allD) streak++; else if (anyM) { streak = 0; sActive = false; } }
  }

  /* totalPct: de todos los hábitos que debían cumplirse en días registrados,
     ¿cuántos se cumplieron? Base = días con datos × 10 hábitos */
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
  let html   = "";

  html += `<div class="controls">
    <div class="week-nav">
      <button id="prev-week" aria-label="Semana anterior"><i class="ti ti-chevron-left"></i></button>
      <span class="week-label">Semana ${curWeek + 1}</span>
      <button id="next-week" aria-label="Semana siguiente"><i class="ti ti-chevron-right"></i></button>
    </div>
    <div class="autosave-badge" id="autosave-badge">
      <i class="ti ti-check" aria-hidden="true"></i>
      ${lastSaved ? `Guardado a las ${lastSaved}` : "Se guarda automáticamente"}
    </div>
    <button class="btn-summary" id="summary-btn"><i class="ti ti-chart-bar" aria-hidden="true"></i> Ver mi resumen</button>
    <button class="btn-notify" id="notify-btn" title="Activar recordatorio diario">
      <i class="ti ti-bell" aria-hidden="true"></i>
    </button>
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
    /* % = cumplidos / días en que se registró ALGO (cualquier hábito ese día) */
    let done = 0;
    const daysRegistered = new Set(
      Object.keys(uData.data || {}).filter(k => (uData.data || {})[k] > 0).map(k => k.split("_")[0])
    );
    daysRegistered.forEach(dayStr => {
      if (gs(parseInt(dayStr), hi) === 1) done++;
    });
    const total = daysRegistered.size;
    const pct   = total > 0 ? Math.round(done / total * 100) : 0;
    const badge = h.isNew ? `<span class="new-badge">nuevo</span>` : "";
    html += `<tr><td class="habit-name"><span class="habit-icon">${h.icon}</span>${h.name}${badge}</td>`;
    days.forEach(d => {
      const s   = gs(d, hi);
      const cls = s === 1 ? "done" : s === 2 ? "fail" : "";
      const ico = s === 1 ? "✓"   : s === 2 ? "✗"   : "";
      html += `<td class="${d === 0 ? "today-col" : ""}">
        <button class="check-btn ${cls}" data-d="${d}" data-h="${hi}">${ico}</button>
      </td>`;
    });
    html += `<td class="row-progress">
      <div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
      <div class="pct-label">${pct}%</div>
    </td></tr>`;
  });
  html += `</tbody></table></div>`;

  /* improved legend */
  html += `<div class="legend-card">
    <div class="legend-title"><i class="ti ti-info-circle" aria-hidden="true"></i> ¿Cómo registrar?</div>
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
    <h2><i class="ti ti-brain" aria-hidden="true"></i> Ejercicios de mindfulness (5 min)</h2>
    <p class="section-sub">Rota estos ejercicios cada día para cumplir tu hábito de mindfulness</p>
    <div class="cards-grid">`;
  MINDFULNESS.forEach(m => {
    html += `<div class="m-card">
      <div class="m-card-header">
        <div class="m-card-icon">${m.icon}</div>
        <div><div class="m-card-title">${m.title}</div><div class="m-card-time">${m.time}</div></div>
      </div>
      <p>${m.desc}</p>
    </div>`;
  });
  html += `</div></div>`;

  document.getElementById("page-content").innerHTML = html;

  document.getElementById("prev-week").addEventListener("click", () => {
    if (curWeek > 0) { curWeek--; renderTracker(); }
  });
  document.getElementById("next-week").addEventListener("click", () => {
    if (curWeek < TOTAL_WEEKS - 1) { curWeek++; renderTracker(); }
  });
  document.getElementById("summary-btn").addEventListener("click", openSummary);

  /* auto-save on habit click */
  document.querySelectorAll(".check-btn").forEach(btn => {
    btn.addEventListener("click", function () {
      cs(parseInt(this.dataset.d), parseInt(this.dataset.h));
      autoSave();
      renderTracker();
    });
  });

  document.querySelectorAll(".week-pill").forEach(p => {
    p.addEventListener("click", function () { curWeek = parseInt(this.dataset.w); renderTracker(); });
  });

  /* notification button */
  document.getElementById("notify-btn").addEventListener("click", requestNotification);
  updateNotifyBtn();
}

/* ─── Summary modal (usuario actual) ─── */
function openSummary() {
  let tDone = 0, perfect = 0;
  for (let d = 0; d < DAYS; d++) {
    let allD = true, anyM = false;
    HABITS.forEach((_, hi) => {
      const s = gs(d, hi);
      if (s > 0) anyM = true;
      if (s !== 1) allD = false;
      if (s === 1) tDone++;
    });
    if (anyM && allD) perfect++;
  }
  const daysWithData = new Set(
    Object.keys(uData.data || {}).filter(k => (uData.data || {})[k] > 0).map(k => k.split("_")[0])
  ).size;
  const denom = daysWithData * HABITS.length;
  const pct   = denom > 0 ? Math.round(tDone / denom * 100) : 0;

  let rows = "";
  HABITS.forEach((h, hi) => {
    let done = 0, daysCounted = new Set();
    for (let d = 0; d < DAYS; d++) {
      const s = gs(d, hi);
      if (s > 0) daysCounted.add(d);
      if (s === 1) done++;
    }
    const total = daysCounted.size;
    const p = total > 0 ? Math.round(done / total * 100) : 0;
    rows += `<li>
      <span>${h.icon} ${h.name}</span>
      <span class="habit-pct${p < 50 && total > 0 ? " low" : ""}">${total > 0 ? p + "%" : "—"}</span>
    </li>`;
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
function getUserStats(uname) {
  const ud = getUserData(uname);
  const d  = ud.data || {};
  let tDone = 0, perfect = 0, streak = 0, sActive = true;

  for (let day = 0; day < DAYS; day++) {
    let allD = true, anyM = false;
    HABITS.forEach((_, hi) => {
      const s = d[`${day}_${hi}`] || 0;
      if (s > 0) anyM = true;
      if (s !== 1) allD = false;
      if (s === 1) tDone++;
    });
    if (anyM && allD) perfect++;
    if (sActive) { if (anyM && allD) streak++; else if (anyM) { streak = 0; sActive = false; } }
  }

  const daysWithData = new Set(
    Object.keys(d).filter(k => d[k] > 0).map(k => k.split("_")[0])
  ).size;

  /* cumplimiento = hábitos cumplidos / (días registrados × total hábitos) */
  const denom = daysWithData * HABITS.length;
  const pct   = denom > 0 ? Math.round(tDone / denom * 100) : 0;

  return { pct, perfect, streak, daysWithData, joinDate: ud.joinDate || "—" };
}

function renderAdmin() {
  const users = getAllUsers().filter(u => u.name !== ADMIN_USER);
  const pc    = document.getElementById("page-content");

  if (users.length === 0) {
    pc.innerHTML = `<div class="empty-admin">
      <i class="ti ti-users" style="font-size:3rem;display:block;margin-bottom:1rem;opacity:.3" aria-hidden="true"></i>
      <p>Aún no hay usuarios registrados.</p>
      <p style="font-size:12px;margin-top:4px">Cuando alguien inicie sesión aparecerá aquí.</p>
    </div>`;
    return;
  }

  const stats   = users.map(u => ({ ...u, ...getUserStats(u.name) }));
  const avgPct  = Math.round(stats.reduce((a, s) => a + s.pct, 0) / stats.length);
  const avgDays = Math.round(stats.reduce((a, s) => a + s.daysWithData, 0) / stats.length);
  const best    = stats.reduce((a, b) => b.pct > a.pct ? b : a, stats[0]);
  const totalPerfect = stats.reduce((a, s) => a + s.perfect, 0);

  let html = `<div class="admin-summary-grid">
    <div class="admin-card"><div class="num">${users.length}</div><div class="lbl">Participantes</div></div>
    <div class="admin-card"><div class="num">${avgPct}%</div><div class="lbl">Cumplimiento promedio</div></div>
    <div class="admin-card"><div class="num">${avgDays}</div><div class="lbl">Días prom. registrados</div></div>
    <div class="admin-card"><div class="num">${totalPerfect}</div><div class="lbl">Días perfectos (total)</div></div>
  </div>`;

  /* ── Top participantes ── */
  const top = [...stats].sort((a, b) => b.pct - a.pct).slice(0, Math.min(stats.length, 5));
  const medals = ["🥇", "🥈", "🥉", "4°", "5°"];
  const medalColors = ["#FFD700", "#C0C0C0", "#CD7F32", "var(--gray-400)", "var(--gray-400)"];

  html += `<div class="top-section">
    <div class="chart-title" style="margin-bottom:12px">
      <i class="ti ti-trophy" aria-hidden="true" style="color:var(--green);margin-right:6px"></i>
      Top participantes
    </div>
    <div class="top-list">`;

  top.forEach((s, i) => {
    const statusCls = s.pct >= 70 ? "badge-green" : s.pct >= 40 ? "badge-gray" : "badge-red";
    html += `
      <div class="top-row ${i === 0 ? "top-first" : ""}">
        <span class="top-medal" style="color:${medalColors[i]}">${medals[i]}</span>
        <div class="top-avatar">${s.name.charAt(0).toUpperCase()}</div>
        <div class="top-info">
          <button class="user-link top-name" data-uname="${s.name}">${s.name}</button>
          <div class="top-meta">${s.daysWithData} días registrados · ${s.perfect} días perfectos · racha ${s.streak}d</div>
        </div>
        <div class="top-right">
          <div class="top-pct">${s.pct}%</div>
          <span class="badge ${statusCls}" style="font-size:10px">${s.pct >= 70 ? "En buen camino" : s.pct >= 40 ? "En progreso" : "Necesita apoyo"}</span>
        </div>
      </div>`;
  });

  html += `</div></div>`;

  const chartH = Math.max(180, users.length * 44 + 60);
  html += `<div class="charts-row">
    <div class="chart-card">
      <div class="chart-title">Cumplimiento por usuario</div>
      <div style="position:relative;height:${chartH}px">
        <canvas id="chart-users" role="img" aria-label="Gráfica de cumplimiento por usuario"></canvas>
      </div>
    </div>
    <div class="chart-card">
      <div class="chart-title">Días registrados por usuario</div>
      <div style="position:relative;height:${chartH}px">
        <canvas id="chart-days" role="img" aria-label="Gráfica de días registrados por usuario"></canvas>
      </div>
    </div>
  </div>`;

  html += `<div class="admin-table-section">
    <div class="chart-title">Detalle por usuario <span style="font-size:11px;font-weight:400;color:var(--gray-400)">— clic en el nombre para ver progreso completo</span></div>
    <div class="table-wrap">
      <table class="users-table">
        <thead><tr>
          <th>Usuario</th><th>Se unió</th><th>Días registrados</th>
          <th>Cumplimiento</th><th>Racha</th><th>Días perfectos</th><th>Estado</th><th>Acciones</th>
        </tr></thead>
        <tbody>`;

  stats.sort((a, b) => b.pct - a.pct).forEach(s => {
    const statusCls = s.pct >= 70 ? "badge-green" : s.pct >= 40 ? "badge-gray" : "badge-red";
    const statusTxt = s.pct >= 70 ? "En buen camino" : s.pct >= 40 ? "En progreso" : "Necesita apoyo";
    html += `<tr>
      <td><button class="user-link" data-uname="${s.name}">${s.name}</button></td>
      <td>${s.joinDate}</td>
      <td>${s.daysWithData} / 60</td>
      <td>
        <div class="inline-bar"><div class="inline-bar-fill" style="width:${s.pct}%"></div></div>
        ${s.pct}%
      </td>
      <td>${s.streak}d</td>
      <td>${s.perfect}</td>
      <td><span class="badge ${statusCls}">${statusTxt}</span></td>
      <td class="td-actions">
        <button class="btn-action btn-edit" data-uname="${s.name}" title="Cambiar contraseña">
          <i class="ti ti-lock" aria-hidden="true"></i> Contraseña
        </button>
        <button class="btn-action btn-delete" data-uname="${s.name}" title="Eliminar usuario">
          <i class="ti ti-trash" aria-hidden="true"></i>
        </button>
      </td>
    </tr>`;
  });

  html += `</tbody></table></div></div>`;

  /* Edit password modal (inline, reuses recover-modal structure) */
  html += `
  <div id="edit-pass-modal" class="modal-bg" style="display:none">
    <div class="modal-box" style="max-width:380px">
      <div class="modal-hdr">
        <h2>Cambiar contraseña</h2>
        <button id="close-edit-pass"><i class="ti ti-x"></i></button>
      </div>
      <p style="font-size:13px;color:var(--gray-600);margin-bottom:1rem">
        Usuario: <strong id="edit-pass-uname"></strong>
      </p>
      <label for="ep-pass">Nueva contraseña</label>
      <input id="ep-pass" type="password" placeholder="Mínimo 4 caracteres">
      <label for="ep-pass2" style="margin-top:12px">Confirmar contraseña</label>
      <input id="ep-pass2" type="password" placeholder="Repite la contraseña">
      <button class="btn-green" id="do-edit-pass" style="margin-top:1.25rem">Guardar contraseña</button>
      <div class="auth-err" id="edit-pass-err" style="min-height:18px;margin-top:8px"></div>
    </div>
  </div>`;

  pc.innerHTML = html;

  /* click on user name → open detail modal */
  pc.querySelectorAll(".user-link").forEach(btn => {
    btn.addEventListener("click", () => openUserDetail(btn.dataset.uname));
  });

  /* edit password */
  pc.querySelectorAll(".btn-edit").forEach(btn => {
    btn.addEventListener("click", () => openEditPass(btn.dataset.uname));
  });

  /* delete user */
  pc.querySelectorAll(".btn-delete").forEach(btn => {
    btn.addEventListener("click", () => deleteUser(btn.dataset.uname));
  });

  /* edit pass modal events */
  document.getElementById("close-edit-pass").addEventListener("click", () => {
    document.getElementById("edit-pass-modal").style.display = "none";
  });
  document.getElementById("edit-pass-modal").addEventListener("click", function(e) {
    if (e.target === this) this.style.display = "none";
  });
  document.getElementById("do-edit-pass").addEventListener("click", doEditPass);

  /* charts */
  if (adminChart1) { adminChart1.destroy(); adminChart1 = null; }
  if (adminChart2) { adminChart2.destroy(); adminChart2 = null; }

  const sortedStats = [...stats].sort((a, b) => b.pct - a.pct);
  const names    = sortedStats.map(s => s.name);
  const pcts     = sortedStats.map(s => s.pct);
  const daysArr  = sortedStats.map(s => s.daysWithData);
  const colors   = pcts.map(p => p >= 70 ? "#ed1c24" : p >= 40 ? "#888780" : "#D85A30");

  adminChart1 = new Chart(document.getElementById("chart-users"), {
    type: "bar",
    data: { labels: names, datasets: [{ label: "Cumplimiento %", data: pcts, backgroundColor: colors, borderRadius: 4 }] },
    options: {
      indexAxis: "y", responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { max: 100, ticks: { callback: v => v + "%" } },
        y: { ticks: { font: { size: 11 } } }
      }
    }
  });

  adminChart2 = new Chart(document.getElementById("chart-days"), {
    type: "bar",
    data: { labels: names, datasets: [{ label: "Días", data: daysArr, backgroundColor: "#f5a0a3", borderRadius: 4 }] },
    options: {
      indexAxis: "y", responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: { max: 60 }, y: { ticks: { font: { size: 11 } } } }
    }
  });
}

/* ── User detail modal — desglose por semana (acordeón) ── */
function openUserDetail(uname) {
  const st  = getUserStats(uname);
  const ud  = getUserData(uname);
  const d   = ud.data || {};

  document.getElementById("ud-title").textContent = uname;

  const statusCls = st.pct >= 70 ? "badge-green" : st.pct >= 40 ? "badge-gray" : "badge-red";
  const statusTxt = st.pct >= 70 ? "En buen camino" : st.pct >= 40 ? "En progreso" : "Necesita apoyo";

  /* build week accordion blocks */
  let weeksHtml = "";
  for (let w = 0; w < TOTAL_WEEKS; w++) {
    const startDay = w * WEEK_DAYS;
    const days = [];
    for (let i = 0; i < WEEK_DAYS; i++) {
      const day = startDay + i;
      if (day < DAYS) days.push(day);
    }

    /* week-level stats: cumplidos / (días con datos en esa semana × hábitos) */
    let wDone = 0, wPerfect = 0;
    const wDaysWithData = new Set();
    days.forEach(day => {
      let allD = true, anyM = false;
      HABITS.forEach((_, hi) => {
        const s = d[`${day}_${hi}`] || 0;
        if (s > 0) { anyM = true; wDaysWithData.add(day); }
        if (s !== 1) allD = false;
        if (s === 1) wDone++;
      });
      if (anyM && allD) wPerfect++;
    });
    const wDenom  = wDaysWithData.size * HABITS.length;
    const wPct    = wDenom > 0 ? Math.round(wDone / wDenom * 100) : 0;
    const hasData = wDaysWithData.size > 0;

    /* table: rows = habits, cols = days of this week */
    let thead = `<tr><th class="wt-habit">Hábito</th>`;
    days.forEach(day => { thead += `<th class="wt-day">Día ${day + 1}</th>`; });
    thead += `<th class="wt-pct">%</th></tr>`;

    let tbody = "";
    HABITS.forEach((h, hi) => {
      let hDone = 0;
      days.forEach(day => {
        if (d[`${day}_${hi}`] === 1) hDone++;
      });
      /* denominator = days in this week that had any habit registered */
      const hPct = wDaysWithData.size > 0 ? Math.round(hDone / wDaysWithData.size * 100) : null;
      tbody += `<tr>`;
      tbody += `<td class="wt-habit-name"><span class="habit-icon">${h.icon}</span>${h.name}</td>`;
      days.forEach(day => {
        const s   = d[`${day}_${hi}`] || 0;
        const cls = s === 1 ? "wc-done" : s === 2 ? "wc-fail" : "wc-empty";
        const ico = s === 1 ? "✓" : s === 2 ? "✗" : "";
        tbody += `<td class="wt-cell"><span class="${cls}" title="Día ${day + 1}">${ico}</span></td>`;
      });
      const pTxt = hPct !== null ? hPct + "%" : "—";
      const pCls = hPct !== null && hPct < 50 ? "low" : "";
      tbody += `<td class="wt-pct-val ${pCls}">${pTxt}</td>`;
      tbody += `</tr>`;
    });

    const pctColor = wPct >= 70 ? "var(--green)" : wPct >= 40 ? "var(--gray-600)" : "var(--red)";
    weeksHtml += `
      <div class="week-accordion ${w === 0 ? "open" : ""}" data-w="${w}">
        <button class="week-acc-header">
          <span class="wah-label">
            <i class="ti ti-chevron-right wah-icon" aria-hidden="true"></i>
            Semana ${w + 1}
            <span style="font-size:11px;font-weight:400;color:var(--gray-400);margin-left:6px">
              Días ${startDay + 1}–${Math.min(startDay + WEEK_DAYS, DAYS)}
            </span>
          </span>
          <span class="wah-stats">
            ${hasData
              ? `<span style="color:${pctColor};font-weight:600">${wPct}%</span>
                 <span style="color:var(--gray-400);font-size:11px;margin-left:8px">${wDone} cumplidos · ${wPerfect} día${wPerfect !== 1 ? "s" : ""} perfecto${wPerfect !== 1 ? "s" : ""}</span>`
              : `<span style="color:var(--gray-400);font-size:11px">Sin datos</span>`
            }
          </span>
        </button>
        <div class="week-acc-body">
          <div class="wt-wrap">
            <table class="week-table">
              <thead>${thead}</thead>
              <tbody>${tbody}</tbody>
            </table>
          </div>
        </div>
      </div>`;
  }

  document.getElementById("ud-content").innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:1.25rem;flex-wrap:wrap">
      <div style="width:44px;height:44px;border-radius:50%;background:var(--green-light);display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:600;color:var(--green-dark);flex-shrink:0">
        ${uname.charAt(0).toUpperCase()}
      </div>
      <div>
        <div style="font-weight:600;font-size:15px">${uname}</div>
        <div style="font-size:12px;color:var(--gray-400)">Se unió el ${st.joinDate}</div>
      </div>
      <span class="badge ${statusCls}" style="margin-left:auto">${statusTxt}</span>
    </div>
    <div class="modal-stats" style="margin-bottom:1.5rem">
      <div class="modal-stat"><div class="num">${st.pct}%</div><div class="lbl">Cumplimiento total</div></div>
      <div class="modal-stat"><div class="num">${st.perfect}</div><div class="lbl">Días perfectos</div></div>
      <div class="modal-stat"><div class="num">${st.daysWithData}/60</div><div class="lbl">Días registrados</div></div>
      <div class="modal-stat"><div class="num">${st.streak}d</div><div class="lbl">Racha actual</div></div>
    </div>
    <div style="font-size:13px;font-weight:600;color:var(--gray-900);margin-bottom:4px">Progreso por semana</div>
    <div class="ud-legend" style="margin-bottom:12px">
      <span class="wc-done ud-leg-dot"></span>Cumplido
      <span class="wc-fail ud-leg-dot" style="margin-left:10px"></span>No cumplido
      <span class="wc-empty ud-leg-dot" style="margin-left:10px"></span>Sin marcar
    </div>
    <div class="weeks-accordion">${weeksHtml}</div>`;

  /* accordion toggle */
  document.querySelectorAll(".week-acc-header").forEach(btn => {
    btn.addEventListener("click", () => {
      const acc = btn.closest(".week-accordion");
      acc.classList.toggle("open");
    });
  });

  document.getElementById("user-detail-modal").style.display = "flex";
}

/* ── Delete user ── */
let _pendingDelete = null;

function deleteUser(uname) {
  _pendingDelete = uname;
  document.getElementById("confirm-uname").textContent = uname;
  document.getElementById("confirm-modal").style.display = "flex";
}

/* ── Edit password ── */
function openEditPass(uname) {
  document.getElementById("edit-pass-uname").textContent = uname;
  document.getElementById("ep-pass").value  = "";
  document.getElementById("ep-pass2").value = "";
  document.getElementById("edit-pass-err").textContent = "";
  document.getElementById("edit-pass-err").style.color = "";
  document.getElementById("edit-pass-modal").dataset.uname = uname;
  document.getElementById("edit-pass-modal").style.display = "flex";
}

function doEditPass() {
  const uname = document.getElementById("edit-pass-modal").dataset.uname;
  const p1    = document.getElementById("ep-pass").value;
  const p2    = document.getElementById("ep-pass2").value;
  const err   = document.getElementById("edit-pass-err");
  if (p1.length < 4) { err.textContent = "Mínimo 4 caracteres."; return; }
  if (p1 !== p2)     { err.textContent = "Las contraseñas no coinciden."; return; }
  const users = getUsers();
  if (!users[uname]) { err.textContent = "Usuario no encontrado."; return; }
  users[uname].password = p1;
  saveUsers(users);
  err.style.color   = "var(--green)";
  err.textContent   = "✓ Contraseña actualizada.";
  setTimeout(() => {
    document.getElementById("edit-pass-modal").style.display = "none";
  }, 1200);
}

/* ══════════════════════════════════════
   INIT
══════════════════════════════════════ */
document.getElementById("login-btn").addEventListener("click", doLogin);
document.getElementById("au").addEventListener("keydown", e => {
  if (e.key === "Enter") document.getElementById("ap").focus();
});
document.getElementById("ap").addEventListener("keydown", e => {
  if (e.key === "Enter") doLogin();
});
document.getElementById("logout-btn").addEventListener("click", doLogout);

/* Summary modal */
document.getElementById("close-modal").addEventListener("click", () => {
  document.getElementById("sum-modal").style.display = "none";
});
document.getElementById("sum-modal").addEventListener("click", function (e) {
  if (e.target === this) this.style.display = "none";
});

/* Recover password modal */
document.getElementById("recover-btn").addEventListener("click", () => {
  document.getElementById("recover-modal").style.display = "flex";
});
document.getElementById("close-recover").addEventListener("click", () => {
  document.getElementById("recover-modal").style.display = "none";
  document.getElementById("recover-err").textContent = "";
  document.getElementById("recover-err").style.color = "";
});
document.getElementById("recover-modal").addEventListener("click", function (e) {
  if (e.target === this) {
    this.style.display = "none";
    document.getElementById("recover-err").textContent = "";
    document.getElementById("recover-err").style.color = "";
  }
});
document.getElementById("do-recover").addEventListener("click", doRecover);

/* User detail modal */
document.getElementById("close-ud").addEventListener("click", () => {
  document.getElementById("user-detail-modal").style.display = "none";
});
document.getElementById("user-detail-modal").addEventListener("click", function (e) {
  if (e.target === this) this.style.display = "none";
});

/* Confirm delete modal */
document.getElementById("confirm-cancel").addEventListener("click", () => {
  document.getElementById("confirm-modal").style.display = "none";
  _pendingDelete = null;
});
document.getElementById("confirm-modal").addEventListener("click", function (e) {
  if (e.target === this) {
    this.style.display = "none";
    _pendingDelete = null;
  }
});
document.getElementById("confirm-ok").addEventListener("click", () => {
  if (!_pendingDelete) return;
  const users = getUsers();
  delete users[_pendingDelete];
  saveUsers(users);
  _pendingDelete = null;
  document.getElementById("confirm-modal").style.display = "none";
  renderAdmin();
});