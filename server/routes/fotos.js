const express = require('express');
const multer = require('multer');
const db = require('../db');
const { requireAuth } = require('../auth');
const { subirBuffer, borrar, configured } = require('../cloudinary');

const router = express.Router();
router.use(requireAuth);
router.param('id', require('../access').requireDiagnosticoVisible);

// En memoria (no en disco): el archivo se sube directo a Cloudinary desde el
// buffer, sin pasar por el disco del servidor (que se borra en cada redeploy).
const upload = multer({
  storage: multer.memoryStorage(),
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
      if (!configured()) return res.status(500).json({ error: 'El almacenamiento de archivos no está configurado (falta CLOUDINARY_URL).' });
      const { id, slotIndex } = req.params;
      if (!(await canEditDiag(id, req))) return res.status(403).json({ error: 'El diagnóstico está bloqueado para edición.' });
      if (!req.file) return res.status(400).json({ error: 'Falta el archivo "foto"' });

      const { rows: existing } = await db.query('SELECT filename FROM fotos WHERE diagnostico_id = $1 AND slot_index = $2', [id, slotIndex]);
      if (existing[0] && existing[0].filename) borrar(existing[0].filename, 'image').catch(() => {});

      const publicId = `slot-${slotIndex}-${Date.now()}`;
      const subida = await subirBuffer(req.file.buffer, { folder: `riego-app/${id}/fotos`, publicId, mimetype: req.file.mimetype });

      const lat = req.body.lat ? Number(req.body.lat) : null;
      const lng = req.body.lng ? Number(req.body.lng) : null;
      const { rows } = await db.query(
        `INSERT INTO fotos (diagnostico_id, slot_index, filename, mimetype, lat, lng, url)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (diagnostico_id, slot_index) DO UPDATE SET
           filename = EXCLUDED.filename, mimetype = EXCLUDED.mimetype, lat = EXCLUDED.lat, lng = EXCLUDED.lng, url = EXCLUDED.url, created_at = now()
         RETURNING *`,
        [id, slotIndex, subida.public_id, req.file.mimetype, lat, lng, subida.secure_url]
      );
      await db.query('UPDATE diagnosticos SET updated_at = now() WHERE id = $1', [id]);
      res.status(201).json({ ...rows[0], url: subida.secure_url });
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
    if (rows[0].filename) borrar(rows[0].filename, 'image').catch(() => {});
    await db.query('DELETE FROM fotos WHERE diagnostico_id = $1 AND slot_index = $2', [id, slotIndex]);
    await db.query('UPDATE diagnosticos SET updated_at = now() WHERE id = $1', [id]);
  }
  res.json({ ok: true });
});

module.exports = router;
