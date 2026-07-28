const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../auth');
const { STAGES, STAGE_LABELS, STAGE_ROLE, stageIndex, completeness, missingForSign } = require('../constants');
const { generateConformidadDraft } = require('../informe');
const { sendEmailNotif } = require('../mailer');

const router = express.Router();
router.use(requireAuth);

function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h).toString(16).padStart(8, '0') + Math.abs((h * 2654435761) | 0).toString(16).padStart(8, '0');
}

function canEdit(req, diag) {
  return req.user.role === 'tecnico' && diag.doc_status === 'borrador';
}

async function loadDiag(id) {
  const { rows } = await db.query('SELECT * FROM diagnosticos WHERE id = $1', [id]);
  return rows[0] || null;
}

async function fotosCount(id) {
  const { rows } = await db.query('SELECT count(*)::int AS n FROM fotos WHERE diagnostico_id = $1', [id]);
  return rows[0].n;
}

async function fullPayload(diag) {
  const [fotosRes, sigRes, histRes] = await Promise.all([
    db.query('SELECT id, slot_index, filename, mimetype, lat, lng, created_at FROM fotos WHERE diagnostico_id = $1 ORDER BY slot_index', [diag.id]),
    db.query('SELECT role, usuario, ts, geo, hash, signature_image, con_observaciones, observaciones, informe FROM signatures WHERE diagnostico_id = $1', [diag.id]),
    db.query('SELECT ts, usuario, evento, detalle, tipo FROM historial WHERE diagnostico_id = $1 ORDER BY ts ASC', [diag.id])
  ]);
  const signatures = { tecnico: null, provincia: null, cfi: null };
  for (const s of sigRes.rows) {
    signatures[s.role] = {
      usuario: s.usuario, timestamp: s.ts, geo: s.geo, hash: s.hash, image: s.signature_image,
      conObservaciones: s.con_observaciones, observaciones: s.observaciones, informe: s.informe
    };
  }
  const c = completeness(diag.data, fotosRes.rows.length);
  return {
    id: diag.id,
    data: diag.data,
    docStatus: diag.doc_status,
    rejection: diag.rejection,
    informeConformidad: diag.informe_conformidad,
    createdAt: diag.created_at,
    updatedAt: diag.updated_at,
    fotos: fotosRes.rows,
    signatures,
    historial: histRes.rows,
    completeness: c,
    stageLabel: STAGE_LABELS[diag.doc_status]
  };
}

// ---------- listado ----------
router.get('/', async (req, res) => {
  const { rows } = await db.query('SELECT * FROM diagnosticos ORDER BY updated_at DESC');
  const out = [];
  for (const d of rows) {
    const n = await fotosCount(d.id);
    const c = completeness(d.data, n);
    out.push({
      id: d.id,
      productor: d.data.productor,
      finca: d.data.finca,
      localidad: d.data.localidad,
      docStatus: d.doc_status,
      stageLabel: STAGE_LABELS[d.doc_status],
      updatedAt: d.updated_at,
      completenessPct: c.pct
    });
  }
  res.json(out);
});

// ---------- crear ----------
router.post('/', requireRole('tecnico'), async (req, res) => {
  const { emptyData } = require('../constants');
  const { rows } = await db.query(
    `INSERT INTO diagnosticos (data, doc_status, created_by) VALUES ($1,'borrador',$2) RETURNING *`,
    [emptyData(), req.user.id]
  );
  const diag = rows[0];
  await db.query(
    `INSERT INTO historial (diagnostico_id, usuario, evento, detalle, tipo) VALUES ($1,$2,$3,$4,$5)`,
    [diag.id, req.user.username, 'Diagnóstico creado', '', 'ok']
  );
  res.status(201).json(await fullPayload(diag));
});

// ---------- detalle ----------
router.get('/:id', async (req, res) => {
  const diag = await loadDiag(req.params.id);
  if (!diag) return res.status(404).json({ error: 'No encontrado' });
  res.json(await fullPayload(diag));
});

// ---------- editar datos del formulario (autosave) ----------
router.put('/:id/data', async (req, res) => {
  const diag = await loadDiag(req.params.id);
  if (!diag) return res.status(404).json({ error: 'No encontrado' });
  if (!canEdit(req, diag)) return res.status(403).json({ error: 'El diagnóstico está bloqueado para edición.' });
  const newData = req.body && req.body.data;
  if (!newData || typeof newData !== 'object') return res.status(400).json({ error: 'Falta el cuerpo "data"' });
  const { rows } = await db.query(
    'UPDATE diagnosticos SET data = $1, updated_at = now() WHERE id = $2 RETURNING *',
    [newData, diag.id]
  );
  res.json(await fullPayload(rows[0]));
});

// ---------- generar / editar borrador de conformidad técnica ----------
router.post('/:id/informe/generar', requireRole('cfi'), async (req, res) => {
  const diag = await loadDiag(req.params.id);
  if (!diag) return res.status(404).json({ error: 'No encontrado' });
  if (diag.doc_status !== 'firmado_provincia') return res.status(403).json({ error: 'No es el turno de CFI todavía.' });
  const texto = generateConformidadDraft(diag.data);
  await db.query('UPDATE diagnosticos SET informe_conformidad = $1, updated_at = now() WHERE id = $2', [texto, diag.id]);
  await db.query(
    `INSERT INTO historial (diagnostico_id, usuario, evento, detalle, tipo) VALUES ($1,$2,$3,$4,$5)`,
    [diag.id, req.user.username, 'Borrador de Conformidad Técnica generado', 'Generación automática desde datos del DTR', 'ok']
  );
  res.json({ informeConformidad: texto });
});

router.put('/:id/informe', requireRole('cfi'), async (req, res) => {
  const diag = await loadDiag(req.params.id);
  if (!diag) return res.status(404).json({ error: 'No encontrado' });
  if (diag.doc_status !== 'firmado_provincia') return res.status(403).json({ error: 'No es el turno de CFI todavía.' });
  const texto = String((req.body && req.body.texto) || '');
  await db.query('UPDATE diagnosticos SET informe_conformidad = $1, updated_at = now() WHERE id = $2', [texto, diag.id]);
  res.json({ informeConformidad: texto });
});

// ---------- firmar / rechazar ----------
router.post('/:id/firmar', async (req, res) => {
  const diag = await loadDiag(req.params.id);
  if (!diag) return res.status(404).json({ error: 'No encontrado' });

  const { action, password, observaciones, signatureImage, geo } = req.body || {};
  if (!['validar', 'rechazar'].includes(action)) return res.status(400).json({ error: 'Acción inválida' });

  const idx = stageIndex(diag.doc_status);
  const expectedRole = STAGE_ROLE[idx];
  if (req.user.role !== expectedRole) {
    return res.status(403).json({ error: `No corresponde a tu rol firmar en esta etapa (le toca a ${expectedRole}).` });
  }

  // Reautenticación obligatoria para cualquier acto de firma o rechazo.
  const bcrypt = require('bcryptjs');
  const { rows: urows } = await db.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
  const dbUser = urows[0];
  if (!password || !(await bcrypt.compare(password, dbUser.password_hash))) {
    return res.status(401).json({ error: 'Contraseña incorrecta. Confirmá tu identidad para continuar.' });
  }

  const isReviewer = req.user.role === 'provincia' || req.user.role === 'cfi';
  const finca = diag.data.finca;
  const productor = diag.data.productor;

  if (action === 'rechazar') {
    if (req.user.role === 'tecnico') return res.status(400).json({ error: 'El técnico no puede rechazar, solo firmar.' });
    const motivo = (observaciones || '').trim();
    if (!motivo) return res.status(400).json({ error: 'Para rechazar y devolver, contá el motivo en observaciones.' });

    const rejection = { by: req.user.role, label: req.user.rolLabel, motivo, timestamp: new Date().toISOString() };
    if (req.user.role === 'provincia') {
      await db.query('DELETE FROM signatures WHERE diagnostico_id = $1 AND role = $2', [diag.id, 'tecnico']);
      await db.query('UPDATE diagnosticos SET doc_status = $1, rejection = $2, updated_at = now() WHERE id = $3', ['borrador', rejection, diag.id]);
      await db.query(`INSERT INTO historial (diagnostico_id, usuario, evento, detalle, tipo) VALUES ($1,$2,$3,$4,'danger')`,
        [diag.id, req.user.username, `Devuelto por ${req.user.rolLabel} al Técnico de campo`, motivo]);
      await sendEmailNotif(diag.id, finca, productor, 'rechazo_provincia', { motivo });
    }
    if (req.user.role === 'cfi') {
      await db.query('DELETE FROM signatures WHERE diagnostico_id = $1 AND role = $2', [diag.id, 'provincia']);
      await db.query('UPDATE diagnosticos SET doc_status = $1, rejection = $2, updated_at = now() WHERE id = $3', ['firmado_tecnico', rejection, diag.id]);
      await db.query(`INSERT INTO historial (diagnostico_id, usuario, evento, detalle, tipo) VALUES ($1,$2,$3,$4,'danger')`,
        [diag.id, req.user.username, `Devuelto por ${req.user.rolLabel} al Responsable provincial`, motivo]);
      await sendEmailNotif(diag.id, finca, productor, 'rechazo_cfi', { motivo });
    }
    const updated = await loadDiag(diag.id);
    return res.json(await fullPayload(updated));
  }

  // action === 'validar'
  if (req.user.role === 'tecnico') {
    const faltan = missingForSign(diag.data);
    if (faltan.length) return res.status(400).json({ error: 'Faltan campos obligatorios antes de firmar.', faltan });
  }

  const obsText = (observaciones || '').trim();
  const timestamp = new Date();
  const hash = simpleHash(JSON.stringify(diag.data) + req.user.role + timestamp.toISOString());
  const conObservaciones = isReviewer && !!obsText;
  const informe = req.user.role === 'cfi' ? diag.informe_conformidad : null;

  await db.query(
    `INSERT INTO signatures (diagnostico_id, role, usuario, ts, geo, hash, signature_image, con_observaciones, observaciones, informe)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (diagnostico_id, role) DO UPDATE SET
       usuario = EXCLUDED.usuario, ts = EXCLUDED.ts, geo = EXCLUDED.geo, hash = EXCLUDED.hash,
       signature_image = EXCLUDED.signature_image, con_observaciones = EXCLUDED.con_observaciones,
       observaciones = EXCLUDED.observaciones, informe = EXCLUDED.informe`,
    [diag.id, req.user.role, req.user.username, timestamp, geo || 'Sin geolocalización', hash, signatureImage || null, conObservaciones, obsText, informe]
  );

  const nextStatus = req.user.role === 'tecnico' ? 'firmado_tecnico' : req.user.role === 'provincia' ? 'firmado_provincia' : 'firmado_cfi';
  await db.query('UPDATE diagnosticos SET doc_status = $1, rejection = NULL, updated_at = now() WHERE id = $2', [nextStatus, diag.id]);

  if (req.user.role === 'tecnico') {
    await db.query(`INSERT INTO historial (diagnostico_id, usuario, evento, detalle, tipo) VALUES ($1,$2,'Firmado por Técnico de campo','Identidad reautenticada','ok')`, [diag.id, req.user.username]);
    await sendEmailNotif(diag.id, finca, productor, 'firma_tecnico');
  }
  if (req.user.role === 'provincia') {
    await db.query(`INSERT INTO historial (diagnostico_id, usuario, evento, detalle, tipo) VALUES ($1,$2,'Validado y firmado por Responsable provincial',$3,$4)`,
      [diag.id, req.user.username, obsText ? 'Con observaciones' : 'Sin observaciones', obsText ? 'warn' : 'ok']);
    await sendEmailNotif(diag.id, finca, productor, 'firma_provincia');
  }
  if (req.user.role === 'cfi') {
    await db.query(`INSERT INTO historial (diagnostico_id, usuario, evento, detalle, tipo) VALUES ($1,$2,'Validado y firmado por Técnico CFI',$3,$4)`,
      [diag.id, req.user.username, obsText ? 'Con observaciones sujetas a complementación' : 'Sin observaciones', obsText ? 'warn' : 'ok']);
    await sendEmailNotif(diag.id, finca, productor, 'firma_cfi', { conObservaciones, observaciones: obsText });
  }

  const updated = await loadDiag(diag.id);
  res.json(await fullPayload(updated));
});

module.exports = router;
