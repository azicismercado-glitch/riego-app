// Registro de visitas de seguimiento, habilitado recién cuando CFI valida el
// diagnóstico. Va en una tabla aparte (no en diagnosticos.data) para no
// alterar el contenido firmado: la huella de cada firma se calcula sobre
// "data", y el seguimiento sigue creciendo después de la última firma.
const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();
router.use(requireAuth);
router.param('id', require('../access').requireDiagnosticoVisible);

const SCHEMA = `
CREATE TABLE IF NOT EXISTS seguimiento_visitas (
  id SERIAL PRIMARY KEY,
  diagnostico_id INTEGER NOT NULL REFERENCES diagnosticos(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  avance_obra INTEGER CHECK (avance_obra BETWEEN 0 AND 100),
  indicadores JSONB NOT NULL DEFAULT '[]'::jsonb,
  observaciones TEXT NOT NULL DEFAULT '',
  usuario TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_seguimiento_diag ON seguimiento_visitas(diagnostico_id);`;

// Se crea sola al arrancar el servidor, así no hace falta correr la migración a mano.
async function ensureSchema() {
  await db.query(SCHEMA);
}

async function listarVisitas(diagId) {
  const { rows } = await db.query(
    `SELECT id, to_char(fecha, 'YYYY-MM-DD') AS fecha, avance_obra AS "avanceObra", indicadores, observaciones, usuario, created_at AS "createdAt", updated_at AS "updatedAt"
     FROM seguimiento_visitas WHERE diagnostico_id = $1 ORDER BY fecha ASC, id ASC`,
    [diagId]
  );
  return rows;
}

function compararConProyectado(valor, proyectada) {
  const real = Number(valor), proy = Number(proyectada);
  if (String(valor ?? '').trim() === '' || String(proyectada ?? '').trim() === '' || isNaN(real) || isNaN(proy)) return '';
  return real > proy ? 'Mayor al proyectado' : real === proy ? 'Igual al proyectado' : 'Menor al proyectado';
}

// Valida lo que manda el formulario y completa el resultado de cada indicador
// contra la situación proyectada declarada en el diagnóstico (no la que mande
// el navegador), para que la comparación no se pueda alterar.
function normalizarVisita(body, diagData) {
  const fecha = String(body.fecha || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || isNaN(Date.parse(fecha))) return { error: 'Falta la fecha de la visita.' };
  let avance = body.avanceObra;
  if (avance === '' || avance == null) avance = null;
  else {
    avance = Math.round(Number(avance));
    if (isNaN(avance) || avance < 0 || avance > 100) return { error: 'El avance de obra tiene que estar entre 0 y 100%.' };
  }
  const declarados = Array.isArray(diagData.indicadores) ? diagData.indicadores : [];
  const enviados = Array.isArray(body.indicadores) ? body.indicadores : [];
  const indicadores = enviados
    .map((e) => {
      const base = declarados.find((i) => i.indicador === e.indicador);
      if (!base || String(e.valor ?? '').trim() === '') return null;
      return {
        indicador: base.indicador,
        unidad: base.unidad || '',
        proyectada: base.proyectada || '',
        valor: String(e.valor).trim(),
        logrado: compararConProyectado(e.valor, base.proyectada)
      };
    })
    .filter(Boolean);
  return { fecha, avance, indicadores, observaciones: String(body.observaciones || '').trim() };
}

async function cargarDiagParaVisita(req, res) {
  const { rows } = await db.query('SELECT id, data, doc_status FROM diagnosticos WHERE id = $1', [req.params.id]);
  const diag = rows[0];
  if (!diag) { res.status(404).json({ error: 'No encontrado' }); return null; }
  if (req.user.role !== 'tecnico') { res.status(403).json({ error: 'Solo el técnico puede cargar visitas de seguimiento.' }); return null; }
  if (diag.doc_status !== 'firmado_cfi') { res.status(403).json({ error: 'El seguimiento se habilita cuando CFI valida el diagnóstico.' }); return null; }
  return diag;
}

async function registrarHistorial(diagId, usuario, evento, detalle) {
  await db.query(
    'INSERT INTO historial (diagnostico_id, usuario, evento, detalle, tipo) VALUES ($1,$2,$3,$4,$5)',
    [diagId, usuario, evento, detalle, 'ok']
  );
}

const fechaAR = (iso) => iso.split('-').reverse().join('/');

router.get('/:id/seguimiento', async (req, res, next) => {
  try { res.json(await listarVisitas(req.params.id)); } catch (e) { next(e); }
});

router.post('/:id/seguimiento', async (req, res, next) => {
  try {
    const diag = await cargarDiagParaVisita(req, res);
    if (!diag) return;
    const v = normalizarVisita(req.body || {}, diag.data);
    if (v.error) return res.status(400).json({ error: v.error });
    await db.query(
      `INSERT INTO seguimiento_visitas (diagnostico_id, fecha, avance_obra, indicadores, observaciones, usuario)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [diag.id, v.fecha, v.avance, JSON.stringify(v.indicadores), v.observaciones, req.user.username]
    );
    await registrarHistorial(diag.id, req.user.username, 'Visita de seguimiento registrada', `Visita del ${fechaAR(v.fecha)}`);
    res.status(201).json(await listarVisitas(diag.id));
  } catch (e) { next(e); }
});

router.put('/:id/seguimiento/:visitaId', async (req, res, next) => {
  try {
    const diag = await cargarDiagParaVisita(req, res);
    if (!diag) return;
    const v = normalizarVisita(req.body || {}, diag.data);
    if (v.error) return res.status(400).json({ error: v.error });
    const { rowCount } = await db.query(
      `UPDATE seguimiento_visitas SET fecha = $1, avance_obra = $2, indicadores = $3, observaciones = $4, updated_at = now()
       WHERE id = $5 AND diagnostico_id = $6`,
      [v.fecha, v.avance, JSON.stringify(v.indicadores), v.observaciones, req.params.visitaId, diag.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Visita no encontrada' });
    await registrarHistorial(diag.id, req.user.username, 'Visita de seguimiento modificada', `Visita del ${fechaAR(v.fecha)}`);
    res.json(await listarVisitas(diag.id));
  } catch (e) { next(e); }
});

router.delete('/:id/seguimiento/:visitaId', async (req, res, next) => {
  try {
    const diag = await cargarDiagParaVisita(req, res);
    if (!diag) return;
    const { rows } = await db.query(
      `DELETE FROM seguimiento_visitas WHERE id = $1 AND diagnostico_id = $2 RETURNING to_char(fecha, 'YYYY-MM-DD') AS fecha`,
      [req.params.visitaId, diag.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Visita no encontrada' });
    await registrarHistorial(diag.id, req.user.username, 'Visita de seguimiento eliminada', `Visita del ${fechaAR(rows[0].fecha)}`);
    res.json(await listarVisitas(diag.id));
  } catch (e) { next(e); }
});

module.exports = { router, ensureSchema, listarVisitas };
