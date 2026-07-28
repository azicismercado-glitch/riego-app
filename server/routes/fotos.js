const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const db = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();
router.use(requireAuth);

const UPLOAD_ROOT = path.join(__dirname, '..', 'uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(UPLOAD_ROOT, String(req.params.id));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `slot-${req.params.slotIndex}-${Date.now()}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!/^image\//.test(file.mimetype)) return cb(new Error('Solo se permiten imágenes'));
    cb(null, true);
  }
});

async function canEditDiag(id, req) {
  const { rows } = await db.query('SELECT doc_status FROM diagnosticos WHERE id = $1', [id]);
  if (!rows[0]) return false;
  return req.user.role === 'tecnico' && rows[0].doc_status === 'borrador';
}

router.post('/:id/fotos/:slotIndex', (req, res, next) => {
  upload.single('foto')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    try {
      const { id, slotIndex } = req.params;
      if (!(await canEditDiag(id, req))) return res.status(403).json({ error: 'El diagnóstico está bloqueado para edición.' });
      if (!req.file) return res.status(400).json({ error: 'Falta el archivo "foto"' });

      const { rows: existing } = await db.query('SELECT filename FROM fotos WHERE diagnostico_id = $1 AND slot_index = $2', [id, slotIndex]);
      if (existing[0]) {
        const oldPath = path.join(UPLOAD_ROOT, id, existing[0].filename);
        fs.unlink(oldPath, () => {});
      }

      const lat = req.body.lat ? Number(req.body.lat) : null;
      const lng = req.body.lng ? Number(req.body.lng) : null;
      const { rows } = await db.query(
        `INSERT INTO fotos (diagnostico_id, slot_index, filename, mimetype, lat, lng)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (diagnostico_id, slot_index) DO UPDATE SET
           filename = EXCLUDED.filename, mimetype = EXCLUDED.mimetype, lat = EXCLUDED.lat, lng = EXCLUDED.lng, created_at = now()
         RETURNING *`,
        [id, slotIndex, req.file.filename, req.file.mimetype, lat, lng]
      );
      await db.query('UPDATE diagnosticos SET updated_at = now() WHERE id = $1', [id]);
      res.status(201).json({ ...rows[0], url: `/uploads/${id}/${req.file.filename}` });
    } catch (e) {
      next(e);
    }
  });
});

router.delete('/:id/fotos/:slotIndex', async (req, res) => {
  const { id, slotIndex } = req.params;
  if (!(await canEditDiag(id, req))) return res.status(403).json({ error: 'El diagnóstico está bloqueado para edición.' });
  const { rows } = await db.query('SELECT filename FROM fotos WHERE diagnostico_id = $1 AND slot_index = $2', [id, slotIndex]);
  if (rows[0]) {
    fs.unlink(path.join(UPLOAD_ROOT, id, rows[0].filename), () => {});
    await db.query('DELETE FROM fotos WHERE diagnostico_id = $1 AND slot_index = $2', [id, slotIndex]);
    await db.query('UPDATE diagnosticos SET updated_at = now() WHERE id = $1', [id]);
  }
  res.json({ ok: true });
});

module.exports = router;
