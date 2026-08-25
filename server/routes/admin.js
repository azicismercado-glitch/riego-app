// Rutas de "mantenimiento" pensadas para usarse UNA VEZ desde el navegador,
// sin necesidad de terminal ni Node instalado localmente. Protegidas por una
// clave (ADMIN_SETUP_KEY) que se configura como variable de entorno en Render.
// Son seguras de ejecutar más de una vez (no duplican nada).
const express = require('express');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('../db');

const router = express.Router();

function checkKey(req, res) {
  const key = req.query.key || req.headers['x-admin-key'];
  if (!process.env.ADMIN_SETUP_KEY) {
    res.status(500).json({ error: 'Falta configurar ADMIN_SETUP_KEY en las variables de entorno del servicio.' });
    return false;
  }
  if (key !== process.env.ADMIN_SETUP_KEY) {
    res.status(403).json({ error: 'Clave inválida.' });
    return false;
  }
  return true;
}

// Aplica db/schema.sql contra la base actual (crea tablas/columnas que falten).
router.get('/migrate', async (req, res) => {
  if (!checkKey(req, res)) return;
  try {
    const sql = fs.readFileSync(path.join(__dirname, '..', '..', 'db', 'schema.sql'), 'utf8');
    await db.query(sql);
    res.json({ ok: true, mensaje: 'Esquema aplicado correctamente. Ya podés cerrar esta pestaña.' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Crea/actualiza los usuarios de solo lectura (invitado / creditos).
router.get('/seed-lectores', async (req, res) => {
  if (!checkKey(req, res)) return;
  try {
    const USERS = [
      { username: 'invitado', password: '1234', role: 'lector', nombre: 'Invitado', rol_label: 'Solo lectura', email: 'invitado@cfi.org.ar' },
      { username: 'creditos', password: '1234', role: 'lector', nombre: 'Área de Créditos', rol_label: 'Solo lectura', email: 'creditos@cfi.org.ar' }
    ];
    for (const u of USERS) {
      const hash = await bcrypt.hash(u.password, 10);
      await db.query(
        `INSERT INTO users (username, password_hash, role, nombre, rol_label, email)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role`,
        [u.username, hash, u.role, u.nombre, u.rol_label, u.email]
      );
    }
    res.json({ ok: true, mensaje: 'Usuarios invitado/creditos listos. Ya podés cerrar esta pestaña.' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
