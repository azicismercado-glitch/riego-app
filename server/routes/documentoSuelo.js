const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const db = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();
router.use(requireAuth);

const UPLOAD_ROOT = path.join(__dirname, '..', 'uploads');

// Documento del análisis de suelo (PDF o foto del análisis). Se guarda igual
// que las fotos (en disco, bajo uploads/<id>/), pero la referencia queda
// directo en diagnosticos.data (JSONB) en vez de en una tabla aparte, porque
// es un único archivo por diagnóstico, no varias fotos por slot.
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(UPLOAD_ROOT, String(req.params.id));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    cb(null, `analisis-suelo-${Date.now()}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!/^(image\/|application\/pdf)/.test(file.mimetype)) return cb(new Error('Solo se permiten imágenes o PDF'));
    cb(null, true);
  }
});

async function canEditDiag(id, req) {
  const { rows } = await db.query('SELECT doc_status FROM diagnosticos WHERE id = $1', [id]);
  if (!rows[0]) return false;
  return req.user.role === 'tecnico' && rows[0].doc_status === 'borrador';
}

router.post('/:id/documento-suelo', (req, res, next) => {
  upload.single('archivo')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    try {
      const { id } = req.params;
      if (!(await canEditDiag(id, req))) return res.status(403).json({ error: 'El diagnóstico está bloqueado para edición.' });
      if (!req.file) return res.status(400).json({ error: 'Falta el archivo' });

      const { rows } = await db.query('SELECT data FROM diagnosticos WHERE id = $1', [id]);
      if (!rows[0]) return res.status(404).json({ error: 'No encontrado' });

      const prev = rows[0].data.analisisSueloArchivo;
      if (prev && prev.filename) {
        fs.unlink(path.join(UPLOAD_ROOT, id, prev.filename), () => {});
      }

      const archivo = {
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        url: `/uploads/${id}/${req.file.filename}`
      };
      const newData = { ...rows[0].data, analisisSueloArchivo: archivo };
      await db.query('UPDATE diagnosticos SET data = $1, updated_at = now() WHERE id = $2', [newData, id]);
      res.status(201).json({ ok: true, archivo });
    } catch (e) {
      next(e);
    }
  });
});

router.delete('/:id/documento-suelo', async (req, res) => {
  try {
    const { id } = req.params;
    if (!(await canEditDiag(id, req))) return res.status(403).json({ error: 'El diagnóstico está bloqueado para edición.' });
    const { rows } = await db.query('SELECT data FROM diagnosticos WHERE id = $1', [id]);
    if (!rows[0]) return res.status(404).json({ error: 'No encontrado' });
    const prev = rows[0].data.analisisSueloArchivo;
    if (prev && prev.filename) fs.unlink(path.join(UPLOAD_ROOT, id, prev.filename), () => {});
    const newData = { ...rows[0].data };
    delete newData.analisisSueloArchivo;
    await db.query('UPDATE diagnosticos SET data = $1, updated_at = now() WHERE id = $2', [newData, id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
