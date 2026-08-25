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

// Encuentra el valor de una fila para alguna de las variantes de nombre de
// columna que pueda traer el Excel exportado desde SIGI (mayúsculas, con o
// sin tilde/barra, etc.)
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
  const digits = String(v).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const n = Number(digits);
  return isNaN(n) ? null : n;
}

// Solo el rol CFI (el que administra el programa) puede importar el archivo
// de créditos que viene de SIGI.
router.post('/import', requireRole('cfi'), (req, res, next) => {
  upload.single('archivo')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    try {
      if (!req.file) return res.status(400).json({ error: 'Falta el archivo Excel' });

      const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      let importados = 0, sinCuit = 0;
      for (const row of rows) {
        const cuitRaw = pick(row, 'CUIT');
        const cuit = normalizeCuit(cuitRaw);
        if (!cuit) { sinCuit++; continue; }

        const expediente = String(pick(row, 'Expediente') || '').trim();
        const titular = String(pick(row, 'Titular', 'Empresa') || '').trim();
        const lineaPrograma = String(pick(row, 'Linea/Programa', 'Línea/Programa', 'Linea', 'Programa') || '').trim();
        const montoArs = parseMonto(pick(row, 'Monto'));
        const desembolso = String(pick(row, 'Desembolso') || '').trim();

        await db.query(
          `INSERT INTO creditos_sigi (cuit, expediente, titular, linea_programa, monto_ars, desembolso)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (cuit) DO UPDATE SET
             expediente = EXCLUDED.expediente, titular = EXCLUDED.titular,
             linea_programa = EXCLUDED.linea_programa, monto_ars = EXCLUDED.monto_ars,
             desembolso = EXCLUDED.desembolso, imported_at = now()`,
          [cuit, expediente, titular, lineaPrograma, montoArs, desembolso]
        );
        importados++;
      }
      res.json({ importados, sinCuit, totalFilas: rows.length });
    } catch (e) {
      next(e);
    }
  });
});

router.get('/', async (req, res) => {
  const { rows } = await db.query('SELECT cuit, expediente, titular, linea_programa, monto_ars, desembolso, imported_at FROM creditos_sigi ORDER BY imported_at DESC');
  res.json(rows);
});

module.exports = router;
