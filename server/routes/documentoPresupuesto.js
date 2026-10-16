const express = require('express');
const multer = require('multer');
const path = require('path');
const db = require('../db');
const { requireAuth } = require('../auth');
const { subirBuffer, borrar, configured } = require('../cloudinary');

const router = express.Router();
router.use(requireAuth);
router.param('id', require('../access').requireDiagnosticoVisible);

// Archivo de presupuesto estimado (PDF o foto) para cuando el productor ya
// tiene el presupuesto armado y no hace falta cargarlo ítem por ítem. Mismo
// esquema que documentoSuelo.js: se sube a Cloudinary y la referencia queda
// en diagnosticos.data (JSONB), no en una tabla aparte.
const upload = multer({
  storage: multer.memoryStorage(),
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

router.post('/:id/documento-presupuesto', (req, res, next) => {
  upload.single('archivo')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    try {
      if (!configured()) return res.status(500).json({ error: 'El almacenamiento de archivos no está configurado (falta CLOUDINARY_URL).' });
      const { id } = req.params;
      if (!(await canEditDiag(id, req))) return res.status(403).json({ error: 'El diagnóstico está bloqueado para edición.' });
      if (!req.file) return res.status(400).json({ error: 'Falta el archivo' });

      const { rows } = await db.query('SELECT data FROM diagnosticos WHERE id = $1', [id]);
      if (!rows[0]) return res.status(404).json({ error: 'No encontrado' });

      const prev = rows[0].data.presupuestoArchivo;
      if (prev && prev.filename) borrar(prev.filename).catch(() => {});

      const esImagen = /^image\//.test(req.file.mimetype);
      const ext = esImagen ? '' : (path.extname(req.file.originalname) || '.pdf');
      const publicId = `presupuesto-${Date.now()}${ext}`;
      const subida = await subirBuffer(req.file.buffer, { folder: `riego-app/${id}`, publicId, mimetype: req.file.mimetype });

      const archivo = {
        filename: subida.public_id,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        url: subida.secure_url
      };
      const newData = { ...rows[0].data, presupuestoArchivo: archivo };
      await db.query('UPDATE diagnosticos SET data = $1, updated_at = now() WHERE id = $2', [newData, id]);
      res.status(201).json({ ok: true, archivo });
    } catch (e) {
      next(e);
    }
  });
});

router.delete('/:id/documento-presupuesto', async (req, res) => {
  try {
    const { id } = req.params;
    if (!(await canEditDiag(id, req))) return res.status(403).json({ error: 'El diagnóstico está bloqueado para edición.' });
    const { rows } = await db.query('SELECT data FROM diagnosticos WHERE id = $1', [id]);
    if (!rows[0]) return res.status(404).json({ error: 'No encontrado' });
    const prev = rows[0].data.presupuestoArchivo;
    if (prev && prev.filename) borrar(prev.filename).catch(() => {});
    const newData = { ...rows[0].data };
    delete newData.presupuestoArchivo;
    await db.query('UPDATE diagnosticos SET data = $1, updated_at = now() WHERE id = $2', [newData, id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
