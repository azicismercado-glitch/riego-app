require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./db');
const { emptyData, emptyIndicadores } = require('./constants');

// Cada técnico y cada responsable provincial atiende UNA sola provincia —
// por eso la provincia de un diagnóstico se deduce de quién lo creó (ver
// dashboard.js), no se carga a mano en cada formulario. Roles nacionales
// (cfi, lector) quedan sin provincia.
//
// Usuarios de DEMOSTRACIÓN con contraseña trivial: solo para desarrollo/pruebas.
// Una implementación real debe crear sus propios usuarios con contraseñas propias.
const DEMO_USERS = [
  { username: 'aperez', password: '1234', role: 'tecnico', nombre: 'Técnico Demo', rol_label: 'Técnico de campo', email: 'tecnico@example.org', provincia: 'Mendoza' },
  { username: 'mgomez', password: '1234', role: 'provincia', nombre: 'Responsable Provincial Demo', rol_label: 'Responsable provincial', email: 'provincia@example.org', provincia: 'Mendoza' },
  { username: 'lcosta', password: '1234', role: 'cfi', nombre: 'Técnico CFI Demo', rol_label: 'Técnico CFI', email: 'cfi@example.org', provincia: null },
  // Usuarios de solo lectura: pueden ver el listado, cada diagnóstico y el panel,
  // pero no pueden crear, editar ni firmar nada (queda bloqueado automáticamente
  // porque esos permisos están atados a los roles tecnico/provincia/cfi).
  { username: 'invitado', password: '1234', role: 'lector', nombre: 'Invitado', rol_label: 'Solo lectura', email: 'invitado@example.org', provincia: null },
  { username: 'creditos', password: '1234', role: 'lector', nombre: 'Área de Créditos', rol_label: 'Solo lectura', email: 'creditos@example.org', provincia: null }
];

async function seedUsers() {
  const ids = {};
  for (const u of DEMO_USERS) {
    const hash = await bcrypt.hash(u.password, 10);
    const { rows } = await db.query(
      `INSERT INTO users (username, password_hash, role, nombre, rol_label, email, provincia)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, provincia = EXCLUDED.provincia
       RETURNING id, role`,
      [u.username, hash, u.role, u.nombre, u.rol_label, u.email, u.provincia]
    );
    ids[u.role] = rows[0].id;
  }
  return ids;
}

// ---------------------------------------------------------------------------
// Diagnósticos de EJEMPLO (datos ficticios, no corresponden a productores
// reales) para poder probar el circuito completo: formulario, panel y firmas.
//
// Los montos se cargan en pesos en el campo numérico "montoUSD" (nombre
// heredado de una versión anterior en dólares; hoy contiene PESOS). El campo
// de texto "monto" queda libre para aclaraciones.
// ---------------------------------------------------------------------------
function diag(overrides) {
  return { ...emptyData(), ...overrides };
}

const DIAGNOSTICOS = [
  diag({
    productor: 'Productor Ejemplo Uno',
    finca: 'Finca Ejemplo Uno',
    renspa: '00.000.0.00000/00',
    localidad: 'Localidad Ejemplo, Departamento A',
    superficieTotal: '40',
    superficieCultivada: '30',
    superficieInculta: '10',
    superficieBajoRiego: '30',
    superficieDerecho: '35',
    fuenteRiegoDerecho: 'Río',
    cultivos: [
      { cultivo: 'Vid', variedad: 'Malbec', destino: 'Industria', anio: '2005', marco: '2,5 x 1,5 m', superficie: '30', rendimiento: '12000', rendimientoUnidad: 'Kg/ha' }
    ],
    tipoProduccion: 'Agricultura',
    analisisSuelo: 'No posee',
    textura: 'Franco arenoso',
    problemasSuelo: 'Sin problemas visibles.',
    tipoRiegoGeneral: 'Gravitacional',
    sistemasPresentes: ['Surcos'],
    rsFuente: 'Turno',
    rsSuperficie: '30',
    rsCaudal: '40',
    rsFrecTurnado: '14',
    rsDuracionTurnado: '12',
    rsCantTurnos: '20',
    rsMetodoDecision: 'Cuando le entregan el agua',
    rsFormaRegar: 'Surco con desagüe al pie',
    rsTieneInfraDerivar: 'Sí',
    rsInfraDerivarItems: ['Marcos y compuertas'],
    rsProblemas: 'Baja eficiencia de aplicación por desnivel del terreno.',
    represa: 'No posee',
    medicionCaudales: 'No realiza',
    asistenciaTecnica: 'No posee',
    personalRiego: ['Propietario/familiar'],
    problemasFrecuentesItems: ['Falta de turnos de agua'],
    limitantesItems: ['Falta de financiamiento'],
    interesMejoras: 'Sí',
    tipoMejoraInteres: 'Riego por goteo',
    descripcionMejora: 'Reconversión de riego por surcos a riego por goteo en 30 ha de vid, con cabezal de filtrado y bombeo desde reservorio.',
    cambioPropuestoItems: ['Cambio a riego presurizado'],
    objetivosMejora: 'Mejorar la eficiencia de aplicación.\nReducir el consumo de agua por hectárea.',
    problemaJustificacionItems: ['Baja eficiencia de aplicación'],
    materiales: [
      { item: 'Cabezal de filtrado', cantidad: '1', unidad: 'global', obs: '' },
      { item: 'Cinta de goteo', cantidad: '30000', unidad: 'm', obs: '' }
    ],
    indicadores: emptyIndicadores().map((i, n) => n === 0 ? { ...i, actual: '45', proyectada: '85' } : i),
    tiempoTotalMeses: '6',
    presupuesto: [
      { inversion: 'Sistema de riego por goteo (30 ha)', codN1: 'D', codN2: 'D01', tipo: 'D — Aplicación – Riego presurizado', monto: 'Monto ficticio de ejemplo', montoUSD: 45000000, superficieAsociada: '30' }
    ],
    responsableSeguimiento: 'Responsable Ejemplo',
    metodosControl: ['Visita técnica a campo'],
    periodicidad: 'Anual'
  }),

  diag({
    productor: 'Productor Ejemplo Dos',
    finca: 'Finca Ejemplo Dos',
    renspa: '00.000.0.00001/00',
    localidad: 'Localidad Ejemplo, Departamento B',
    superficieTotal: '120',
    superficieCultivada: '90',
    superficieInculta: '30',
    superficieBajoRiego: '90',
    superficieDerecho: '100',
    fuenteRiegoDerecho: 'Subterránea (pozo)',
    cultivos: [
      { cultivo: 'Alfalfa', variedad: '', destino: 'Consumo', anio: '2022', marco: '', superficie: '90', rendimiento: '18000', rendimientoUnidad: 'Materia seca/ha' }
    ],
    tipoProduccion: 'Agricultura',
    analisisSuelo: 'Posee',
    anioAnalisisSuelo: '2025',
    textura: 'Franco',
    problemasSuelo: 'Sin problemas visibles.',
    tipoRiegoGeneral: 'Presurizado',
    sistemasPresentes: ['Aspersión'],
    rpFuente: 'Pozo',
    rpSuperficie: '90',
    rpCaudal: '5',
    rpFrecuencia: '3',
    rpDuracion: '10',
    rpTieneCaudalimetro: 'Sí',
    rpSistemaFiltrado: 'Automático',
    rpProblemas: 'Alto costo energético del bombeo.',
    represa: 'Posee',
    volumenRepresa: '20000',
    medicionCaudales: 'Realiza',
    metodoMedicion: 'Caudalímetro',
    asistenciaTecnica: 'Posee',
    personalRiego: ['Empleado'],
    problemasFrecuentesItems: ['Energía'],
    limitantesItems: ['Falta de financiamiento'],
    interesMejoras: 'Sí',
    tipoMejoraInteres: 'Energía solar para bombeo',
    descripcionMejora: 'Instalación de un sistema de bombeo solar fotovoltaico para reducir el costo energético del riego por aspersión.',
    cambioPropuestoItems: ['Incorporación de equipo de bombeo/filtrado'],
    objetivosMejora: 'Reducir el costo energético por volumen bombeado.',
    problemaJustificacionItems: ['Baja eficiencia de aplicación'],
    materiales: [
      { item: 'Paneles fotovoltaicos', cantidad: '120', unidad: 'un.', obs: '' }
    ],
    indicadores: emptyIndicadores().map((i, n) => n === 5 ? { ...i, actual: '0', proyectada: '60' } : i),
    tiempoTotalMeses: '4',
    presupuesto: [
      { inversion: 'Bombeo solar fotovoltaico', codN1: 'F', codN2: 'F01', tipo: 'F — Energía y eficiencia energética', monto: 'Monto ficticio de ejemplo', montoUSD: 80000000, superficieAsociada: '90' }
    ],
    responsableSeguimiento: 'Responsable Ejemplo',
    metodosControl: ['Auditoría de avance de obras'],
    periodicidad: 'Trimestral'
  })
];

async function wipeDiagnosticos() {
  // OJO: borra TODOS los diagnósticos existentes (y en cascada sus firmas,
  // historial y fotos). Es solo para una base de pruebas vacía: NUNCA correr
  // este seed contra una base con datos reales.
  await db.query('DELETE FROM diagnosticos');
  console.log('Diagnósticos previos eliminados.');
}

async function seedDiagnosticos(tecnicoId) {
  for (const data of DIAGNOSTICOS) {
    const { rows } = await db.query(
      `INSERT INTO diagnosticos (data, doc_status, created_by) VALUES ($1,'borrador',$2) RETURNING id`,
      [data, tecnicoId]
    );
    const id = rows[0].id;
    await db.query(
      `INSERT INTO historial (diagnostico_id, usuario, evento, detalle, tipo)
       VALUES ($1,'aperez','Diagnóstico creado','Datos de ejemplo','ok')`,
      [id]
    );
    console.log('Diagnóstico de ejemplo cargado:', data.productor, '/', data.finca, '→ id', id);
  }
}

async function main() {
  const ids = await seedUsers();
  console.log('Usuarios creados/actualizados:', DEMO_USERS.map((u) => u.username).join(', '));
  await wipeDiagnosticos();
  await seedDiagnosticos(ids.tecnico);
  await db.pool.end();
}

main().catch((err) => {
  console.error('Error al sembrar datos:', err);
  process.exit(1);
});
