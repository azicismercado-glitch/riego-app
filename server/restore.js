require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('./db');

// Mismo orden que backup.js: primero las tablas sin dependencias (users),
// después las que referencian diagnosticos, al final las independientes.
const TABLES = ['users', 'diagnosticos', 'signatures', 'historial', 'fotos', 'emails', 'creditos_sigi', 'consultas'];

async function restoreTable(table, dir) {
  const file = path.join(dir, `${table}.json`);
  if (!fs.existsSync(file)) {
    console.log(`(sin backup para "${table}", se omite)`);
    return;
  }
  const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!rows.length) {
    console.log(`${table}: 0 filas en el backup, nada para restaurar`);
    return;
  }
  const cols = Object.keys(rows[0]);
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(',');
  let restored = 0;
  for (const row of rows) {
    const values = cols.map((c) => row[c]);
    const { rowCount } = await pool.query(
      `INSERT INTO ${table} (${cols.join(',')}) VALUES (${placeholders}) ON CONFLICT (id) DO NOTHING`,
      values
    );
    restored += rowCount;
  }
  // Reacomoda la secuencia de autoincremento para que el próximo INSERT sin
  // id explícito (uso normal de la app) no choque con los ids restaurados.
  await pool.query(
    `SELECT setval(pg_get_serial_sequence('${table}','id'), COALESCE((SELECT MAX(id) FROM ${table}), 1))`
  );
  console.log(`${table}: ${restored} de ${rows.length} fila(s) restauradas (las repetidas se omiten con ON CONFLICT DO NOTHING)`);
}

async function restore() {
  const dir = process.argv[2];
  if (!dir) {
    console.error('Uso: node server/restore.js <carpeta-del-backup>');
    console.error('Ej:  node server/restore.js ../riego-app-db-backups/backup-2026-09-14');
    process.exit(1);
  }
  if (!fs.existsSync(dir)) {
    console.error('No existe la carpeta:', dir);
    process.exit(1);
  }
  console.log('Restaurando desde:', dir);
  console.log('Corré esto contra una base recién migrada (npm run migrate) para que existan las tablas.\n');

  for (const table of TABLES) {
    await restoreTable(table, dir);
  }

  console.log('\nRestore completo.');
  console.log('OJO: esto restaura la BASE DE DATOS. Las fotos de server/uploads/ (si las');
  console.log('tenías respaldadas aparte) hay que copiarlas a mano a la carpeta nueva.');
  await pool.end();
}

restore().catch((err) => {
  console.error('Error al restaurar:', err);
  process.exit(1);
});
