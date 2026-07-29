/* =========================================================================
   Diagnóstico Técnico de Riego — frontend real (habla con la API del backend)
   ========================================================================= */

const STAGES = ['borrador','firmado_tecnico','firmado_provincia','firmado_cfi'];
const STAGE_LABELS = {borrador:'Borrador', firmado_tecnico:'Firmado por técnico', firmado_provincia:'Firmado por provincia', firmado_cfi:'Validado por CFI'};
const STAGE_ROLE = ['tecnico','provincia','cfi'];
const DEMO_HINT = {tecnico:{username:'aperez', password:'1234'}, provincia:{username:'mgomez', password:'1234'}, cfi:{username:'lcosta', password:'1234'}};
const TABS = [['estab','Establec.'],['cultivos','Cultivos'],['suelo','Suelo'],['riego','Riego'],['propuesta','Propuesta'],['fotos','Fotos'],['resumen','Resumen'],['firmas','Firmas'],['historial','Historial']];

let state = {
  token: localStorage.getItem('riego_token') || null,
  session: JSON.parse(localStorage.getItem('riego_user') || 'null'),
  loginSelectedRole: 'tecnico', loginError: '', loginBusy:false,
  view: 'home', currentId: null, activeTab: 'estab',
  diagnosticos: [], currentDiag: null,
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
    renderLoginScreen(); renderReauthOverlay();
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

/* ================= login ================= */
function renderLoginScreen() {
  const r = state.loginSelectedRole;
  const roles = [['tecnico','Técnico de campo'],['provincia','Resp. provincial'],['cfi','Técnico CFI']];
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
function logout() { clearSession(); state.view = 'home'; state.currentId = null; state.currentDiag = null; render(); }

function renderUserBadge() {
  const s = state.session;
  document.getElementById('userBadge').innerHTML = `
    <div class="user-badge">
      <div class="who"><i class="ti ti-user-circle"></i><div>${s.nombre}<span>${s.rolLabel} · ${s.username}</span></div></div>
      <div style="display:flex;gap:6px;align-items:center">
        <button class="mail-btn" onclick="toggleMail()" aria-label="Notificaciones enviadas"><i class="ti ti-mail"></i>${state.unreadCount?`<span class="count">${state.unreadCount}</span>`:''}</button>
        <button onclick="logout()">Cambiar de usuario</button>
      </div>
    </div>`;
}

/* ================= home ================= */
function diagCardHTML(dg) {
  return `
      <div class="diag-card ${dg.myTurn ? 'my-turn' : ''}" onclick="openDiag(${dg.id})">
        <div class="dc-top">
          <div><div class="dc-name">${dg.finca || 'Sin nombre de finca'}</div>
          <div class="dc-prod">${dg.productor || 'Productor sin cargar'} · ${dg.localidad || 's/localidad'}</div></div>
          <div class="dc-badges">
            <span class="badge ${dg.docStatus}">${STAGE_LABELS[dg.docStatus]}</span>
            ${dg.wasRejected ? `<span class="badge devuelto"><i class="ti ti-arrow-back-up"></i> Devuelto</span>` : ''}
            ${dg.myTurn ? `<span class="badge tu-turno"><i class="ti ti-bell-ringing"></i> Te toca a vos</span>` : ''}
          </div>
        </div>
        <div class="meter ${dg.completenessPct===100?'full':''}"><b style="width:${dg.completenessPct}%"></b></div>
        <div class="dc-meta"><div class="dc-date"><i class="ti ti-clock"></i> Últ. actividad: ${nowFmt(dg.updatedAt)}</div>
        <div class="dc-date">${dg.completenessPct}% completo</div></div>
      </div>`;
}
function renderHome() {
  const list = state.diagnosticos;
  const pendientes = list.filter(dg => dg.myTurn);
  const resto = list.filter(dg => !dg.myTurn);
  let pendingBanner = '';
  let cards = '';
  if (!list.length) {
    cards = `<div class="empty-state"><i class="ti ti-clipboard-plus"></i><p>Todavía no hay diagnósticos cargados.<br>Creá el primero con el botón de arriba.</p></div>`;
  } else {
    if (pendientes.length) {
      const rejCount = pendientes.filter(d => d.wasRejected).length;
      pendingBanner = `<div class="pending-banner"><i class="ti ti-bell-ringing"></i> Tenés <b>${pendientes.length}</b> diagnóstico${pendientes.length===1?'':'s'} pendiente${pendientes.length===1?'':'s'} de tu firma${rejCount ? ` (${rejCount} por devolución/rechazo)` : ''}.</div>`;
      cards += `<div class="list-section-title">Pendientes de tu firma</div>` + pendientes.map(diagCardHTML).join('');
    }
    if (resto.length) {
      cards += `${pendientes.length ? '<div class="list-section-title">Otros diagnósticos</div>' : ''}` + resto.map(diagCardHTML).join('');
    }
  }
  const canCreate = state.session.role === 'tecnico';
  return `
    <div class="home-head"><h2>Diagnósticos</h2>
    ${canCreate?`<button class="btn-new" onclick="createDiag()"><i class="ti ti-plus"></i> Nuevo</button>`:''}
    </div>
    ${pendingBanner}
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
      <button class="back" onclick="goHome()" aria-label="Volver"><i class="ti ti-arrow-left"></i></button>
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
function toggleArr(key, val) {
  if (!canEdit()) return;
  const arr = cur().data[key]; const i = arr.indexOf(val);
  if (i>=0) arr.splice(i,1); else arr.push(val);
  flushSave(); render();
}
function addCultivo() { if (!canEdit()) return; cur().data.cultivos.push({cultivo:'',variedad:'',destino:'',anio:'',marco:'',superficie:'',conduccion:'',rendimiento:''}); flushSave(); render(); }
function removeCultivo(i) { if (!canEdit()) return; cur().data.cultivos.splice(i,1); flushSave(); render(); }
function setCultivo(i, key, val) { if (!canEdit()) return; cur().data.cultivos[i][key] = val; scheduleSave(); }
function addPresupuesto() { if (!canEdit()) return; cur().data.presupuesto.push({inversion:'',monto:''}); flushSave(); render(); }
function removePresupuesto(i) { if (!canEdit()) return; cur().data.presupuesto.splice(i,1); flushSave(); render(); }
function setPresupuesto(i, key, val) { if (!canEdit()) return; cur().data.presupuesto[i][key] = val; scheduleSave(); }

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
        <div class="field-group"><label>Superficie total (ha) <span class="req">*</span></label><input type="number" value="${d.superficieTotal}" ${dis} oninput="setField('superficieTotal',this.value)"></div>
        <div class="field-group"><label>Superficie cultivada (ha)</label><input type="number" value="${d.superficieCultivada}" ${dis} oninput="setField('superficieCultivada',this.value)"></div>
      </div>
      <div class="row2">
        <div class="field-group"><label>Superficie inculta (ha)</label><input type="number" value="${d.superficieInculta}" ${dis} oninput="setField('superficieInculta',this.value)"></div>
        <div class="field-group"><label>Sup. con derecho de riego (ha)</label><input type="number" value="${d.superficieDerecho}" ${dis} oninput="setField('superficieDerecho',this.value)"></div>
      </div>
      <div class="field-group"><label>CCPP</label><input type="text" value="${d.ccpp}" ${dis} placeholder="Ej: Fracción 1) PP 9900 CC 247: 34,6 ha" oninput="setField('ccpp',this.value)"></div>
      <div class="field-group"><label>Identificación de pozos</label><input type="text" value="${d.pozos}" ${dis} placeholder="Ej: 2 pozos: 14.392 y 14.390" oninput="setField('pozos',this.value)"></div>
      <div class="field-group"><label>Observaciones</label><textarea ${dis} oninput="setField('obsGenerales',this.value)">${d.obsGenerales}</textarea></div>
    </div>${navRow()}`;

  if (t === 'cultivos') return `
    ${lockedBanner(dg)}
    <div class="section-title" style="margin-bottom:10px"><i class="ti ti-plant-2"></i> Datos del cultivo</div>
    <div class="table-scroll"><table class="dyn-table">
      <thead><tr><th>Cultivo</th><th>Variedad</th><th>Destino</th><th>Año plant.</th><th>Marco (m)</th><th>Sup. (ha)</th><th>Conducción</th><th>Rend. (kg/ha)</th><th></th></tr></thead>
      <tbody>${d.cultivos.map((cv,i)=>`<tr>
        <td><input type="text" value="${cv.cultivo}" ${dis} onchange="setCultivo(${i},'cultivo',this.value)"></td>
        <td><input type="text" value="${cv.variedad}" ${dis} onchange="setCultivo(${i},'variedad',this.value)"></td>
        <td><input type="text" value="${cv.destino}" ${dis} onchange="setCultivo(${i},'destino',this.value)"></td>
        <td><input type="text" value="${cv.anio}" ${dis} onchange="setCultivo(${i},'anio',this.value)"></td>
        <td><input type="text" value="${cv.marco}" ${dis} onchange="setCultivo(${i},'marco',this.value)"></td>
        <td><input type="text" value="${cv.superficie}" ${dis} onchange="setCultivo(${i},'superficie',this.value)"></td>
        <td><input type="text" value="${cv.conduccion}" ${dis} onchange="setCultivo(${i},'conduccion',this.value)"></td>
        <td><input type="text" value="${cv.rendimiento}" ${dis} onchange="setCultivo(${i},'rendimiento',this.value)"></td>
        <td class="row-remove">${canEdit()&&d.cultivos.length>1?`<button onclick="removeCultivo(${i})" aria-label="Quitar"><i class="ti ti-x"></i></button>`:''}</td>
      </tr>`).join('')}</tbody>
    </table></div>
    <button class="add-row-btn" ${canEdit()?'':'disabled'} onclick="addCultivo()"><i class="ti ti-plus"></i> Agregar cultivo</button>
    <div class="field-group"><label>Observaciones</label><textarea ${dis} oninput="setField('obsCultivos',this.value)">${d.obsCultivos}</textarea></div>
    ${navRow()}`;

  if (t === 'suelo') return `
    ${lockedBanner(dg)}
    <div class="section-card">
      <div class="section-title"><i class="ti ti-mountain"></i> Datos del suelo</div>
      <div class="field-group"><label>Análisis del suelo</label>
        <div class="chip-group">${chip(d.analisisSuelo,'Posee','Posee','analisisSuelo')}${chip(d.analisisSuelo,'No posee','No posee','analisisSuelo')}</div></div>
      <div class="field-group"><label>Textura (si no posee análisis, estimada)</label>
        <input type="text" value="${d.textura}" ${dis} placeholder="Ej: Franco limoso" oninput="setField('textura',this.value)"></div>
      <div class="field-group"><label>Principales problemas de suelo observados</label>
        <textarea ${dis} oninput="setField('problemasSuelo',this.value)">${d.problemasSuelo}</textarea></div>
      <div class="field-group"><label>Otras observaciones del suelo</label>
        <textarea ${dis} oninput="setField('obsSuelo',this.value)">${d.obsSuelo}</textarea></div>
    </div>${navRow()}`;

  if (t === 'riego') return `
    ${lockedBanner(dg)}
    <div class="section-card">
      <div class="section-title"><i class="ti ti-droplet-filled"></i> Sistema de riego</div>
      <div class="subsection-title">Sistemas presentes en la finca</div>
      <div class="chip-group">${['Surcos','Melgas','Goteo','Aspersión','Otro'].map(v=>`<div class="chip ${d.sistemasPresentes.includes(v)?'selected':''} ${canEdit()?'':'disabled'}" ${canEdit()?`onclick="toggleArr('sistemasPresentes','${v}')"`:''}>${v}</div>`).join('')}</div>
      ${d.sistemasPresentes.includes('Otro')?`<div class="field-group"><label>Detalle "Otro"</label><input type="text" value="${d.otroSistemaTexto}" ${dis} oninput="setField('otroSistemaTexto',this.value)"></div>`:''}

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
      <div class="table-scroll"><table class="dyn-table" style="min-width:100%">
        <thead><tr><th>Inversión</th><th>Presupuesto estimado</th><th></th></tr></thead>
        <tbody>${d.presupuesto.map((p,i)=>`<tr>
          <td><input type="text" value="${p.inversion}" ${dis} onchange="setPresupuesto(${i},'inversion',this.value)"></td>
          <td><input type="text" value="${p.monto}" ${dis} placeholder="USD" onchange="setPresupuesto(${i},'monto',this.value)"></td>
          <td class="row-remove">${canEdit()&&d.presupuesto.length>1?`<button onclick="removePresupuesto(${i})" aria-label="Quitar"><i class="ti ti-x"></i></button>`:''}</td>
        </tr>`).join('')}</tbody>
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
