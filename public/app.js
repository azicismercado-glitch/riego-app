/* =========================================================================
   Diagnóstico Técnico de Riego — frontend real (habla con la API del backend)
   ========================================================================= */

const STAGES = ['borrador','firmado_tecnico','firmado_provincia','firmado_cfi'];
const STAGE_LABELS = {borrador:'Borrador', firmado_tecnico:'Firmado por técnico', firmado_provincia:'Firmado por provincia', firmado_cfi:'Validado por CFI'};
const STAGE_ROLE = ['tecnico','provincia','cfi'];
const DEMO_HINT = {tecnico:{username:'aperez', password:'1234'}, provincia:{username:'mgomez', password:'1234'}, cfi:{username:'lcosta', password:'1234'}, lector:{username:'invitado', password:'1234'}};
const TABS = [['estab','Establec.'],['cultivos','Cultivos'],['suelo','Suelo'],['riego','Riego'],['propuesta','Propuesta'],['fotos','Fotos'],['resumen','Resumen'],['firmas','Firmas'],['historial','Historial']];
const FUENTES_RIEGO_DERECHO = ['Superficial','Subterránea','Mixta'];
const DESTINOS_CULTIVO = ['Industria','Consumo','Oleaginosa','Cereal','Otro'];
const RENDIMIENTO_UNIDADES = ['Kg/ha','Materia seca/ha','Otros'];
const ACTIVIDAD_GANADERA = ['Cría','Invernada','Ciclo completo'];
const CATEGORIAS_GANADERAS = ['Terneros/as','Vaquillonas','Novillos','Novillitos','Vacas','Toros','Cabritos','Corderos','Otros'];
const TEXTURAS_SUELO = ['Arenoso','Areno francoso','Franco arenoso','Franco','Franco limoso','Limoso','Franco arcillo arenoso','Franco arcilloso','Franco arcillo limoso','Arcillo arenoso','Arcillo limoso','Arcilloso'];
const ANALISIS_PREVIO_ITEMS = ['Salinidad','Textura','Profundidad','Materia orgánica','pH','Otro'];
// Nomenclador de inversiones — Línea de Financiamiento Triple Impacto (CFI).
// Nivel 1: 13 grandes categorías (A-M). Nivel 2: subcategorías dentro de cada
// una. El nivel 2 se filtra según la categoría elegida en el nivel 1.
const NOMENCLADOR = [{"n1":"A","label":"Captación y fuente de agua","items":[{"n2":"A01","label":"Perforación de pozo nuevo"},{"n2":"A02","label":"Readecuación / rehabilitación de pozo existente"},{"n2":"A03","label":"Equipo de bombeo de pozo"},{"n2":"A04","label":"Obra de toma superficial"},{"n2":"A05","label":"Conexión a red o sistema colectivo"},{"n2":"A06","label":"Bombeo de refuerzo / rebombeo (booster)"},{"n2":"A07","label":"Captación de fuentes no convencionales"}]},{"n1":"B","label":"Almacenamiento y regulación","items":[{"n2":"B01","label":"Reservorio / represa de tierra"},{"n2":"B02","label":"Impermeabilización de reservorios"},{"n2":"B03","label":"Cisternas y tanques de regulación"},{"n2":"B04","label":"Obras de seguridad y control del reservorio"}]},{"n1":"C","label":"Conducción y distribución intrapredial","items":[{"n2":"C01","label":"Red de conducción entubada a presión"},{"n2":"C02","label":"Entubado o impermeabilización de canales intraprediales"},{"n2":"C03","label":"Obras de arte y regulación en la red"},{"n2":"C04","label":"Vinculación entre sectores y flexibilización de la red"}]},{"n1":"D","label":"Aplicación – Riego presurizado","items":[{"n2":"D01","label":"Riego por goteo superficial"},{"n2":"D02","label":"Riego por goteo subsuperficial (SDI)"},{"n2":"D03","label":"Microaspersión / microjet"},{"n2":"D04","label":"Aspersión fija o semifija"},{"n2":"D05","label":"Cañón regador / enrollador"},{"n2":"D06","label":"Pivote central"},{"n2":"D07","label":"Avance frontal (lateral move)"},{"n2":"D08","label":"Reconversión / repotenciación de equipos existentes"},{"n2":"D09","label":"Riego de precisión variable (VRI)"}]},{"n1":"E","label":"Aplicación – Riego gravitacional tecnificado","items":[{"n2":"E01","label":"Nivelación y sistematización con control láser o GPS"},{"n2":"E02","label":"Riego por mangas multicompuerta"},{"n2":"E03","label":"Riego intermitente (surge flow)"},{"n2":"E04","label":"Recirculación de agua de cola"},{"n2":"E05","label":"Automatización del riego por superficie"}]},{"n1":"F","label":"Energía y eficiencia energética","items":[{"n2":"F01","label":"Bombeo solar fotovoltaico"},{"n2":"F02","label":"Generación fotovoltaica conectada a red (on-grid)"},{"n2":"F03","label":"Almacenamiento de energía"},{"n2":"F04","label":"Sustitución o repotenciación de fuente energética"},{"n2":"F05","label":"Eficiencia eléctrica del equipo de bombeo"},{"n2":"F06","label":"Infraestructura de conexión eléctrica"},{"n2":"F07","label":"Optimización hidráulica para ahorro energético"},{"n2":"F08","label":"Otras fuentes renovables e híbridas"}]},{"n1":"G","label":"Cabezal, filtrado, fertirriego y calidad de agua","items":[{"n2":"G01","label":"Cabezal de filtrado"},{"n2":"G02","label":"Equipamiento de fertirriego"},{"n2":"G03","label":"Tratamiento y acondicionamiento de agua de riego"},{"n2":"G04","label":"Válvulas, hidrantes y accesorios de comando"},{"n2":"G05","label":"Sala de cabezal e instalaciones asociadas"}]},{"n1":"H","label":"Automatización, monitoreo y agricultura digital","items":[{"n2":"H01","label":"Sensores de humedad y estado hídrico"},{"n2":"H02","label":"Estaciones meteorológicas y cálculo de ETc"},{"n2":"H03","label":"Telemetría, control remoto y automatización"},{"n2":"H04","label":"Medición volumétrica y macromedición"},{"n2":"H05","label":"Software y plataformas de gestión de riego"},{"n2":"H06","label":"Sensoramiento remoto y relevamientos aéreos"},{"n2":"H07","label":"Mapeo de suelos y zonas de manejo"}]},{"n1":"I","label":"Suelos, drenaje y salinidad","items":[{"n2":"I01","label":"Sistematización y acondicionamiento del terreno"},{"n2":"I02","label":"Drenaje superficial"},{"n2":"I03","label":"Drenaje subsuperficial"},{"n2":"I04","label":"Recuperación de suelos salinos y sódicos"},{"n2":"I05","label":"Protección del sistema y control de viento"}]},{"n1":"J","label":"Gestión del recurso hídrico y sistemas colectivos","items":[{"n2":"J01","label":"Modernización de redes de sistemas colectivos"},{"n2":"J02","label":"Medición y telemetría a nivel de red o consorcio"},{"n2":"J03","label":"Sistemas de gestión de turnos y distribución"},{"n2":"J04","label":"Monitoreo de acuíferos y aguas superficiales"},{"n2":"J05","label":"Recarga gestionada de acuíferos (MAR)"},{"n2":"J06","label":"Balance hídrico y planificación zonal"},{"n2":"J07","label":"Reúso de agua y economía circular del recurso"},{"n2":"J08","label":"Fortalecimiento institucional de organizaciones de regantes"}]},{"n1":"K","label":"Reconversión productiva asociada a la puesta bajo riego","items":[{"n2":"K01","label":"Implantación o reconversión de cultivos bajo riego"},{"n2":"K02","label":"Estructuras de sostén y protección de cultivo"},{"n2":"K03","label":"Cultivo protegido con riego tecnificado"},{"n2":"K04","label":"Intensificación forrajera bajo riego"},{"n2":"K05","label":"Capital de trabajo asociado a la puesta en riego"}]},{"n1":"L","label":"Estudios, proyectos y servicios técnicos","items":[{"n2":"L01","label":"Estudios hidrogeológicos y prospección"},{"n2":"L02","label":"Análisis de agua y suelo"},{"n2":"L03","label":"Proyecto ejecutivo y dirección de obra"},{"n2":"L04","label":"Evaluación y auditoría de sistemas en operación"},{"n2":"L05","label":"Capacitación y puesta en marcha"},{"n2":"L06","label":"Regularización de derechos de uso del agua y permisos"},{"n2":"L07","label":"Gestión ambiental y certificaciones"}]},{"n1":"M","label":"Infraestructura y equipamiento complementario","items":[{"n2":"M01","label":"Instalación, montaje y puesta en marcha"},{"n2":"M02","label":"Fletes, seguros y gastos de importación"},{"n2":"M03","label":"Caminos internos y accesos"},{"n2":"M04","label":"Depósito, taller y guarda de equipamiento"},{"n2":"M05","label":"Seguridad de las instalaciones"},{"n2":"M06","label":"Maquinaria y equipamiento de apoyo"}]}];

let state = {
  token: localStorage.getItem('riego_token') || null,
  session: JSON.parse(localStorage.getItem('riego_user') || 'null'),
  loginSelectedRole: 'tecnico', loginError: '', loginBusy:false,
  view: 'home', currentId: null, activeTab: 'estab', showLogin: false,
  diagnosticos: [], currentDiag: null, dashboardData: null, dashboardLoading: false,
  pendingSignAction: null, reauthError: '', reauthBusy:false, pendingObs:'', pendingSignatureData:null,
  emails: [], emailsSmtpConfigured:false, showMail: false, unreadCount:0
};

/* ================= API helper ================= */
async function api(path, opts) {
  opts = opts || {};
  const headers = opts.headers || {};
  if (!(opts.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  if (state.token) headers['Authorization'] = 'Bearer ' + state.token;
  const res = await fetch('/api' + path, { ...opts, headers });
  let body = null;
  try { body = await res.json(); } catch (e) { /* sin cuerpo */ }
  if (!res.ok) {
    const err = new Error((body && body.error) || ('Error HTTP ' + res.status));
    err.data = body;
    throw err;
  }
  return body;
}

function nowFmt(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' });
}

/* ================= sesión ================= */
function saveSession(token, user) {
  state.token = token; state.session = user;
  localStorage.setItem('riego_token', token);
  localStorage.setItem('riego_user', JSON.stringify(user));
}
function clearSession() {
  state.token = null; state.session = null;
  localStorage.removeItem('riego_token'); localStorage.removeItem('riego_user');
}

/* ================= render raíz ================= */
async function render() {
  if (!state.session) {
    document.getElementById('mainApp').style.display = 'none';
    if (state.showLogin) { renderLoginScreen(); } else { renderWelcomeScreen(); }
    renderReauthOverlay();
    return;
  }
  document.getElementById('loginScreen').innerHTML = '';
  document.getElementById('mainApp').style.display = 'flex';
  renderUserBadge();
  const root = document.getElementById('viewRoot');
  if (state.view === 'home') {
    root.innerHTML = '<div class="empty-state"><i class="ti ti-loader-2"></i><p>Cargando…</p></div>';
    try {
      state.diagnosticos = await api('/diagnosticos');
    } catch (e) { handleAuthError(e); return; }
    root.innerHTML = renderHome();
  } else if (state.view === 'dashboard') {
    root.innerHTML = renderDashboardView();
  } else {
    root.innerHTML = renderDetail();
    if (state.activeTab === 'firmas') setTimeout(setupCanvases, 0);
  }
  renderReauthOverlay();
  refreshUnreadCount();
}

function handleAuthError(e) {
  if (e && e.data === null) { /* red error */ }
  if (String(e.message || '').match(/sesión inválida|no autenticado/i)) {
    clearSession(); state.view = 'home'; render();
  } else {
    alert(e.message || 'Ocurrió un error.');
  }
}

/* ================= bienvenida ================= */
function renderWelcomeScreen() {
  document.getElementById('loginScreen').innerHTML = `
    <div class="login-screen"><div class="login-card welcome-card">
      <div class="eyebrow">Programa de Apoyo para la Tecnificación del Riego</div>
      <h1>Diagnósticos técnicos</h1>
      <div class="login-sub">Relevamiento técnico y circuito de firmas digitales para proyectos de mejora del riego, con seguimiento de inversiones y créditos.</div>
      <button class="btn-login" onclick="goToLogin()">Ingresar <i class="ti ti-arrow-right"></i></button>
    </div></div>`;
}
function goToLogin() { state.showLogin = true; render(); }

/* ================= login ================= */
function renderLoginScreen() {
  const r = state.loginSelectedRole;
  const roles = [['tecnico','Técnico de campo'],['provincia','Resp. provincial'],['cfi','Técnico CFI'],['lector','Solo lectura']];
  document.getElementById('loginScreen').innerHTML = `
    <div class="login-screen"><div class="login-card">
      <div class="eyebrow">Programa de Apoyo para la Tecnificación del Riego</div>
      <h1>Diagnóstico Técnico de Riego</h1>
      <div class="login-sub">Iniciá sesión con tu usuario para cargar diagnósticos y firmar.</div>
      <div class="login-role-tabs">${roles.map(([id,l])=>`<button class="${r===id?'active':''}" onclick="setLoginRole('${id}')">${l}</button>`).join('')}</div>
      <input type="text" id="loginUser" placeholder="Usuario" autocomplete="off">
      <input type="password" id="loginPass" placeholder="Contraseña">
      ${state.loginError ? `<div class="login-error"><i class="ti ti-alert-circle"></i> ${state.loginError}</div>` : ''}
      <div class="login-hint"><i class="ti ti-info-circle"></i> Usuario demo sembrado por el backend: <b>${DEMO_HINT[r].username}</b> · contraseña: <b>${DEMO_HINT[r].password}</b></div>
      <button class="btn-login" ${state.loginBusy?'disabled':''} onclick="doLogin()">${state.loginBusy?'Ingresando…':'Ingresar'}</button>
    </div></div>`;
  const pass = document.getElementById('loginPass');
  if (pass) pass.addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });
}
function setLoginRole(role) { state.loginSelectedRole = role; state.loginError = ''; render(); }
async function doLogin() {
  const u = document.getElementById('loginUser').value.trim();
  const p = document.getElementById('loginPass').value;
  if (!u || !p) { state.loginError = 'Completá usuario y contraseña.'; render(); return; }
  state.loginBusy = true; render();
  try {
    const { token, user } = await api('/auth/login', { method: 'POST', body: JSON.stringify({ username: u, password: p }) });
    saveSession(token, user);
    state.loginError = ''; state.view = 'home'; state.loginBusy = false;
    render();
  } catch (e) {
    state.loginBusy = false;
    state.loginError = e.message || 'Usuario o contraseña incorrectos.';
    render();
  }
}
function logout() { clearSession(); state.view = 'home'; state.currentId = null; state.currentDiag = null; state.showLogin = false; render(); }

function renderUserBadge() {
  const s = state.session;
  document.getElementById('userBadge').innerHTML = `
    <div class="user-badge">
      <div class="who"><i class="ti ti-user-circle"></i><div>${s.nombre}<span>${s.rolLabel} · ${s.username}</span></div></div>
      <div style="display:flex;gap:6px;align-items:center">
        <button class="mail-btn" onclick="toggleMail()" aria-label="Notificaciones enviadas"><i class="ti ti-mail"></i> Mensajes${state.unreadCount?`<span class="count">${state.unreadCount}</span>`:''}</button>
        <button onclick="logout()">Cambiar de usuario</button>
      </div>
    </div>`;
}

/* ================= home ================= */
function renderHome() {
  const list = state.diagnosticos;
  let cards = '';
  if (!list.length) {
    cards = `<div class="empty-state"><i class="ti ti-clipboard-plus"></i><p>Todavía no hay diagnósticos cargados.<br>Creá el primero con el botón de arriba.</p></div>`;
  } else {
    cards = list.map(dg => `
      <div class="diag-card" onclick="openDiag(${dg.id})">
        <div class="dc-top">
          <div><div class="dc-name">${dg.finca || 'Sin nombre de finca'}</div>
          <div class="dc-prod">${dg.productor || 'Productor sin cargar'} · ${dg.localidad || 's/localidad'}${dg.cuit?` · CUIT ${dg.cuit}`:''}</div></div>
          <span class="badge ${dg.docStatus}">${STAGE_LABELS[dg.docStatus]}</span>
        </div>
        <div class="meter ${dg.completenessPct===100?'full':''}"><b style="width:${dg.completenessPct}%"></b></div>
        <div class="dc-meta"><div class="dc-date"><i class="ti ti-clock"></i> Últ. actividad: ${nowFmt(dg.updatedAt)}</div>
        <div class="dc-date">${dg.completenessPct}% completo</div></div>
      </div>`).join('');
  }
  const canCreate = state.session.role === 'tecnico';
  return `
    <div class="home-head"><h2>Diagnósticos</h2>
    <div style="display:flex;gap:6px">
    <button class="btn-new" style="background:var(--clay)" onclick="openDashboard()"><i class="ti ti-chart-bar"></i> Panel</button>
    ${canCreate?`<button class="btn-new" onclick="createDiag()"><i class="ti ti-plus"></i> Nuevo</button>`:''}
    </div>
    </div>
    <div class="diag-list">${cards}</div>`;
}
async function createDiag() {
  try {
    const diag = await api('/diagnosticos', { method: 'POST' });
    state.currentId = diag.id; state.currentDiag = diag; state.view = 'detail'; state.activeTab = 'estab';
    render();
  } catch (e) { handleAuthError(e); }
}
async function openDiag(id) {
  try {
    state.currentDiag = await api('/diagnosticos/' + id);
    state.currentId = id; state.view = 'detail'; state.activeTab = 'estab';
    render();
  } catch (e) { handleAuthError(e); }
}
function goHome() { state.view = 'home'; state.currentId = null; state.currentDiag = null; render(); }

/* ================= panel / dashboard agregado ================= */
async function openDashboard() {
  state.view = 'dashboard'; state.dashboardLoading = true; state.dashboardData = null;
  render();
  try {
    state.dashboardData = await api('/dashboard');
  } catch (e) { handleAuthError(e); }
  state.dashboardLoading = false;
  render();
}
function fmtUSD(n) {
  return 'USD ' + Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 });
}
function renderDashboardView() {
  const dash = state.dashboardData;
  let body;
  if (state.dashboardLoading || !dash) {
    body = `<div class="empty-state"><i class="ti ti-loader-2"></i><p>Cargando panel…</p></div>`;
  } else {
    const maxTipo = Math.max(1, ...dash.montoPorTipo.map((t) => t.monto));
    const maxLoc = Math.max(1, ...dash.porLocalidad.map((l) => l.cantidad));
    const barsTipo = dash.montoPorTipo.length ? dash.montoPorTipo.map((t) => `
      <div class="bar-row">
        <div class="bar-top"><span>${t.tipo}</span><span>${fmtUSD(t.monto)}</span></div>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.round((t.monto/maxTipo)*100)}%"></div></div>
      </div>`).join('') : `<div class="hint">Todavía no hay montos en USD cargados en ningún presupuesto.</div>`;
    const barsEstado = dash.porEstado.map((e) => `
      <div class="bar-row">
        <div class="bar-top"><span>${e.label}</span><span>${e.cantidad}</span></div>
        <div class="bar-track"><div class="bar-fill" style="width:${dash.total?Math.round((e.cantidad/dash.total)*100):0}%; background:var(--clay)"></div></div>
      </div>`).join('');
    const listLoc = dash.porLocalidad.length ? `<ul class="check-list">${dash.porLocalidad.map((l) => `
      <li><i class="ti ti-map-pin" style="color:var(--clay)"></i>
        <span>${l.localidad}<br><span style="color:var(--lock);font-size:10.5px">${l.cantidad} diagnóstico(s) · ${fmtUSD(l.monto)}</span></span>
        <span class="badge-pill" style="margin-left:auto;background:var(--clay-light);color:var(--clay)">${l.pct}%</span></li>`).join('')}</ul>` : `<div class="hint">Sin datos de localidad todavía.</div>`;

    const listEstancados = dash.estancados.length ? `<ul class="check-list">${dash.estancados.map((e) => `
      <li class="clickable" onclick="openDiag(${e.id})"><i class="ti ti-clock-exclamation" style="color:var(--danger)"></i>
        <span>${e.nombre}<br><span style="color:var(--lock);font-size:10.5px">${e.etapa}</span></span>
        <span class="badge-pill danger" style="margin-left:auto">${e.diasSinAvanzar} días</span></li>`).join('')}</ul>`
      : `<div class="hint">Ningún diagnóstico lleva más de ${dash.staleDays} días sin avanzar de etapa.</div>`;

    const listIncompletos = dash.incompletos.length ? `<ul class="check-list">${dash.incompletos.map((e) => {
      const nivel = e.pct >= 75 ? 'warn' : 'danger';
      return `<li class="clickable" onclick="openDiag(${e.id})"><i class="ti ti-alert-triangle" style="color:var(--${nivel})"></i>
        <span>${e.nombre}<br><span style="color:var(--lock);font-size:10.5px">${e.etapa}</span></span>
        <span class="badge-pill ${nivel}" style="margin-left:auto">${e.pct}%</span></li>`;
    }).join('')}</ul>` : `<div class="hint">Todos los diagnósticos en curso tienen los datos completos.</div>`;

    const sigi = dash.creditosSigi;
    const listSigi = sigi.matches.length ? `<ul class="check-list">${sigi.matches.map((m) => {
      const pillClass = m.estado === 'Desembolsado' ? 'ok' : m.estado === 'En trámite' ? 'warn' : 'danger';
      return `<li class="clickable" onclick="openDiag(${m.id})"><i class="ti ti-building-bank" style="color:var(--clay)"></i>
        <span>${m.nombre}<br><span style="color:var(--lock);font-size:10.5px">Exp. ${m.expediente||'—'} · ${fmtARS(m.montoARS)}</span></span>
        <span class="badge-pill ${pillClass}" style="margin-left:auto">${m.estado}</span></li>`;
    }).join('')}</ul>` : `<div class="hint">Todavía no hay diagnósticos cruzados con datos de SIGI. Cargá el CUIT en cada diagnóstico e importá el Excel de créditos.</div>`;

    const emb = dash.embudo;
    const maxEmbudo = Math.max(1, emb.totalConsultas);
    const barsEmbudo = [
      { label: 'Consultas totales', val: emb.totalConsultas },
      { label: 'Con diagnóstico técnico', val: emb.conDiagnostico },
      { label: 'Con crédito (SIGI)', val: emb.conCredito }
    ].map((x) => `
      <div class="bar-row">
        <div class="bar-top"><span>${x.label}</span><span>${x.val}</span></div>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.round((x.val/maxEmbudo)*100)}%; background:var(--clay)"></div></div>
      </div>`).join('');
    const listProvincias = emb.porProvincia.length ? `<ul class="check-list">${emb.porProvincia.map((p) => `
      <li><i class="ti ti-map-2" style="color:var(--clay)"></i>
        <span>${p.provincia}<br><span style="color:var(--lock);font-size:10.5px">${p.conDiagnostico} con diagnóstico · ${p.conCredito} con crédito · ${p.desistidos} desistidos</span></span>
        <span class="badge-pill" style="margin-left:auto;background:var(--clay-light);color:var(--clay)">${p.total}</span></li>`).join('')}</ul>`
      : `<div class="hint">Todavía no importaste consultas de ninguna provincia.</div>`;

    body = `
      <div class="stat-grid">
        <div class="stat-card"><div class="stat-value">${dash.total}</div><div class="stat-label">Diagnósticos totales</div></div>
        <div class="stat-card"><div class="stat-value">${dash.aprobados}</div><div class="stat-label">Validados por CFI</div></div>
        <div class="stat-card"><div class="stat-value">${fmtUSD(dash.montoTotalUSD)}</div><div class="stat-label">Monto total solicitado</div></div>
        <div class="stat-card"><div class="stat-value">${dash.tiempoPromedioDias!=null?dash.tiempoPromedioDias+' días':'—'}</div><div class="stat-label">Tiempo promedio de aprobación</div></div>
      </div>
      <div class="section-card">
        <div class="section-title"><i class="ti ti-filter"></i> Embudo del programa <span class="hint" style="margin-left:4px">consulta → diagnóstico → crédito</span></div>
        ${state.session.role==='cfi' ? `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap">
          <input type="text" id="consultaProvinciaInput" placeholder="Provincia (ej: Río Negro)" style="max-width:180px">
          <input type="file" id="consultaImportInput" accept=".xlsx,.xls,.csv" style="display:none" onchange="importConsultasExcel(this)">
          <button class="btn-new" style="background:var(--clay)" onclick="triggerConsultaImport()"><i class="ti ti-upload"></i> Importar consultas</button>
          <span class="hint">${emb.totalConsultas} consulta(s) cargadas hasta ahora.</span>
        </div>` : ''}
        ${barsEmbudo}
        <div class="stat-grid" style="padding:12px 0 4px">
          <div class="stat-card"><div class="stat-value">${emb.enTramite}</div><div class="stat-label">En trámite</div></div>
          <div class="stat-card"><div class="stat-value">${emb.desembolsadas}</div><div class="stat-label">Desembolsadas</div></div>
          <div class="stat-card"><div class="stat-value">${emb.desistidas}</div><div class="stat-label">Desistidas</div></div>
        </div>
        <div class="section-title" style="margin-top:8px"><i class="ti ti-map"></i> Por provincia</div>
        ${listProvincias}
        <div class="hint" style="margin-top:6px">Solo aparecen las provincias cuyo listado de consultas ya importaste. Las demás van a sumarse cuando importes su Excel.</div>
      </div>
      <div class="section-card">
        <div class="section-title"><i class="ti ti-stack-2"></i> Diagnósticos por etapa</div>
        ${barsEstado}
      </div>
      <div class="section-card">
        <div class="section-title"><i class="ti ti-sun"></i> Monto solicitado por tipo de inversión</div>
        ${barsTipo}
        ${dash.itemsSinCategorizar?`<div class="hint" style="margin-top:6px">${dash.itemsSinCategorizar} ítem(s) de presupuesto sin tipo de inversión asignado — completalo en la pestaña Propuesta de cada diagnóstico.</div>`:''}
      </div>
      <div class="section-card">
        <div class="section-title"><i class="ti ti-map"></i> Distribución por localidad</div>
        ${listLoc}
      </div>
      <div class="section-card">
        <div class="section-title"><i class="ti ti-clock-exclamation"></i> Diagnósticos demorados <span class="hint" style="margin-left:4px">(más de ${dash.staleDays} días sin avanzar)</span></div>
        ${listEstancados}
      </div>
      <div class="section-card">
        <div class="section-title"><i class="ti ti-checklist"></i> % completado</div>
        ${listIncompletos}
      </div>
      <div class="section-card">
        <div class="section-title"><i class="ti ti-building-bank"></i> Cruce con créditos SIGI</div>
        ${state.session.role==='cfi' ? `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
          <input type="file" id="sigiImportInput" accept=".xlsx,.xls" style="display:none" onchange="importSigiExcel(this)">
          <button class="btn-new" style="background:var(--clay)" onclick="document.getElementById('sigiImportInput').click()"><i class="ti ti-upload"></i> Importar Excel de créditos</button>
          <span class="hint">${sigi.totalImportados} registro(s) importados hasta ahora.</span>
        </div>` : ''}
        <div class="stat-grid" style="padding:0 0 12px">
          <div class="stat-card"><div class="stat-value">${sigi.desembolsados}</div><div class="stat-label">Desembolsados</div></div>
          <div class="stat-card"><div class="stat-value">${sigi.enTramite}</div><div class="stat-label">En trámite</div></div>
          <div class="stat-card"><div class="stat-value">${fmtARS(sigi.montoDesembolsadoARS)}</div><div class="stat-label">Monto desembolsado</div></div>
          <div class="stat-card"><div class="stat-value">${fmtARS(sigi.montoEnTramiteARS)}</div><div class="stat-label">Monto en trámite</div></div>
        </div>
        ${listSigi}
        ${sigi.sinCuit?`<div class="hint" style="margin-top:6px">${sigi.sinCuit} diagnóstico(s) sin CUIT cargado — completalo en la pestaña Establecimiento para poder cruzarlo.</div>`:''}
      </div>`;
  }
  return `
    <div class="detail-bar">
      <button class="back" onclick="goHome()" aria-label="Volver"><i class="ti ti-arrow-left"></i> Volver</button>
      <div style="flex:1"><div class="db-name">Panel del programa</div>
      <div class="db-sub">Resumen agregado de todos los diagnósticos</div></div>
      ${state.dashboardData ? `<button class="back" onclick="exportDashboardExcel()" aria-label="Exportar Excel" title="Exportar Excel"><i class="ti ti-download"></i> Exportar Excel</button>` : ''}
    </div>
    <div class="content">${body}</div>`;
}
function fmtARS(n) {
  return '$ ' + Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 });
}
function triggerConsultaImport() {
  const prov = document.getElementById('consultaProvinciaInput').value.trim();
  if (!prov) { showToast('Escribí primero la provincia de este listado', true); return; }
  document.getElementById('consultaImportInput').click();
}
async function importConsultasExcel(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  const provincia = document.getElementById('consultaProvinciaInput').value.trim();
  if (!provincia) { showToast('Escribí primero la provincia de este listado', true); input.value = ''; return; }
  const fd = new FormData();
  fd.append('archivo', file);
  fd.append('provincia', provincia);
  try {
    const r = await api('/consultas/import', { method: 'POST', body: fd });
    showToast(`Importadas ${r.importados} de ${r.totalFilas} consulta(s) de ${r.provincia}${r.sinCuit?` (${r.sinCuit} sin CUIT, se ignoraron)`:''}.`);
    await openDashboard();
  } catch (e) {
    showToast(e.message || 'Error al importar el Excel', true);
  }
  input.value = '';
}
async function importSigiExcel(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  const fd = new FormData();
  fd.append('archivo', file);
  try {
    const r = await api('/creditos-sigi/import', { method: 'POST', body: fd });
    showToast(`Importados ${r.importados} de ${r.totalFilas} registro(s)${r.sinCuit?` (${r.sinCuit} sin CUIT, se ignoraron)`:''}.`);
    await openDashboard();
  } catch (e) {
    showToast(e.message || 'Error al importar el Excel', true);
  }
  input.value = '';
}
async function exportDashboardExcel() {
  try {
    const res = await fetch('/api/dashboard/export', {
      headers: state.token ? { Authorization: 'Bearer ' + state.token } : {}
    });
    if (!res.ok) {
      let msg = 'Error al generar el Excel';
      try { msg = (await res.json()).error || msg; } catch (e) { /* sin cuerpo */ }
      throw new Error(msg);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'panel-riego-' + new Date().toISOString().slice(0, 10) + '.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (e) {
    showToast(e.message || 'Error al exportar el Excel', true);
  }
}
async function refreshCurrentDiag() {
  state.currentDiag = await api('/diagnosticos/' + state.currentId);
}

function cur() { return state.currentDiag; }
function canEdit() {
  const d = cur();
  return !!(d && state.session && state.session.role === 'tecnico' && d.docStatus === 'borrador');
}

/* ================= detail ================= */
function renderDetail() {
  const dg = cur(); if (!dg) return '';
  const idx = STAGES.indexOf(dg.docStatus);
  const stepLabels = ['Diagnóstico','Firma técnico','Firma provincia','Firma CFI'];
  let stepper = '';
  stepLabels.forEach((lbl, i) => {
    let cls = 'step';
    if (i < idx || (i === 0 && idx >= 1)) cls += ' done'; else if (i === idx) cls += ' current';
    stepper += `<div class="${cls}"><div class="dot">${(i<idx||(i===0&&idx>=1))?'<i class="ti ti-check"></i>':i+1}</div><div class="lbl">${lbl}</div></div>`;
    if (i < stepLabels.length - 1) stepper += `<div class="step-line"></div>`;
  });
  const c = dg.completeness;
  const tabBtns = TABS.map(([id, l]) => {
    const secState = c.secs[id] ? c.secs[id].state : null;
    const tick = secState ? `<span class="tick ${secState==='ok'?'ok':secState==='part'?'part':''}"></span>` : '';
    return `<button class="${state.activeTab===id?'active':''}" onclick="setTab('${id}')">${l}${tick}</button>`;
  }).join('');
  return `
    <div class="detail-bar">
      <button class="back" onclick="goHome()" aria-label="Volver"><i class="ti ti-arrow-left"></i> Volver</button>
      <div><div class="db-name">${dg.data.finca||'Diagnóstico sin nombre'}</div>
      <div class="db-sub">${dg.data.productor||'Productor sin cargar'}</div></div>
    </div>
    <div class="status-strip"><i class="ti ti-file-certificate"></i> ${STAGE_LABELS[dg.docStatus]} · etapa ${idx+1} de 4 · ${c.pct}% completo</div>
    <div class="stepper">${stepper}</div>
    <div class="tabs">${tabBtns}</div>
    <div class="content" id="tabContent">${renderTabContent(dg)}</div>`;
}
function setTab(t) { state.activeTab = t; render(); }
function navTo(offset) {
  const ids = TABS.map(t=>t[0]);
  const i = ids.indexOf(state.activeTab);
  const next = ids[i+offset];
  if (next) { state.activeTab = next; render(); window.scrollTo(0,0); }
}
function navRow() {
  const ids = TABS.map(t=>t[0]);
  const i = ids.indexOf(state.activeTab);
  const prev = i>0 ? `<button class="nav-btn" onclick="navTo(-1)"><i class="ti ti-chevron-left"></i> ${TABS[i-1][1]}</button>` : '<span></span>';
  const next = i<ids.length-1 ? `<button class="nav-btn primary" onclick="navTo(1)">${TABS[i+1][1]} <i class="ti ti-chevron-right"></i></button>` : '';
  return `<div class="nav-row">${prev}${next}</div>`;
}

/* ================= autosave de campos ================= */
let saveTimer = null;
let savePending = false;
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, 500);
}
async function flushSave() {
  if (!canEdit()) return;
  savePending = true;
  try {
    const updated = await api('/diagnosticos/' + state.currentId + '/data', { method: 'PUT', body: JSON.stringify({ data: cur().data }) });
    state.currentDiag = updated;
    showToast('Borrador guardado');
  } catch (e) {
    showToast('Error al guardar', true);
  } finally { savePending = false; }
}

function lockedBanner(dg) {
  let html = '';
  if (dg.rejection) {
    html += `<div class="rejection-banner"><strong><i class="ti ti-arrow-back-up"></i> Devuelto por ${dg.rejection.label}</strong>Motivo: ${dg.rejection.motivo}</div>`;
  }
  if (!canEdit()) html += `<div class="locked-banner"><i class="ti ti-lock"></i> Campos bloqueados — ya firmados o no corresponde a tu rol.</div>`;
  return html;
}
function chip(cv, value, label, key) {
  const sel = cv === value; const ed = canEdit();
  return `<div class="chip ${sel?'selected':''} ${ed?'':'disabled'}" ${ed?`onclick="setChip('${key}','${value}')"`:''}>${label}</div>`;
}
function setChip(key, val) { if (!canEdit()) return; cur().data[key] = val; flushSave(); render(); }
function setField(key, val) { if (!canEdit()) return; cur().data[key] = val; scheduleSave(); }
// Al elegir Gravitacional/Presurizado, los sistemas presentes que ya no
// corresponden a esa familia se sacan de la selección (ej: si tenía "Surcos"
// marcado y pasa a Presurizado, "Surcos" deja de estar disponible).
function setTipoRiegoGeneral(val) {
  if (!canEdit()) return;
  const d = cur().data;
  d.tipoRiegoGeneral = val;
  const permitidos = val === 'Gravitacional' ? ['Surcos', 'Melgas', 'Otro'] : ['Goteo', 'Aspersión', 'Otro'];
  d.sistemasPresentes = (d.sistemasPresentes || []).filter(s => permitidos.includes(s));
  flushSave(); render();
}
function toggleArr(key, val) {
  if (!canEdit()) return;
  // Diagnósticos creados antes de agregar un campo nuevo no tienen esa clave
  // en su "data" guardada — sin este resguardo, tocar el chip no hacía nada
  // (el .indexOf de un array undefined tira error y corta el click en silencio).
  if (!Array.isArray(cur().data[key])) cur().data[key] = [];
  const arr = cur().data[key]; const i = arr.indexOf(val);
  if (i>=0) arr.splice(i,1); else arr.push(val);
  flushSave(); render();
}
function addCultivo() { if (!canEdit()) return; cur().data.cultivos.push({cultivo:'',variedad:'',destino:'',anio:'',marco:'',superficie:'',rendimiento:'',rendimientoUnidad:''}); flushSave(); render(); }
function removeCultivo(i) { if (!canEdit()) return; cur().data.cultivos.splice(i,1); flushSave(); render(); }
function setCultivo(i, key, val) { if (!canEdit()) return; cur().data.cultivos[i][key] = val; scheduleSave(); }
function addPresupuesto() { if (!canEdit()) return; cur().data.presupuesto.push({inversion:'',codN1:'',codN2:'',tipo:'',monto:'',montoUSD:''}); flushSave(); render(); }
function removePresupuesto(i) { if (!canEdit()) return; cur().data.presupuesto.splice(i,1); flushSave(); render(); }
function setPresupuesto(i, key, val) { if (!canEdit()) return; cur().data.presupuesto[i][key] = val; scheduleSave(); }
// Categoría (nivel 1) del nomenclador CFI: al cambiarla, se resetea la
// subcategoría (nivel 2, depende de la categoría) y se guarda una etiqueta
// legible en "tipo" — así el panel sigue agrupando montos sin tocar su lógica.
function setPresupuestoCat1(i, val) {
  if (!canEdit()) return;
  const p = cur().data.presupuesto[i];
  const cat = NOMENCLADOR.find(c => c.n1 === val);
  p.codN1 = val;
  p.codN2 = '';
  p.tipo = cat ? (cat.n1 + ' — ' + cat.label) : '';
  flushSave(); render();
}
function setPresupuestoCat2(i, val) {
  if (!canEdit()) return;
  cur().data.presupuesto[i].codN2 = val;
  flushSave();
}

/* ================= geolocalización real (best-effort) ================= */
function getGeo() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve('Sin geolocalización (no soportada por el navegador)');
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(`Lat ${pos.coords.latitude.toFixed(4)}, Long ${pos.coords.longitude.toFixed(4)}`),
      () => resolve('Sin geolocalización (permiso denegado)'),
      { timeout: 4000 }
    );
  });
}

/* ================= fotos (subida real) ================= */
async function onPhotoSelected(slotIndex, input) {
  const file = input.files && input.files[0];
  if (!file || !canEdit()) return;
  const slot = document.querySelector(`.photo-slot[data-slot="${slotIndex}"]`);
  if (slot) slot.classList.add('uploading');
  const geoStr = await getGeo();
  let lat = '', lng = '';
  const m = geoStr.match(/Lat ([\-0-9.]+), Long ([\-0-9.]+)/);
  if (m) { lat = m[1]; lng = m[2]; }
  const fd = new FormData();
  fd.append('foto', file);
  fd.append('lat', lat); fd.append('lng', lng);
  try {
    await api(`/diagnosticos/${state.currentId}/fotos/${slotIndex}`, { method: 'POST', body: fd });
    await refreshCurrentDiag();
    showToast('Foto cargada');
  } catch (e) {
    showToast(e.message || 'Error al subir la foto', true);
  }
  render();
}
async function removePhoto(slotIndex, ev) {
  ev.stopPropagation();
  if (!canEdit()) return;
  try {
    await api(`/diagnosticos/${state.currentId}/fotos/${slotIndex}`, { method: 'DELETE' });
    await refreshCurrentDiag();
  } catch (e) { showToast(e.message || 'Error al borrar la foto', true); }
  render();
}

/* ================= documento de análisis de suelo (subida real) ================= */
async function onSueloDocSelected(input) {
  const file = input.files && input.files[0];
  if (!file || !canEdit()) return;
  const fd = new FormData();
  fd.append('archivo', file);
  try {
    await api(`/diagnosticos/${state.currentId}/documento-suelo`, { method: 'POST', body: fd });
    await refreshCurrentDiag();
    showToast('Análisis de suelo cargado');
  } catch (e) {
    showToast(e.message || 'Error al subir el archivo', true);
  }
  render();
}
async function removeSueloDoc() {
  if (!canEdit()) return;
  try {
    await api(`/diagnosticos/${state.currentId}/documento-suelo`, { method: 'DELETE' });
    await refreshCurrentDiag();
  } catch (e) { showToast(e.message || 'Error al borrar el archivo', true); }
  render();
}

function renderTabContent(dg) {
  const t = state.activeTab; const d = dg.data;
  const dis = canEdit() ? '' : 'disabled';

  if (t === 'estab') return `
    ${lockedBanner(dg)}
    <div class="section-card">
      <div class="section-title"><i class="ti ti-id"></i> Datos generales del productor y la finca</div>
      <div class="field-group"><label>Nombre y apellido del productor <span class="req">*</span></label><input type="text" value="${d.productor}" ${dis} oninput="setField('productor',this.value)"></div>
      <div class="field-group"><label>Nombre de la finca <span class="req">*</span></label><input type="text" value="${d.finca}" ${dis} oninput="setField('finca',this.value)"></div>
      <div class="row2">
        <div class="field-group"><label>RENSPA / RUT</label><input type="text" value="${d.renspa}" ${dis} oninput="setField('renspa',this.value)"></div>
        <div class="field-group"><label>Localidad/Departamento <span class="req">*</span></label><input type="text" value="${d.localidad}" ${dis} oninput="setField('localidad',this.value)"></div>
      </div>
      <div class="row2">
        <div class="field-group"><label>CUIT</label><input type="text" value="${d.cuit||''}" ${dis} placeholder="30-XXXXXXXX-X" oninput="setField('cuit',this.value)">
          <div class="hint">Para cruzar este diagnóstico con la carga de provincia y el crédito en SIGI.</div>
        </div>
        <div class="field-group"><label>N.° de expediente SIGI</label><input type="text" value="${d.expedienteSigi||''}" ${dis} placeholder="2025-CR-MZ-002426 (si ya existe)" oninput="setField('expedienteSigi',this.value)"></div>
      </div>
      <div class="row2">
        <div class="field-group"><label>Superficie total (ha) <span class="req">*</span></label><input type="number" value="${d.superficieTotal}" ${dis} oninput="setField('superficieTotal',this.value)"></div>
        <div class="field-group"><label>Superficie cultivada (ha)</label><input type="number" value="${d.superficieCultivada}" ${dis} oninput="setField('superficieCultivada',this.value)"></div>
      </div>
      <div class="row2">
        <div class="field-group"><label>Superficie inculta (ha)</label><input type="number" value="${d.superficieInculta}" ${dis} oninput="setField('superficieInculta',this.value)"></div>
        <div class="field-group"><label>Sup. con derecho de riego (ha)</label><input type="number" value="${d.superficieDerecho}" ${dis} oninput="setField('superficieDerecho',this.value)"></div>
      </div>
      <div class="field-group"><label>Fuente de agua de la superficie con derecho de riego</label>
        <select ${dis} onchange="setField('fuenteRiegoDerecho',this.value)" style="width:100%;max-width:280px;padding:8px 10px;border:1px solid var(--border);border-radius:8px;font-size:12.5px;font-family:inherit">
          <option value="">Sin especificar</option>
          ${FUENTES_RIEGO_DERECHO.map(f=>`<option value="${f}" ${d.fuenteRiegoDerecho===f?'selected':''}>${f}</option>`).join('')}
        </select></div>
      <div class="field-group"><label>Identificación del padrón</label><input type="text" value="${d.ccpp}" ${dis} placeholder="Ej: Fracción 1) PP 9900 CC 247: 34,6 ha" oninput="setField('ccpp',this.value)"></div>
      <div class="field-group"><label>Identificación de pozos</label><input type="text" value="${d.pozos}" ${dis} placeholder="Ej: 2 pozos: 14.392 y 14.390" oninput="setField('pozos',this.value)"></div>
      <div class="field-group"><label>Observaciones</label><textarea ${dis} oninput="setField('obsGenerales',this.value)">${d.obsGenerales}</textarea></div>
    </div>${navRow()}`;

  if (t === 'cultivos') { const selStyleCv = 'width:100%;min-width:130px;padding:6px 7px;border:1px solid var(--border);border-radius:6px;font-size:11.5px;font-family:inherit'; return `
    ${lockedBanner(dg)}
    <div class="section-title" style="margin-bottom:10px"><i class="ti ti-plant-2"></i> Datos del cultivo</div>
    <div class="table-scroll"><table class="dyn-table">
      <thead><tr><th>Cultivo</th><th>Variedad</th><th>Destino</th><th>Año Plant./Siembra</th><th>Marco de plantación/Densidad de siembra</th><th>Sup. (ha)</th><th>Rendimiento</th><th></th></tr></thead>
      <tbody>${d.cultivos.map((cv,i)=>`<tr>
        <td><input type="text" value="${cv.cultivo}" ${dis} onchange="setCultivo(${i},'cultivo',this.value)"></td>
        <td><input type="text" value="${cv.variedad}" ${dis} onchange="setCultivo(${i},'variedad',this.value)"></td>
        <td><select ${dis} onchange="setCultivo(${i},'destino',this.value)" style="${selStyleCv}">
          <option value="">Elegir…</option>
          ${DESTINOS_CULTIVO.map(o=>`<option value="${o}" ${cv.destino===o?'selected':''}>${o}</option>`).join('')}
        </select></td>
        <td><input type="text" value="${cv.anio}" ${dis} onchange="setCultivo(${i},'anio',this.value)"></td>
        <td><input type="text" value="${cv.marco}" ${dis} onchange="setCultivo(${i},'marco',this.value)"></td>
        <td><input type="text" value="${cv.superficie}" ${dis} onchange="setCultivo(${i},'superficie',this.value)"></td>
        <td style="display:flex;gap:4px;flex-wrap:wrap">
          <input type="number" value="${cv.rendimiento}" ${dis} placeholder="Valor" style="width:70px" onchange="setCultivo(${i},'rendimiento',this.value)">
          <select ${dis} onchange="setCultivo(${i},'rendimientoUnidad',this.value)" style="${selStyleCv};min-width:100px">
            <option value="">Unidad…</option>
            ${RENDIMIENTO_UNIDADES.map(u=>`<option value="${u}" ${cv.rendimientoUnidad===u?'selected':''}>${u}</option>`).join('')}
          </select>
        </td>
        <td class="row-remove">${canEdit()&&d.cultivos.length>1?`<button onclick="removeCultivo(${i})" aria-label="Quitar"><i class="ti ti-x"></i></button>`:''}</td>
      </tr>`).join('')}</tbody>
    </table></div>
    <button class="add-row-btn" ${canEdit()?'':'disabled'} onclick="addCultivo()"><i class="ti ti-plus"></i> Agregar cultivo</button>
    <div class="field-group"><label>Observaciones</label><textarea ${dis} oninput="setField('obsCultivos',this.value)">${d.obsCultivos}</textarea></div>

    <div class="section-title" style="margin:18px 0 10px"><i class="ti ti-tractor"></i> Producción</div>
    <div class="field-group"><label>Tipo de producción</label>
      <div class="chip-group">${chip(d.tipoProduccion,'Agricultura','Agricultura','tipoProduccion')}${chip(d.tipoProduccion,'Ganadería','Ganadería','tipoProduccion')}</div></div>
    ${d.tipoProduccion==='Ganadería'?`
    <div class="row2">
      <div class="field-group"><label>Animales (tipo)</label><input type="text" value="${d.ganaderiaAnimalTipo||''}" ${dis} placeholder="Ej: Bovinos, caprinos" oninput="setField('ganaderiaAnimalTipo',this.value)"></div>
      <div class="field-group"><label>Cantidad de cabezas</label><input type="number" value="${d.ganaderiaCabezas||''}" ${dis} oninput="setField('ganaderiaCabezas',this.value)"></div>
    </div>
    <div class="field-group"><label>Actividad</label>
      <div class="chip-group">${ACTIVIDAD_GANADERA.map(a=>chip(d.ganaderiaActividad,a,a,'ganaderiaActividad')).join('')}</div></div>
    <div class="field-group"><label>Categorías</label>
      <div class="chip-group">${CATEGORIAS_GANADERAS.map(c=>`<div class="chip ${(d.ganaderiaCategorias||[]).includes(c)?'selected':''} ${canEdit()?'':'disabled'}" ${canEdit()?`onclick="toggleArr('ganaderiaCategorias','${c}')"`:''}>${c}</div>`).join('')}</div></div>
    `:''}
    ${navRow()}`; }

  if (t === 'suelo') { const archivo = d.analisisSueloArchivo; return `
    ${lockedBanner(dg)}
    <div class="section-card">
      <div class="section-title"><i class="ti ti-mountain"></i> Datos del suelo</div>
      <div class="field-group"><label>Análisis del suelo</label>
        <div class="chip-group">${chip(d.analisisSuelo,'Posee','Posee','analisisSuelo')}${chip(d.analisisSuelo,'No posee','No posee','analisisSuelo')}</div></div>

      ${d.analisisSuelo==='Posee'?`
      <div class="field-group"><label>Documento del análisis</label>
        ${archivo?`
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <a href="${archivo.url}" target="_blank" rel="noopener"><i class="ti ti-file-text"></i> ${archivo.originalName||'Ver archivo'}</a>
          ${canEdit()?`<button class="mail-btn" onclick="removeSueloDoc()" type="button">Quitar</button>`:''}
        </div>` : `
        <input type="file" accept="image/*,.pdf" ${dis} onchange="onSueloDocSelected(this)">
        <div class="hint">Subí el PDF o la foto del análisis de laboratorio.</div>`}
      </div>` : ''}

      <div class="field-group"><label>Textura ${d.analisisSuelo!=='Posee'?'(estimada)':''} <span class="req">*</span></label>
        <select ${dis} onchange="setField('textura',this.value)" style="width:100%;max-width:320px;padding:8px 10px;border:1px solid var(--border);border-radius:8px;font-size:12.5px;font-family:inherit">
          <option value="">Elegir textura…</option>
          ${TEXTURAS_SUELO.map(t2=>`<option value="${t2}" ${d.textura===t2?'selected':''}>${t2}</option>`).join('')}
        </select>
      </div>

      ${d.analisisSuelo==='No posee'?`
      <div class="rejection-banner" style="background:var(--clay-light);border-color:var(--clay);color:var(--ink)">
        <strong><i class="ti ti-bulb"></i> Recomendación</strong>
        Sin un análisis de laboratorio conviene: 1) tomar muestras representativas del lote antes de definir el sistema de riego; 2) medir como mínimo textura, salinidad (CE) y materia orgánica; 3) confirmar la textura estimada a campo con un análisis, ya que condiciona el diseño del riego; 4) recurrir a un laboratorio acreditado de la zona.
      </div>` : ''}

      <div class="field-group"><label>Principales problemas de suelo observados</label>
        <textarea ${dis} oninput="setField('problemasSuelo',this.value)">${d.problemasSuelo}</textarea></div>
      <div class="field-group"><label>Otras observaciones del suelo</label>
        <textarea ${dis} oninput="setField('obsSuelo',this.value)">${d.obsSuelo}</textarea></div>

      <div class="subsection-title">¿Requiere análisis previo?</div>
      <div class="field-group"><label>&nbsp;</label>
        <div class="chip-group">${chip(d.requiereAnalisisPrevio,'Sí','Sí','requiereAnalisisPrevio')}${chip(d.requiereAnalisisPrevio,'No','No','requiereAnalisisPrevio')}</div></div>
      ${d.requiereAnalisisPrevio==='Sí'?`
      <div class="field-group"><label>¿De qué?</label>
        <div class="chip-group">${ANALISIS_PREVIO_ITEMS.map(it=>`<div class="chip ${(d.requiereAnalisisPrevioQue||[]).includes(it)?'selected':''} ${canEdit()?'':'disabled'}" ${canEdit()?`onclick="toggleArr('requiereAnalisisPrevioQue','${it}')"`:''}>${it}</div>`).join('')}</div></div>
      ${(d.requiereAnalisisPrevioQue||[]).length?`
      <div class="rejection-banner" style="background:var(--clay-light);border-color:var(--clay);color:var(--ink)">
        <strong><i class="ti ti-alert-triangle"></i> Recomendación</strong>
        Se sugiere completar un análisis de ${(d.requiereAnalisisPrevioQue||[]).join(', ').toLowerCase()} antes de avanzar con el diagnóstico, para no comprometer el diseño de la propuesta de mejora.
      </div>`:''}
      `: d.requiereAnalisisPrevio==='No' ? `
      <div class="hint">No se identificó la necesidad de un análisis previo adicional — se puede avanzar con el diagnóstico.</div>` : ''}
    </div>${navRow()}`; }

  if (t === 'riego') {
    const showSuperficial = d.sistemasPresentes.some(s => ['Surcos','Melgas'].includes(s));
    const showPresurizado = d.sistemasPresentes.some(s => ['Goteo','Aspersión'].includes(s));
    return `
    ${lockedBanner(dg)}
    <div class="section-card">
      <div class="section-title"><i class="ti ti-droplet-filled"></i> Sistema de riego</div>
      <div class="subsection-title">Tipo de riego</div>
      <div class="field-group"><label>¿El riego es gravitacional o presurizado?</label>
        <div class="chip-group">
          <div class="chip ${d.tipoRiegoGeneral==='Gravitacional'?'selected':''} ${canEdit()?'':'disabled'}" ${canEdit()?`onclick="setTipoRiegoGeneral('Gravitacional')"`:''}>Gravitacional</div>
          <div class="chip ${d.tipoRiegoGeneral==='Presurizado'?'selected':''} ${canEdit()?'':'disabled'}" ${canEdit()?`onclick="setTipoRiegoGeneral('Presurizado')"`:''}>Presurizado</div>
        </div></div>

      ${d.tipoRiegoGeneral || (d.sistemasPresentes||[]).length ? `
      <div class="subsection-title">Sistemas presentes en la finca</div>
      <div class="chip-group">${(d.tipoRiegoGeneral==='Gravitacional'?['Surcos','Melgas','Otro']:d.tipoRiegoGeneral==='Presurizado'?['Goteo','Aspersión','Otro']:['Surcos','Melgas','Goteo','Aspersión','Otro']).map(v=>`<div class="chip ${d.sistemasPresentes.includes(v)?'selected':''} ${canEdit()?'':'disabled'}" ${canEdit()?`onclick="toggleArr('sistemasPresentes','${v}')"`:''}>${v}</div>`).join('')}</div>
      ${d.sistemasPresentes.includes('Otro')?`<div class="field-group"><label>Detalle "Otro"</label><input type="text" value="${d.otroSistemaTexto}" ${dis} oninput="setField('otroSistemaTexto',this.value)"></div>`:''}
      ${(!showSuperficial && !showPresurizado)?`<div class="hint" style="margin:4px 0 2px">Marcá al menos un sistema arriba para ver sus campos de detalle.</div>`:''}
      ` : `<div class="hint" style="margin:4px 0 2px">Elegí primero si el riego es gravitacional o presurizado.</div>`}

      ${showSuperficial?`
      <div class="subsection-title">Riego superficial (surcos/melgas)</div>
      <div class="field-group"><label>Fuente de agua</label>
        <div class="chip-group">${chip(d.rsFuente,'Turno','Turno','rsFuente')}${chip(d.rsFuente,'Pozo','Pozo','rsFuente')}</div></div>
      <div class="row2">
        <div class="field-group"><label>Superficie regada (ha)</label><input type="text" value="${d.rsSuperficie}" ${dis} oninput="setField('rsSuperficie',this.value)"></div>
        <div class="field-group"><label>Caudal medio (l/s)</label><input type="text" value="${d.rsCaudal}" ${dis} oninput="setField('rsCaudal',this.value)"></div>
      </div>
      <div class="row2">
        <div class="field-group"><label>Frecuencia turnado (días)</label><input type="text" value="${d.rsFrecTurnado}" ${dis} oninput="setField('rsFrecTurnado',this.value)"></div>
        <div class="field-group"><label>Duración turnado (hs)</label><input type="text" value="${d.rsDuracionTurnado}" ${dis} oninput="setField('rsDuracionTurnado',this.value)"></div>
      </div>
      <div class="field-group"><label>Turnos por temporada</label><input type="text" value="${d.rsCantTurnos}" ${dis} oninput="setField('rsCantTurnos',this.value)"></div>
      <div class="field-group"><label>Infraestructura de riego</label><textarea ${dis} oninput="setField('rsInfraestructura',this.value)">${d.rsInfraestructura}</textarea></div>
      <div class="field-group"><label>Principales problemas y limitantes</label><textarea ${dis} oninput="setField('rsProblemas',this.value)">${d.rsProblemas}</textarea></div>
      <div class="field-group"><label>Observaciones</label><textarea ${dis} oninput="setField('rsObservaciones',this.value)">${d.rsObservaciones}</textarea></div>
      `:''}

      ${showPresurizado?`
      <div class="subsection-title">Riego presurizado (goteo/aspersión)</div>
      <div class="field-group"><label>Fuente de agua</label>
        <div class="chip-group">${chip(d.rpFuente,'Turno','Turno','rpFuente')}${chip(d.rpFuente,'Pozo','Pozo','rpFuente')}</div></div>
      <div class="row2">
        <div class="field-group"><label>Superficie regada (ha)</label><input type="text" value="${d.rpSuperficie}" ${dis} oninput="setField('rpSuperficie',this.value)"></div>
        <div class="field-group"><label>Caudal medio (l/h)</label><input type="text" value="${d.rpCaudal}" ${dis} oninput="setField('rpCaudal',this.value)"></div>
      </div>
      <div class="row2">
        <div class="field-group"><label>Frecuencia por operación (días)</label><input type="text" value="${d.rpFrecuencia}" ${dis} oninput="setField('rpFrecuencia',this.value)"></div>
        <div class="field-group"><label>Duración por operación (hs)</label><input type="text" value="${d.rpDuracion}" ${dis} oninput="setField('rpDuracion',this.value)"></div>
      </div>
      <div class="field-group"><label>Principales problemas y limitantes</label><textarea ${dis} oninput="setField('rpProblemas',this.value)">${d.rpProblemas}</textarea></div>
      <div class="field-group"><label>Observaciones</label><textarea ${dis} oninput="setField('rpObservaciones',this.value)">${d.rpObservaciones}</textarea></div>
      `:''}

      <div class="subsection-title">Infraestructura y manejo</div>
      <div class="field-group"><label>Represa</label>
        <div class="chip-group">${chip(d.represa,'Posee','Posee','represa')}${chip(d.represa,'No posee','No posee','represa')}</div></div>
      ${d.represa==='Posee'?`<div class="field-group"><label>Volumen (m³)</label><input type="text" value="${d.volumenRepresa}" ${dis} oninput="setField('volumenRepresa',this.value)"></div>`:''}
      <div class="field-group"><label>Medición de caudales</label>
        <div class="chip-group">${chip(d.medicionCaudales,'Realiza','Realiza','medicionCaudales')}${chip(d.medicionCaudales,'No realiza','No realiza','medicionCaudales')}</div></div>
      ${d.medicionCaudales==='Realiza'?`<div class="field-group"><label>Método</label><input type="text" value="${d.metodoMedicion}" ${dis} placeholder="Ej: caudalímetro" oninput="setField('metodoMedicion',this.value)"></div>`:''}
      <div class="field-group"><label>Asistencia técnica agronómica</label>
        <div class="chip-group">${chip(d.asistenciaTecnica,'Posee','Posee','asistenciaTecnica')}${chip(d.asistenciaTecnica,'No posee','No posee','asistenciaTecnica')}</div></div>
      <div class="field-group"><label>Personal dedicado a tareas de riego</label>
        <div class="chip-group">${['Empleado','Operario al día/jornalero','Contratista o chacarero','Propietario/familiar'].map(v=>`<div class="chip ${d.personalRiego.includes(v)?'selected':''} ${canEdit()?'':'disabled'}" ${canEdit()?`onclick="toggleArr('personalRiego','${v}')"`:''}>${v}</div>`).join('')}</div></div>
      <div class="field-group"><label>Otras observaciones del riego</label><textarea ${dis} oninput="setField('obsRiego',this.value)">${d.obsRiego}</textarea></div>
    </div>${navRow()}`;
  }

  if (t === 'propuesta') return `
    ${lockedBanner(dg)}
    <div class="section-card">
      <div class="section-title"><i class="ti ti-tools"></i> Propuesta de mejora</div>
      <div class="field-group"><label>1. Descripción técnica de la mejora <span class="req">*</span></label><textarea ${dis} oninput="setField('descripcionMejora',this.value)">${d.descripcionMejora}</textarea></div>
      <div class="field-group"><label>2. Objetivos específicos</label><textarea ${dis} oninput="setField('objetivosMejora',this.value)">${d.objetivosMejora}</textarea></div>
      <div class="field-group"><label>3. Materiales e insumos requeridos <span class="req">*</span></label><textarea ${dis} placeholder="Un ítem por línea" oninput="setField('materialesMejora',this.value)">${d.materialesMejora}</textarea>
        <div class="hint">Un ítem por línea — se usan como viñetas en la Conformidad Técnica.</div></div>
      <div class="field-group"><label>4. Indicadores de mejora <span class="req">*</span></label><textarea ${dis} placeholder="Un indicador por línea" oninput="setField('indicadoresMejora',this.value)">${d.indicadoresMejora}</textarea></div>
      <div class="field-group"><label>5. Cronograma y plazos</label><textarea ${dis} placeholder="Etapas: adquisición, instalación, calibración, capacitación" oninput="setField('cronogramaEtapas',this.value)">${d.cronogramaEtapas}</textarea></div>
      <div class="field-group"><label>Tiempo estimado total (meses) <span class="req">*</span></label><input type="number" value="${d.tiempoTotalMeses}" ${dis} oninput="setField('tiempoTotalMeses',this.value)"></div>
      <div class="subsection-title">6. Presupuesto estimado <span class="req">*</span></div>
      <div class="hint" style="margin-bottom:8px">El "Monto (USD)" es un número simple, sin texto — se usa para el panel de totales del programa. El campo "Presupuesto estimado" queda libre para aclaraciones (IVA, moneda local, etc.).</div>
      <div class="hint" style="margin-bottom:8px">Categorías del nomenclador de inversiones CFI — Línea Triple Impacto. Elegí primero la categoría (nivel 1) y después la subcategoría específica (nivel 2).</div>
      <div class="table-scroll"><table class="dyn-table" style="min-width:100%">
        <thead><tr><th>Inversión</th><th>Categoría (nivel 1)</th><th>Subcategoría (nivel 2)</th><th>Monto (USD)</th><th>Presupuesto estimado (texto)</th><th></th></tr></thead>
        <tbody>${d.presupuesto.map((p,i)=>{
          const cat = NOMENCLADOR.find(c=>c.n1===p.codN1);
          const legacyLabel = (!p.codN1 && p.tipo) ? p.tipo : '';
          const selStyle = 'width:100%;min-width:170px;padding:6px 7px;border:1px solid var(--border);border-radius:6px;font-size:11px;font-family:inherit';
          return `<tr>
          <td><input type="text" value="${p.inversion}" ${dis} onchange="setPresupuesto(${i},'inversion',this.value)"></td>
          <td>${legacyLabel && !canEdit() ? `<span style="font-size:11px">${legacyLabel}</span>` : `
          <select ${dis} onchange="setPresupuestoCat1(${i},this.value)" style="${selStyle}">
            <option value="">Sin categorizar</option>
            ${NOMENCLADOR.map(c=>`<option value="${c.n1}" ${p.codN1===c.n1?'selected':''}>${c.n1} — ${c.label}</option>`).join('')}
          </select>`}</td>
          <td>${p.codN1 ? `
          <select ${dis} onchange="setPresupuestoCat2(${i},this.value)" style="${selStyle}">
            <option value="">Elegir subcategoría…</option>
            ${(cat?cat.items:[]).map(it=>`<option value="${it.n2}" ${p.codN2===it.n2?'selected':''}>${it.n2} — ${it.label}</option>`).join('')}
          </select>` : `<span class="hint" style="font-size:10px">Elegí primero la categoría</span>`}</td>
          <td><input type="number" value="${p.montoUSD||''}" ${dis} placeholder="0" onchange="setPresupuesto(${i},'montoUSD',this.value)"></td>
          <td><input type="text" value="${p.monto||''}" ${dis} placeholder="Ej: USD 5.000 + IVA" onchange="setPresupuesto(${i},'monto',this.value)"></td>
          <td class="row-remove">${canEdit()&&d.presupuesto.length>1?`<button onclick="removePresupuesto(${i})" aria-label="Quitar"><i class="ti ti-x"></i></button>`:''}</td>
        </tr>`;
        }).join('')}</tbody>
      </table></div>
      <button class="add-row-btn" ${canEdit()?'':'disabled'} onclick="addPresupuesto()"><i class="ti ti-plus"></i> Agregar ítem</button>
      <div class="subsection-title">7. Estrategia de seguimiento y evaluación</div>
      <div class="field-group"><label>Responsable técnico</label><input type="text" value="${d.responsableSeguimiento}" ${dis} oninput="setField('responsableSeguimiento',this.value)"></div>
      <div class="field-group"><label>Métodos de control</label><textarea ${dis} oninput="setField('metodosControl',this.value)">${d.metodosControl}</textarea></div>
      <div class="field-group"><label>Periodicidad</label><input type="text" value="${d.periodicidad}" ${dis} placeholder="Ej: 3 visitas anuales" oninput="setField('periodicidad',this.value)"></div>
    </div>${navRow()}`;

  if (t === 'fotos') {
    const fotoBySlot = {};
    dg.fotos.forEach(f => { fotoBySlot[f.slot_index] = f; });
    const count = dg.fotos.length;
    const slots = [0,1,2,3,4,5].map(i => {
      const f = fotoBySlot[i];
      if (f) {
        return `<div class="photo-slot filled" data-slot="${i}">
          <img src="/uploads/${dg.id}/${f.filename}" alt="Foto ${i+1}">
          ${canEdit()?`<button class="photo-remove" onclick="removePhoto(${i},event)" aria-label="Quitar foto"><i class="ti ti-x"></i></button>`:''}
        </div>`;
      }
      return `<label class="photo-slot" data-slot="${i}">
        <i class="ti ti-plus"></i>
        ${canEdit()?`<input type="file" accept="image/*" capture="environment" onchange="onPhotoSelected(${i},this)">`:''}
      </label>`;
    }).join('');
    return `
    ${lockedBanner(dg)}
    <div class="section-title" style="margin-bottom:10px"><i class="ti ti-camera"></i> Registro fotográfico (${count}/6)</div>
    <div class="photo-grid">${slots}</div>
    <div class="field-group" style="margin-top:14px"><div class="hint">Cada foto se guarda con georreferencia (si el navegador la concede) y marca de tiempo real del servidor.</div></div>
    ${navRow()}`;
  }

  if (t === 'resumen') return renderResumen(dg);
  if (t === 'firmas') return renderFirmas(dg);
  if (t === 'historial') return renderHistorial(dg);
  return '';
}

/* ================= resumen + impresión ================= */
function renderResumen(dg) {
  const d = dg.data; const c = dg.completeness;
  const iconFor = s => s==='ok'?'ti-circle-check':(s==='part'?'ti-alert-circle':'ti-circle');
  const checks = Object.entries(c.secs).map(([k,s])=>`<li class="${s.state}"><i class="ti ${iconFor(s.state)}"></i> ${s.label} <span style="margin-left:auto;color:var(--lock);font-size:10.5px">${s.done}/${s.total}</span></li>`).join('');
  const cultivosStr = d.cultivos.filter(cv=>cv.cultivo).map(cv=>`${cv.cultivo}${cv.variedad?` (${cv.variedad})`:''}${cv.superficie?` · ${cv.superficie} ha`:''}`).join('; ')||'—';
  const presupuestoStr = d.presupuesto.filter(p=>p.inversion).map(p=>`${p.inversion}${p.monto?` — ${p.monto}`:''}`).join('; ')||'—';
  return `
    <div class="section-card">
      <div class="section-title"><i class="ti ti-list-check"></i> Completitud del diagnóstico — ${c.pct}%</div>
      <ul class="check-list">${checks}</ul>
    </div>
    <div class="section-card">
      <div class="section-title"><i class="ti ti-file-description"></i> Síntesis</div>
      <div class="resumen-kv">
        <b>Productor:</b> ${d.productor||'—'}<br>
        <b>Finca:</b> ${d.finca||'—'} · ${d.localidad||'—'}<br>
        <b>Superficie:</b> ${d.superficieTotal||'—'} ha totales · ${d.superficieCultivada||'—'} ha cultivadas<br>
        <b>Cultivos:</b> ${cultivosStr}<br>
        <b>Sistemas de riego:</b> ${d.sistemasPresentes.join(', ')||'—'}<br>
        <b>Mejora propuesta:</b> ${d.descripcionMejora||'—'}<br>
        <b>Presupuesto:</b> ${presupuestoStr}<br>
        <b>Plazo:</b> ${d.tiempoTotalMeses?d.tiempoTotalMeses+' meses':'—'}
      </div>
    </div>
    <button class="print-btn" onclick="printDiag()"><i class="ti ti-printer"></i> Imprimir / guardar como PDF</button>
    ${navRow()}`;
}
function printDiag() {
  const dg = cur(); const d = dg.data;
  const sigRow = (key,label) => {
    const s = dg.signatures[key];
    return `<tr><td>${label}</td><td>${s?('Firmado — usuario '+s.usuario):'Pendiente'}</td><td>${s?nowFmt(s.timestamp):'—'}</td><td style="font-family:monospace">${s?s.hash:'—'}</td></tr>`;
  };
  document.getElementById('printArea').innerHTML = `
    <h1>Diagnóstico Técnico de Riego</h1>
    <div class="p-sub">Programa de Apoyo para la Tecnificación del Riego — CFI · Provincia de Mendoza<br>Estado: ${STAGE_LABELS[dg.docStatus]} · Impreso: ${nowFmt(new Date().toISOString())}</div>
    <h2>1. Datos generales</h2>
    <p><b>Productor:</b> ${d.productor||'—'} · <b>Finca:</b> ${d.finca||'—'} · <b>Localidad:</b> ${d.localidad||'—'} · <b>RENSPA/RUT:</b> ${d.renspa||'—'}<br>
    <b>Superficie:</b> total ${d.superficieTotal||'—'} ha · cultivada ${d.superficieCultivada||'—'} ha · inculta ${d.superficieInculta||'—'} ha · con derecho ${d.superficieDerecho||'—'} ha<br>
    <b>CCPP:</b> ${d.ccpp||'—'} · <b>Pozos:</b> ${d.pozos||'—'}</p>
    <h2>2. Cultivos</h2>
    <table><tr><th>Cultivo</th><th>Variedad</th><th>Destino</th><th>Sup. (ha)</th><th>Conducción</th><th>Rend.</th></tr>
    ${d.cultivos.filter(cv=>cv.cultivo).map(cv=>`<tr><td>${cv.cultivo}</td><td>${cv.variedad||'—'}</td><td>${cv.destino||'—'}</td><td>${cv.superficie||'—'}</td><td>${cv.conduccion||'—'}</td><td>${cv.rendimiento||'—'}</td></tr>`).join('')||'<tr><td colspan="6">Sin cultivos cargados</td></tr>'}</table>
    <h2>3. Suelo</h2>
    <p><b>Análisis:</b> ${d.analisisSuelo||'—'} · <b>Textura:</b> ${d.textura||'—'}<br><b>Problemas:</b> ${d.problemasSuelo||'—'}</p>
    <h2>4. Sistema de riego</h2>
    <p><b>Presentes:</b> ${d.sistemasPresentes.join(', ')||'—'}<br>
    <b>Superficial:</b> fuente ${d.rsFuente||'—'} · ${d.rsSuperficie||'—'} ha · problemas: ${d.rsProblemas||'—'}<br>
    <b>Presurizado:</b> fuente ${d.rpFuente||'—'} · ${d.rpSuperficie||'—'} ha · problemas: ${d.rpProblemas||'—'}<br>
    <b>Represa:</b> ${d.represa||'—'} ${d.volumenRepresa?('('+d.volumenRepresa+' m³)'):''} · <b>Medición de caudales:</b> ${d.medicionCaudales||'—'}</p>
    <h2>5. Propuesta de mejora</h2>
    <p><b>Descripción:</b> ${d.descripcionMejora||'—'}</p>
    ${d.materialesMejora?('<p><b>Materiales:</b></p><ul>'+d.materialesMejora.split('\n').filter(Boolean).map(x=>'<li>'+x+'</li>').join('')+'</ul>'):''}
    ${d.indicadoresMejora?('<p><b>Indicadores:</b></p><ul>'+d.indicadoresMejora.split('\n').filter(Boolean).map(x=>'<li>'+x+'</li>').join('')+'</ul>'):''}
    <p><b>Plazo:</b> ${d.tiempoTotalMeses||'—'} meses · <b>Presupuesto:</b> ${d.presupuesto.filter(p=>p.inversion).map(p=>p.inversion+(p.monto?': '+p.monto:'')).join('; ')||'—'}</p>
    ${dg.signatures.cfi && dg.signatures.cfi.informe ? '<h2>6. Conformidad Técnica (CFI)</h2><p style="white-space:pre-wrap">'+dg.signatures.cfi.informe+'</p>' : ''}
    <h2>Firmas</h2>
    <table><tr><th>Rol</th><th>Estado</th><th>Fecha</th><th>Hash de contenido</th></tr>
    ${sigRow('tecnico','Técnico de campo')}${sigRow('provincia','Responsable provincial')}${sigRow('cfi','Técnico CFI')}</table>
    <p class="p-firma">Documento generado por Diagnóstico Técnico de Riego. Las firmas electrónicas registran usuario autenticado, reautenticación al momento de firmar, fecha/hora del servidor y hash del contenido firmado.</p>`;
  window.print();
}

/* ================= historial ================= */
function renderHistorial(dg) {
  const items = dg.historial.slice().reverse().map(h => {
    const icon = h.tipo==='warn'?'ti-alert-triangle':(h.tipo==='danger'?'ti-arrow-back-up':'ti-check');
    return `<div class="hist-item ${h.tipo}"><div class="h-icon"><i class="ti ${icon}"></i></div>
      <div class="h-body"><b>${h.evento}</b>${h.detalle?' — '+h.detalle:''}
      <div class="h-when">${nowFmt(h.ts)} · ${h.usuario}</div></div></div>`;
  }).join('');
  return `<div class="section-card"><div class="section-title"><i class="ti ti-history"></i> Historial de actividad</div>${items}</div>${navRow()}`;
}

/* ================= firmas ================= */
function renderFirmas(dg) {
  const idx = STAGES.indexOf(dg.docStatus);
  let html = dg.rejection ? `<div class="rejection-banner"><strong><i class="ti ti-arrow-back-up"></i> Devuelto por ${dg.rejection.label}</strong>Motivo: ${dg.rejection.motivo}</div>` : '';
  if (state.session.role==='tecnico' && dg.docStatus==='borrador') {
    const faltan = dg.completeness ? missingLocal(dg) : [];
    if (faltan.length) {
      html += `<div class="missing-banner"><strong><i class="ti ti-forbid-2"></i> Antes de firmar completá:</strong><ul>${faltan.map(f=>`<li>${f}</li>`).join('')}</ul></div>`;
    }
  }
  html += sigCardHTML(dg,'tecnico','Técnico de campo',0,idx) + sigCardHTML(dg,'provincia','Responsable provincial',1,idx) + sigCardHTML(dg,'cfi','Técnico CFI',2,idx);
  if (dg.docStatus==='firmado_cfi') {
    const pendientes = ['provincia','cfi'].map(k=>dg.signatures[k]).filter(s=>s&&s.conObservaciones);
    html += `<div class="final-doc"><i class="ti ti-circle-check-filled"></i><p>Documento finalizado y sellado. Listo para el expediente de crédito.</p>
      <div class="btn btn-primary" style="display:inline-block;padding:9px 20px;" onclick="printDiag()">Imprimir documento final</div></div>`;
    if (dg.signatures.cfi && dg.signatures.cfi.informe) {
      html += `<details class="informe-final" style="margin-top:12px"><summary><i class="ti ti-file-text"></i> Ver Conformidad Técnica (informe firmado por CFI)</summary><pre>${dg.signatures.cfi.informe}</pre></details>`;
    }
    if (pendientes.length) {
      html += `<div class="rejection-banner" style="margin-top:12px"><strong><i class="ti ti-notes"></i> Validado sujeto a complementar</strong>${pendientes.map(s=>`• ${s.observaciones}`).join('<br>')}</div>`;
    }
  }
  return html + navRow();
}
function missingLocal(dg) {
  const d = dg.data; const has = v => v!==null && v!==undefined && String(v).trim()!=='';
  const faltan = [];
  if (!has(d.productor)) faltan.push('Nombre del productor');
  if (!has(d.finca)) faltan.push('Nombre de la finca');
  if (!has(d.localidad)) faltan.push('Localidad/Departamento');
  if (!has(d.superficieTotal)) faltan.push('Superficie total');
  if (!d.cultivos.some(c=>has(c.cultivo))) faltan.push('Al menos un cultivo');
  if (d.sistemasPresentes.length===0) faltan.push('Sistema de riego presente');
  if (!has(d.descripcionMejora)) faltan.push('Descripción de la mejora propuesta');
  if (!d.presupuesto.some(p=>has(p.inversion))) faltan.push('Al menos un ítem de presupuesto');
  return faltan;
}
function sigCardHTML(dg, key, label, order, currentIdx) {
  const sig = dg.signatures[key];
  const isReviewer = (key==='provincia'||key==='cfi');
  const myTurn = order===currentIdx && state.session.role===key;
  const tecnicoBlocked = key==='tecnico' && myTurn && missingLocal(dg).length>0;
  let badge, body;
  if (sig) {
    badge = sig.conObservaciones ? `<span class="badge observado"><i class="ti ti-alert-triangle"></i> Validado con observaciones</span>` : `<span class="badge firmado"><i class="ti ti-check"></i> Firmado</span>`;
    body = `<div class="sig-preview">${sig.image?`<img src="${sig.image}">`:'<span class="hint">(sin trazo de firma)</span>'}</div><div class="signed-meta">
      <div><i class="ti ti-user-check"></i> Firmado como: ${label} (usuario ${sig.usuario})</div>
      <div><i class="ti ti-clock"></i> ${nowFmt(sig.timestamp)}</div>
      <div><i class="ti ti-map-pin"></i> ${sig.geo}</div>
      <div><i class="ti ti-shield-check"></i> Identidad reautenticada al momento de firmar</div>
      <div><i class="ti ti-fingerprint"></i> Hash: ${sig.hash}</div></div>
      ${sig.conObservaciones?`<div class="rejection-banner" style="margin-top:8px;margin-bottom:0"><strong><i class="ti ti-notes"></i> Observaciones pendientes de complementar</strong>${sig.observaciones}</div>`:''}
      ${key==='cfi'&&sig.informe?`<details class="informe-final"><summary><i class="ti ti-file-text"></i> Ver Conformidad Técnica firmada</summary><pre>${sig.informe}</pre></details>`:''}`;
  } else if (myTurn) {
    badge = `<span class="badge pendiente">Tu turno de firmar</span>`;
    if (key==='cfi') {
      body = `
        <div class="field-group" style="margin-bottom:12px">
          <label>Informe de Conformidad Técnica</label>
          <button class="generar-btn" onclick="generarInforme()"><i class="ti ti-wand"></i> Generar borrador con los datos del diagnóstico</button>
          <textarea class="informe-textarea" placeholder="Generá el borrador con el botón, o escribilo manualmente." oninput="setInforme(this.value)">${dg.informeConformidad}</textarea>
          <div class="hint" style="margin-top:4px">Editable antes de firmar — el borrador se arma solo, pero el técnico de CFI revisa y ajusta la redacción final.</div>
        </div>
        <canvas id="canvas-${key}"></canvas>
        <textarea id="obs-${key}" class="obs-textarea" placeholder="Observaciones pendientes (opcional) — si completás esto, se valida igual pero queda sujeto a complementar."></textarea>
        <div class="sig-actions">
          <button class="btn btn-reject" onclick="requestSign('${key}','${label}','rechazar')">Rechazar y devolver</button>
          <button class="btn btn-primary" onclick="requestSign('${key}','${label}','validar')">Validar y firmar</button>
        </div>`;
    } else if (isReviewer) {
      body = `<canvas id="canvas-${key}"></canvas>
        <textarea id="obs-${key}" class="obs-textarea" placeholder="Observaciones (opcional) — con texto se valida igual pero queda sujeto a complementar; para rechazar es obligatorio explicar el motivo."></textarea>
        <div class="sig-actions">
          <button class="btn btn-reject" onclick="requestSign('${key}','${label}','rechazar')">Rechazar y devolver</button>
          <button class="btn btn-primary" onclick="requestSign('${key}','${label}','validar')">Validar y firmar</button>
        </div>`;
    } else {
      body = `<canvas id="canvas-${key}"></canvas><div class="sig-actions">
        <button class="btn btn-ghost" onclick="clearCanvas('${key}')">Borrar firma</button>
        <button class="btn btn-primary" ${tecnicoBlocked?'disabled':''} onclick="requestSign('${key}','${label}','validar')">${tecnicoBlocked?'Completá los campos obligatorios':'Firmar y confirmar'}</button></div>`;
    }
  } else if (order===currentIdx) {
    badge = `<span class="badge pendiente">Pendiente</span>`;
    body = `<div class="signed-meta"><div><i class="ti ti-hourglass"></i> Esperando la firma de: ${label}. Cerrá sesión e ingresá con ese rol para continuar.</div></div>`;
  } else if (order<currentIdx) {
    badge = `<span class="badge pendiente">Pendiente</span>`;
    body = `<div class="signed-meta"><div><i class="ti ti-hourglass"></i> Etapa anterior sin completar.</div></div>`;
  } else {
    badge = `<span class="badge bloqueado"><i class="ti ti-lock"></i> Bloqueado</span>`;
    body = `<div class="signed-meta"><div><i class="ti ti-lock"></i> Se habilita al completar la etapa anterior.</div></div>`;
  }
  return `<div class="sig-card"><div class="sig-head"><div class="role-name">${order+1}. ${label}</div>${badge}</div>${body}</div>`;
}
let informeDebounce = null;
function setInforme(val) {
  cur().informeConformidad = val;
  clearTimeout(informeDebounce);
  informeDebounce = setTimeout(async () => {
    try { await api(`/diagnosticos/${state.currentId}/informe`, { method:'PUT', body: JSON.stringify({texto: val}) }); }
    catch(e) { showToast('Error al guardar el informe', true); }
  }, 500);
}
async function generarInforme() {
  try {
    const { informeConformidad } = await api(`/diagnosticos/${state.currentId}/informe/generar`, { method: 'POST' });
    cur().informeConformidad = informeConformidad;
    render(); setTimeout(setupCanvases,0);
  } catch (e) { showToast(e.message || 'Error al generar el informe', true); }
}
function setupCanvases() {
  ['tecnico','provincia','cfi'].forEach(key => {
    const canvas = document.getElementById('canvas-'+key);
    if (!canvas||canvas.dataset.bound) return;
    canvas.dataset.bound = '1';
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.clientWidth*2; canvas.height = canvas.clientHeight*2;
    ctx.scale(2,2); ctx.strokeStyle = '#2F5238'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    let drawing=false, last=null;
    const pos = e => { const r=canvas.getBoundingClientRect(); const p=e.touches?e.touches[0]:e; return {x:p.clientX-r.left,y:p.clientY-r.top}; };
    const start = e => { drawing=true; last=pos(e); e.preventDefault(); };
    const move = e => { if(!drawing) return; const p=pos(e); ctx.beginPath(); ctx.moveTo(last.x,last.y); ctx.lineTo(p.x,p.y); ctx.stroke(); last=p; e.preventDefault(); };
    const end = () => { drawing=false; };
    canvas.addEventListener('mousedown',start); canvas.addEventListener('mousemove',move); window.addEventListener('mouseup',end);
    canvas.addEventListener('touchstart',start,{passive:false}); canvas.addEventListener('touchmove',move,{passive:false}); canvas.addEventListener('touchend',end);
  });
}
function clearCanvas(key) { const c=document.getElementById('canvas-'+key); if(c) c.getContext('2d').clearRect(0,0,c.width,c.height); }
function canvasHasDrawing(key) {
  const c = document.getElementById('canvas-'+key);
  if (!c) return false;
  const ctx = c.getContext('2d');
  const data = ctx.getImageData(0,0,c.width,c.height).data;
  for (let i=3;i<data.length;i+=4) if (data[i]!==0) return true;
  return false;
}

/* ================= reauth + firmar ================= */
function renderReauthOverlay() {
  const overlay = document.getElementById('reauthOverlay');
  if (!state.pendingSignAction) { overlay.innerHTML=''; return; }
  const {label,action} = state.pendingSignAction;
  const verb = action==='rechazar'?'rechazar y devolver este diagnóstico':'firmar';
  overlay.innerHTML = `
    <div class="reauth-overlay"><div class="reauth-modal">
      <h3><i class="ti ti-shield-lock"></i> Confirmá tu identidad</h3>
      <p>Estás por ${verb} como <b>${label}</b> (${state.session.nombre}). Volvé a ingresar tu contraseña para confirmar este acto.</p>
      <input type="password" id="reauthPass" placeholder="Contraseña">
      ${state.reauthError?`<div class="login-error"><i class="ti ti-alert-circle"></i> ${state.reauthError}</div>`:''}
      <div class="reauth-actions">
        <button class="btn btn-ghost" style="flex:1" onclick="cancelReauth()">Cancelar</button>
        <button class="btn btn-primary" style="flex:1" ${state.reauthBusy?'disabled':''} onclick="confirmReauth()">${state.reauthBusy?'Confirmando…':'Confirmar'}</button>
      </div>
    </div></div>`;
  const el = document.getElementById('reauthPass');
  if (el) { el.focus(); el.addEventListener('keydown', e=>{ if(e.key==='Enter') confirmReauth(); }); }
}
function requestSign(key, label, action) {
  const obsEl = document.getElementById('obs-'+key);
  const obsVal = obsEl ? obsEl.value.trim() : '';
  if (action==='rechazar' && !obsVal) { alert('Para rechazar y devolver, contá el motivo en el campo de observaciones.'); return; }
  state.pendingObs = obsVal;
  state.pendingSignatureData = canvasHasDrawing(key) ? document.getElementById('canvas-'+key).toDataURL('image/png') : null;
  state.pendingSignAction = {key,label,action}; state.reauthError=''; render();
}
function cancelReauth() {
  state.pendingSignAction=null; state.reauthError='';
  render(); if (state.activeTab==='firmas') setTimeout(setupCanvases,0);
}
async function confirmReauth() {
  const password = document.getElementById('reauthPass').value;
  state.reauthBusy = true; render();
  const {key,label,action} = state.pendingSignAction;
  try {
    const geo = await getGeo();
    const updated = await api(`/diagnosticos/${state.currentId}/firmar`, {
      method: 'POST',
      body: JSON.stringify({ action, password, observaciones: state.pendingObs, signatureImage: state.pendingSignatureData, geo })
    });
    state.currentDiag = updated;
    state.pendingSignAction=null; state.pendingObs=''; state.pendingSignatureData=null; state.reauthBusy=false; state.reauthError='';
    state.activeTab='firmas';
    render(); setTimeout(setupCanvases,0);
  } catch (e) {
    state.reauthBusy=false;
    state.reauthError = e.message || 'No se pudo confirmar la acción.';
    render();
  }
}

/* ================= bandeja de correos ================= */
async function refreshUnreadCount() {
  try { const {count} = await api('/emails/unread-count'); state.unreadCount = count; const btn=document.querySelector('.mail-btn'); if(btn) renderUserBadge(); }
  catch(e) { /* silencioso */ }
}
async function toggleMail() {
  state.showMail = !state.showMail;
  if (state.showMail) {
    try {
      const { emails, smtpConfigured } = await api('/emails');
      state.emails = emails; state.emailsSmtpConfigured = smtpConfigured;
      await api('/emails/marcar-leidos', { method:'POST' });
      state.unreadCount = 0;
    } catch(e) { /* silencioso */ }
  }
  renderMailOverlay();
  renderUserBadge();
}
function mailtoLink(m) { return `mailto:${m.to_email}?subject=${encodeURIComponent(m.subject)}&body=${encodeURIComponent(m.body)}`; }
function statusLabel(s) { return s==='sent'?'Enviado por SMTP':(s==='failed'?'Falló el envío':'Guardado (SMTP no configurado)'); }
function renderMailOverlay() {
  let el = document.getElementById('mailOverlay');
  if (!el) { el = document.createElement('div'); el.id='mailOverlay'; document.body.appendChild(el); }
  if (!state.showMail) { el.innerHTML=''; return; }
  const note = state.emailsSmtpConfigured
    ? 'SMTP configurado — estos correos se están enviando de verdad.'
    : 'SMTP no configurado todavía (ver .env) — los correos quedan guardados acá pero no se envían.';
  const list = state.emails.map(m => `
    <div class="mail-item">
      <div class="mail-to"><i class="ti ti-mail-forward"></i> Para: ${m.to_name} &lt;${m.to_email}&gt;</div>
      <div class="mail-subject">${m.subject}</div>
      <pre class="mail-body">${m.body}</pre>
      <div class="mail-foot"><span class="mail-status ${m.status}">${statusLabel(m.status)}</span><span>${nowFmt(m.created_at)}</span><a href="${mailtoLink(m)}">Abrir en tu correo</a></div>
    </div>`).join('') || `<div class="empty-state" style="padding:24px"><i class="ti ti-mail-off"></i><p>Todavía no se envió ninguna notificación.</p></div>`;
  el.innerHTML = `
    <div class="reauth-overlay" onclick="if(event.target===this) toggleMail()">
      <div class="mail-panel">
        <div class="mail-head"><h3><i class="ti ti-mail"></i> Notificaciones enviadas</h3>
        <button class="btn btn-ghost" onclick="toggleMail()">Cerrar</button></div>
        <div class="mail-note"><i class="ti ti-info-circle"></i> ${note}</div>
        <div class="mail-list">${list}</div>
      </div>
    </div>`;
}

/* ================= toast ================= */
let toastTimer = null;
function showToast(msg, isError) {
  const t = document.getElementById('toast');
  t.innerHTML = `<i class="ti ${isError?'ti-alert-circle':'ti-device-floppy'}"></i> ${msg||'Borrador guardado'}`;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>t.classList.remove('show'), 1600);
}

/* ================= init ================= */
render();
setInterval(refreshUnreadCount, 15000);
