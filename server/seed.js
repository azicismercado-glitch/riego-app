require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./db');
const { emptyData } = require('./constants');
const { generateConformidadDraft } = require('./informe');

const DEMO_USERS = [
  { username: 'aperez', password: '1234', role: 'tecnico', nombre: 'Ana Pérez', rol_label: 'Técnico de campo', email: 'aperez@dgi.mendoza.gov.ar' },
  { username: 'mgomez', password: '1234', role: 'provincia', nombre: 'Mario Gómez', rol_label: 'Responsable provincial', email: 'mgomez@mendoza.gov.ar' },
  { username: 'lcosta', password: '1234', role: 'cfi', nombre: 'Lucas Costa', rol_label: 'Técnico CFI', email: 'lcosta@cfi.org.ar' }
];

const SIG_PLACEHOLDER_SVG = `<svg viewBox="0 0 200 60" xmlns="http://www.w3.org/2000/svg"><path d="M10 40 Q 30 10, 50 35 T 90 30 Q 110 45, 130 20 T 190 25" fill="none" stroke="#2F5238" stroke-width="2" stroke-linecap="round"/></svg>`;

function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h).toString(16).padStart(8, '0') + Math.abs((h * 2654435761) | 0).toString(16).padStart(8, '0');
}

async function seedUsers() {
  const ids = {};
  for (const u of DEMO_USERS) {
    const hash = await bcrypt.hash(u.password, 10);
    const { rows } = await db.query(
      `INSERT INTO users (username, password_hash, role, nombre, rol_label, email)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash
       RETURNING id, role`,
      [u.username, hash, u.role, u.nombre, u.rol_label, u.email]
    );
    ids[u.role] = rows[0].id;
  }
  return ids;
}

async function seedDiagnosticoVacio(tecnicoId) {
  const data = emptyData();
  const { rows } = await db.query(
    `INSERT INTO diagnosticos (data, doc_status, created_by) VALUES ($1,'borrador',$2) RETURNING id`,
    [data, tecnicoId]
  );
  const id = rows[0].id;
  await db.query(
    `INSERT INTO historial (diagnostico_id, usuario, evento, detalle, tipo) VALUES ($1,$2,$3,$4,$5)`,
    [id, 'aperez', 'Diagnóstico creado', 'Pendiente de relevamiento en campo', 'ok']
  );
  console.log('Diagnóstico vacío de ejemplo creado, id =', id);
}

async function seedDiagnosticoChamula(tecnicoId) {
  const data = {
    ...emptyData(),
    productor: 'Paola Chamula', finca: 'Villa Bonita 2', renspa: 'CCPP 3140-0129', localidad: 'La Escandinava, General Alvear',
    superficieTotal: '20', superficieCultivada: '18', superficieInculta: '2', superficieDerecho: '19',
    ccpp: '3140-0129 (19 ha)', pozos: '1 perforación de 140 m, cañería 12"/10"',
    cultivos: [
      { cultivo: 'Vid', variedad: 'Red Globe (parral) y criollas (espaldero)', destino: 'Consumo/industria', anio: '', marco: '', superficie: '12', conduccion: 'Parral/espaldero', rendimiento: '' },
      { cultivo: 'Membrillo', variedad: 'INTA 147', destino: 'Industria', anio: '', marco: '', superficie: '3', conduccion: '', rendimiento: '' },
      { cultivo: 'Ciruelo', variedad: "D'Agen", destino: 'Industria', anio: '', marco: '', superficie: '3', conduccion: '', rendimiento: '' }
    ],
    analisisSuelo: 'No posee', textura: 'Franco a franco arenosa (estimada)',
    problemasSuelo: 'Pérdidas por infiltración asociadas a hijuelas sin impermeabilizar y textura franco arenosa',
    sistemasPresentes: ['Surcos', 'Melgas'],
    rsFuente: 'Turno', rsSuperficie: '18', rsProblemas: 'Baja eficiencia de aplicación del riego superficial por turnado (del orden del 60%). Exposición de cultivos a heladas.',
    rsInfraestructura: 'Distribución por turnado e hijuelas sin impermeabilizar, complementado con agua subterránea',
    represa: 'No posee', medicionCaudales: 'No realiza', asistenciaTecnica: 'Posee', personalRiego: ['Propietario/familiar'],
    descripcionMejora: 'Sustituir el riego superficial por riego presurizado por goteo, incorporar defensa activa contra heladas y mejorar la disponibilidad energética mediante generación solar',
    objetivosMejora: 'Incrementar eficiencia de aplicación del 60% al 90%. Mitigar daño por heladas. Reducir consumo de energía convencional.',
    materialesMejora: 'Incorporación de riego presurizado por goteo en 19,1 ha\nSistema de defensa activa contra heladas por aspersión sub-arbórea en 11,1 ha\nConstrucción e impermeabilización de reservorio (geomembrana) y cabezal de riego\nGeneración solar fotovoltaica (kit on-grid y paneles) para el bombeo',
    indicadoresMejora: 'Incrementar la eficiencia de aplicación del 60% al 90%\nCoeficiente de uniformidad del orden del 85% en el sector presurizado\nReducir pérdidas por escurrimiento e infiltración\nMitigar el daño por heladas\nReducir el consumo de energía convencional',
    cronogramaEtapas: 'Reservorio, cabezal, red de goteo, defensa contra heladas y sistema solar — sujeto a disponibilidad de turno tras la corta invernal',
    tiempoTotalMeses: '6',
    presupuesto: [{ inversion: 'Tecnificación integral (goteo + antiheladas + reservorio + solar)', monto: 'USD 293.827,10 + IVA' }],
    responsableSeguimiento: 'Equipo Técnico DGI', metodosControl: 'Evaluación de eficiencia previa y posterior. Visita técnica de verificación.', periodicidad: '3 visitas anuales'
  };
  const informe = generateConformidadDraft(data);

  const { rows } = await db.query(
    `INSERT INTO diagnosticos (data, doc_status, informe_conformidad, created_by)
     VALUES ($1,'firmado_cfi',$2,$3) RETURNING id`,
    [data, informe, tecnicoId]
  );
  const id = rows[0].id;

  const firmas = [
    ['tecnico', 'aperez', '2026-06-12 10:42:00-03', 'Lat -34.97, Long -67.69', false, ''],
    ['provincia', 'mgomez', '2026-06-17 09:15:00-03', 'Lat -32.89, Long -68.84', false, ''],
    ['cfi', 'lcosta', '2026-06-23 14:30:00-03', 'CABA (oficina CFI)', true,
      'Complementar en la próxima versión del DTR: análisis de suelo de laboratorio; aclarar unidad del componente solar (kWp expresa potencia, no energía anual); corregir campo "sistemas de riego presentes" (el goteo corresponde a la mejora proyectada, no al sistema actual).']
  ];
  for (const [role, usuario, ts, geo, conObs, obs] of firmas) {
    const hash = simpleHash(JSON.stringify(data) + role + ts);
    await db.query(
      `INSERT INTO signatures (diagnostico_id, role, usuario, ts, geo, hash, signature_image, con_observaciones, observaciones, informe)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [id, role, usuario, ts, geo, hash, SIG_PLACEHOLDER_SVG, conObs, obs, role === 'cfi' ? informe : null]
    );
  }

  const hist = [
    ['2026-06-10 16:20:00-03', 'aperez', 'Diagnóstico creado', 'Relevamiento en finca Villa Bonita 2', 'ok'],
    ['2026-06-12 10:42:00-03', 'aperez', 'Firmado por Técnico de campo', 'Identidad reautenticada', 'ok'],
    ['2026-06-17 09:15:00-03', 'mgomez', 'Validado y firmado por Responsable provincial', 'Sin observaciones', 'ok'],
    ['2026-06-23 14:28:00-03', 'lcosta', 'Borrador de Conformidad Técnica generado', 'Generación automática desde datos del DTR', 'ok'],
    ['2026-06-23 14:30:00-03', 'lcosta', 'Validado y firmado por Técnico CFI', 'Con observaciones sujetas a complementación', 'warn']
  ];
  for (const [ts, usuario, evento, detalle, tipo] of hist) {
    await db.query(
      `INSERT INTO historial (diagnostico_id, ts, usuario, evento, detalle, tipo) VALUES ($1,$2,$3,$4,$5,$6)`,
      [id, ts, usuario, evento, detalle, tipo]
    );
  }
  console.log('Diagnóstico de ejemplo "Villa Bonita 2" (firmado completo) creado, id =', id);
}

async function main() {
  const ids = await seedUsers();
  console.log('Usuarios demo creados/actualizados:', DEMO_USERS.map((u) => u.username).join(', '));
  await seedDiagnosticoChamula(ids.tecnico);
  await seedDiagnosticoVacio(ids.tecnico);
  await db.pool.end();
}

main().catch((err) => {
  console.error('Error al sembrar datos:', err);
  process.exit(1);
});
