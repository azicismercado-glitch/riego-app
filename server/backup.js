require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('./db');

// Orden por dependencias de FK (no es obligatorio para el backup, pero así
// el restore puede insertar en el mismo orden sin líos de referencias).
const TABLES = ['users', 'diagnosticos', 'signatures', 'historial', 'fotos', 'emails', 'creditos_sigi', 'consultas'];

async function backup() {
  const outDir = process.argv[2] || path.join(__dirname, '..', 'backups', `backup-${new Date().toISOString().slice(0, 10)}`);
  fs.mkdirSync(outDir, { recursive: true });

  const counts = {};
  for (const table of TABLES) {
    const { rows } = await pool.query(`SELECT * FROM ${table} ORDER BY id`);
    fs.writeFileSync(path.join(outDir, `${table}.json`), JSON.stringify(rows, null, 2));
    counts[table] = rows.length;
    console.log(`${table}: ${rows.length} fila(s)`);
  }
  fs.writeFileSync(
    path.join(outDir, '_meta.json'),
    JSON.stringify({ exportedAt: new Date().toISOString(), counts }, null, 2)
  );

  console.log('\nBackup guardado en:', outDir);
  console.log('\nOJO: esto respalda la BASE DE DATOS (todas las tablas). NO incluye los');
  console.log('archivos de fotos en server/uploads/ — esos hay que respaldarlos aparte.');
  await pool.end();
}

backup().catch((err) => {
  console.error('Error al hacer el backup:', err);
  process.exit(1);
});
