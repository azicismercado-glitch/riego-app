// Script chico y seguro de re-ejecutar: solo crea/actualiza los usuarios de
// solo lectura, sin tocar ni duplicar los diagnósticos ya cargados. Se usa
// para agregar los usuarios "invitado"/"creditos" a una base que ya estaba
// sembrada (por ejemplo, la de producción o la de riego-app-beta en Render).
require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./db');

const USERS = [
  { username: 'invitado', password: '1234', role: 'lector', nombre: 'Invitado', rol_label: 'Solo lectura', email: 'invitado@cfi.org.ar' },
  { username: 'creditos', password: '1234', role: 'lector', nombre: 'Área de Créditos', rol_label: 'Solo lectura', email: 'creditos@cfi.org.ar' }
];

async function main() {
  for (const u of USERS) {
    const hash = await bcrypt.hash(u.password, 10);
    await db.query(
      `INSERT INTO users (username, password_hash, role, nombre, rol_label, email)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role`,
      [u.username, hash, u.role, u.nombre, u.rol_label, u.email]
    );
    console.log('Usuario lector listo:', u.username);
  }
  await db.pool.end();
}

main().catch((err) => {
  console.error('Error al crear usuarios lectores:', err);
  process.exit(1);
});
