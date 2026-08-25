const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const db = require('../db');
const { requireAuth, requireRole } = require('../auth');
const { normalizeCuit } = require('../constants');

const router = express.Router();
router.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

// Encuentra el valor de una fila para alguna variante del nombre de columna
// (mayúsculas, con o sin tilde, etc.), igual que en creditosSigi.js.
function pick(row, ...keys) {
  const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const wanted = keys.map(norm);
  for (const k of Object.keys(row)) {
    if (wanted.includes(norm(k))) return row[k];
  }
  return undefined;
}

function parseMonto(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return v;
  const digits = String(v).replace(/[^\d]/g, '');
  if (!digits) return null;
  const n = Number(digits);
  return isNaN(n) ? null : n;
}

// A partir de Estado/Etapa/Desembolsado, decide en cuál de los 3 estados
// simples cae la consulta: la misma clasificación que usaba el dashboard
// viejo de Google Sheets (consultados / desistidos / desembolsados / en trámite).
function normalizarEstado({ estado, etapa, desembolsado }) {
  const e = String(estado || '').toLowerCase();
  const et = String(etapa || '').toLowerCase();
  const d = String(desembolsado || '').toLowerCase();
  if (e.includes('desembolsad')) return 'Desembolsado';
  if (et.includes('anulad') || d.includes('desist')) return 'Desistido';
  return 'En trámite';
}

// Solo CFI puede importar (mismo criterio que creditos-sigi).
router.post('/import', requireRole('cfi'), (req, res, next) => {
  upload.single('archivo')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    try {
      if (!req.file) return res.status(400).json({ error: 'Falta el archivo Excel' });
      const provincia = String(req.body.provincia || '').trim();
      if (!provincia) return res.status(400).json({ error: 'Falta indicar la provincia de este listado' });

      const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      let importados = 0, sinCuit = 0;
      for (const row of rows) {
        const cuit = normalizeCuit(pick(row, 'CUIT'));
        if (!cuit) { sinCuit++; continue; }

        const estado = String(pick(row, 'Estado') || '').trim();
        const etapa = String(pick(row, 'Etapa') || '').trim();
        const desembolsado = String(pick(row, 'Desembolsado') || '').trim();
        const estadoNormalizado = normalizarEstado({ estado, etapa, desembolsado });

        await db.query(
          `INSERT INTO consultas (cuit, provincia, solicitante, localidad, telefono, email, destino,
             fecha_primer_contacto, monto_credito_ars, estado, etapa, fecha_etapa, observaciones, estado_normalizado)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
           ON CONFLICT (cuit) DO UPDATE SET
             provincia = EXCLUDED.provincia, solicitante = EXCLUDED.solicitante, localidad = EXCLUDED.localidad,
             telefono = EXCLUDED.telefono, email = EXCLUDED.email, destino = EXCLUDED.destino,
             fecha_primer_contacto = EXCLUDED.fecha_primer_contacto, monto_credito_ars = EXCLUDED.monto_credito_ars,
             estado = EXCLUDED.estado, etapa = EXCLUDED.etapa, fecha_etapa = EXCLUDED.fecha_etapa,
             observaciones = EXCLUDED.observaciones, estado_normalizado = EXCLUDED.estado_normalizado,
             imported_at = now()`,
          [
            cuit, provincia,
            String(pick(row, 'Solicitante') || '').trim(),
            String(pick(row, 'Localidad del Proyecto', 'Localidad') || '').trim(),
            String(pick(row, 'Telefono', 'Teléfono') || '').trim(),
            String(pick(row, 'e-mail', 'email', 'Email') || '').trim(),
            String(pick(row, 'Destino') || '').trim(),
            String(pick(row, 'Fecha 1er. Contaco', 'Fecha 1er. Contacto', 'Fecha primer contacto') || '').trim(),
            parseMonto(pick(row, 'Monto Credito', 'Monto Crédito')),
            estado, etapa,
            String(pick(row, 'Fecha Etapa') || '').trim(),
            String(pick(row, 'Observaciones') || '').trim(),
            estadoNormalizado
          ]
        );
        importados++;
      }
      res.json({ importados, sinCuit, totalFilas: rows.length, provincia });
    } catch (e) {
      next(e);
    }
  });
});

router.get('/', async (req, res) => {
  const { rows } = await db.query('SELECT * FROM consultas ORDER BY imported_at DESC');
  res.json(rows);
});

module.exports = router;
