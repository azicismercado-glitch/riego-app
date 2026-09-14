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

// Asigna la provincia de los usuarios existentes (técnico y responsable
// provincial) sin tocar diagnósticos ni ningún otro dato — a diferencia de
// "npm run seed", esta ruta no borra nada. Pensada para el día que se migra
// el campo "provincia" a la tabla users y hay que completarlo en usuarios
// que ya existían.
router.get('/set-provincias', async (req, res) => {
  if (!checkKey(req, res)) return;
  try {
    const ASIGNACIONES = [
      { username: 'aperez', provincia: 'Mendoza' },
      { username: 'mgomez', provincia: 'Mendoza' }
    ];
    const actualizados = [];
    for (const a of ASIGNACIONES) {
      const { rowCount } = await db.query('UPDATE users SET provincia = $1 WHERE username = $2', [a.provincia, a.username]);
      if (rowCount) actualizados.push(`${a.username} → ${a.provincia}`);
    }
    res.json({ ok: true, actualizados, mensaje: 'Provincias asignadas. Ya podés cerrar esta pestaña.' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const ROL_LABELS = { tecnico: 'Técnico de campo', provincia: 'Responsable provincial', cfi: 'Técnico CFI', lector: 'Solo lectura' };
const ROLES_VALIDOS = Object.keys(ROL_LABELS);

// Crea (o actualiza) un usuario puntual — para sumar el técnico/responsable
// provincial de una provincia nueva sin tocar seed.js ni redeployar, y sin
// borrar diagnósticos (a diferencia de correr el seed completo). Segura de
// llamar más de una vez: si el username ya existe, actualiza sus datos en
// vez de duplicarlo.
//
// Uso: /admin/crear-usuario?key=...&username=...&password=...&role=tecnico
//      &nombre=...&email=...&provincia=Río Negro
router.get('/crear-usuario', async (req, res) => {
  if (!checkKey(req, res)) return;
  try {
    const { username, password, role, nombre, email, provincia, rolLabel } = req.query;
    const faltantes = ['username', 'password', 'role', 'nombre', 'email'].filter((k) => !req.query[k]);
    if (faltantes.length) return res.status(400).json({ error: `Faltan parámetros: ${faltantes.join(', ')}` });
    if (!ROLES_VALIDOS.includes(role)) return res.status(400).json({ error: `Rol inválido "${role}". Tiene que ser uno de: ${ROLES_VALIDOS.join(', ')}` });

    const hash = await bcrypt.hash(password, 10);
    const { rows } = await db.query(
      `INSERT INTO users (username, password_hash, role, nombre, rol_label, email, provincia)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (username) DO UPDATE SET
         password_hash = EXCLUDED.password_hash, role = EXCLUDED.role, nombre = EXCLUDED.nombre,
         rol_label = EXCLUDED.rol_label, email = EXCLUDED.email, provincia = EXCLUDED.provincia
       RETURNING id, username, role, nombre, email, provincia`,
      [username, hash, role, nombre, rolLabel || ROL_LABELS[role], email, provincia || null]
    );
    res.json({ ok: true, usuario: rows[0], mensaje: 'Usuario creado/actualizado. Ya podés cerrar esta pestaña.' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
