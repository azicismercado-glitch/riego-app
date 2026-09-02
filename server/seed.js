require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./db');
const { emptyData } = require('./constants');

const DEMO_USERS = [
  { username: 'aperez', password: '1234', role: 'tecnico', nombre: 'Ana Pérez', rol_label: 'Técnico de campo', email: 'aperez@dgi.mendoza.gov.ar' },
  { username: 'mgomez', password: '1234', role: 'provincia', nombre: 'Mario Gómez', rol_label: 'Responsable provincial', email: 'mgomez@mendoza.gov.ar' },
  { username: 'lcosta', password: '1234', role: 'cfi', nombre: 'Lucas Costa', rol_label: 'Técnico CFI', email: 'lcosta@cfi.org.ar' },
  // Usuarios de solo lectura: pueden ver el listado, cada diagnóstico y el panel,
  // pero no pueden crear, editar ni firmar nada (queda bloqueado automáticamente
  // porque esos permisos están atados a los roles tecnico/provincia/cfi).
  { username: 'invitado', password: '1234', role: 'lector', nombre: 'Invitado', rol_label: 'Solo lectura', email: 'invitado@cfi.org.ar' },
  { username: 'creditos', password: '1234', role: 'lector', nombre: 'Área de Créditos', rol_label: 'Solo lectura', email: 'creditos@cfi.org.ar' }
];

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

// ---------------------------------------------------------------------------
// Diagnósticos reales aprobados (Programa de Tecnificación del Riego - Mendoza),
// cargados como carga inicial de la base.
//
// Los presupuestos de los DTR están en USD. Acá se convierten a pesos a una
// cotización de 1 USD = 1535 ARS y se guardan en el campo numérico "montoUSD"
// (que es el que suma el panel — el nombre quedó de la versión anterior, hoy
// contiene PESOS). El texto original en USD se conserva en el campo "monto"
// como aclaración.
// ---------------------------------------------------------------------------
const USD_ARS = 1535;
const usd = (n) => Math.round(n * USD_ARS);

function diag(overrides) {
  return { ...emptyData(), ...overrides };
}

const DIAGNOSTICOS = [
  diag({
    productor: 'Gerardo Meli',
    finca: '',
    renspa: '12.018.0.01600/00',
    localidad: 'San José, Tupungato',
    superficieTotal: '138',
    superficieCultivada: '83,5',
    superficieInculta: '54,5',
    superficieDerecho: '75',
    ccpp: 'Fracción 1) PP 9900 CC 247: 34,6 ha; Fracción 2) PP 9900 CC 106: 1,8 ha; Fracción 3) PP 9900 CC 304: 23,0 ha',
    pozos: '2 pozos: 1) 14.392 y 2) 14.390',
    obsGenerales: 'Derecho precario de desagüe.',
    cultivos: [
      { cultivo: 'Ajo', variedad: '', destino: 'Exportación', anio: '2026', marco: 'Rotación de 12 ha; este año solo 6', superficie: '6', rendimiento: '40000', rendimientoUnidad: 'Kg/ha' },
      { cultivo: 'Durazno', variedad: 'Bowen', destino: 'Exportación', anio: '1996', marco: 'Palmeta', superficie: '', rendimiento: '35000', rendimientoUnidad: 'Kg/ha' },
      { cultivo: 'Durazno', variedad: 'Rizzi - Pavia', destino: 'Exportación', anio: '', marco: '', superficie: '', rendimiento: '20000', rendimientoUnidad: 'Kg/ha' },
      { cultivo: 'Durazno', variedad: 'Klamath', destino: 'Exportación', anio: '2024', marco: '2,50 x 4 m (Ypsilon doble)', superficie: '', rendimiento: '', rendimientoUnidad: '' }
    ],
    obsCultivos: 'Producción de ajo y duraznos orgánicos. Exporta a EEUU durazno congelado y como pulpa.',
    analisisSuelo: 'Posee',
    textura: 'Franco limoso',
    problemasSuelo: 'Suelos con limos en la parte superficial (por aporte de agua de riego) que taponan poros y reducen la velocidad de infiltración. Suelos aluviales heterogéneos, con zonas pedregosas de cauces y baja retención de agua. Pendientes elevadas que generan escurrimiento superficial, incluso en riego por goteo. Derechos de desagüe insuficientes para todos los cultivos.',
    obsSuelo: 'Realiza muchas aplicaciones foliares: sufre compactación por alto tránsito. Trabaja con verdeos en alta densidad (100 kg/ha de centeno y vicia). Problemas con desarrollo de chípica.',
    tipoRiegoGeneral: 'Presurizado',
    sistemasPresentes: ['Goteo'],
    rpFuente: 'Pozo',
    rpSuperficie: 'Toda la superficie de durazno y ajo',
    rpCaudal: '12000',
    rpFrecuencia: 'Todos los días menos domingos',
    rpDuracion: '2',
    rpProblemas: 'Baja velocidad de infiltración, altas pendientes y baja retención de agua en el suelo.',
    rpObservaciones: '3 equipos de riego: uno con 4 operaciones de 6,25 ha c/u, otro con 4 operaciones de 6,25 ha c/u y otro con 2 operaciones (12 ha).',
    represa: 'Posee',
    volumenRepresa: '2 represas',
    medicionCaudales: 'Realiza',
    metodoMedicion: 'Caudalímetros en ambos pozos',
    asistenciaTecnica: 'Posee',
    personalRiego: ['Empleado'],
    obsRiego: 'Posee 2 perforaciones: una activa y otra en refacción (se solicita el reemplazo). Deriva por hijuela/acequia sin impermeabilizar hacia un segundo reservorio junto al segundo pozo e impulsa con booster. En cultivos nuevos usa manguera ciega el primer año y coloca goteros a la distancia de plantación, con microtubos bajo el mulch de polietileno para evitar el escurrimiento. Tiene instalado 1 sensor de riego (Zonda Sentec). Un pozo roto: usa el segundo de forma continua.',
    descripcionMejora: 'Mejorar el abastecimiento de agua mediante el reemplazo de una perforación vieja con problemas de caudal por una nueva. Mejorar la planificación del riego con un estudio de uniformidad de los equipos.',
    objetivosMejora: 'Mejorar la productividad y los rendimientos. Mejorar el uso del agua y la eficiencia de aplicación. Reducir los costos energéticos por volumen bombeado (posibilidad de bombear en baja con dos pozos).',
    materialesMejora: 'Reemplazo de perforación, para garantizar el cumplimiento de la demanda del cultivo (hoy solo cuenta con 1 perforación activa y un derecho de desagüe variable).\nEstudio de uniformidad de los equipos de riego.\nMangueras de riego enterradas para mejorar el uso del agua (etapa posterior, no alcanzada por este financiamiento).',
    indicadoresMejora: 'Eficiencia de aplicación antes/después: aumento del 5 %.\nAumento de la uniformidad de aplicación en un 15 %.\nDisminución de costos por volumen de agua usada: 30 a 40 % de ahorro por bombeo en baja.',
    cronogramaEtapas: 'Adquisición de insumos, instalación, calibración y capacitación.',
    tiempoTotalMeses: '',
    presupuesto: [
      { inversion: 'Reemplazo de la perforación', codN1: 'A', codN2: 'A01', tipo: 'A — Captación y fuente de agua', monto: 'USD 286.000,00 (presupuesto original del DTR)', montoUSD: usd(286000) }
    ],
    responsableSeguimiento: 'Guillermo Cúneo (DGI)',
    metodosControl: 'Evaluación de la eficiencia de riego previa y posterior a la instalación del pozo. Visita técnica para verificación de instalaciones.'
  }),

  diag({
    productor: 'Nicolás Bilan',
    finca: 'Avícola Ave María',
    renspa: '1201505252310',
    localidad: 'Las Paredes, San Rafael',
    superficieTotal: '5,4',
    superficieCultivada: '5,0',
    superficieInculta: '0,4',
    superficieDerecho: '6,0',
    ccpp: '4008-0056',
    pozos: 'No posee',
    cultivos: [
      { cultivo: 'Vid', variedad: 'Cereza / Bonarda', destino: 'Vinificación (Coop. El Cerrito)', anio: '2022', marco: '2,3 x 1,1 m', superficie: '5,0', rendimiento: '', rendimientoUnidad: '' }
    ],
    analisisSuelo: 'No posee',
    textura: 'Franco arenoso',
    problemasSuelo: 'No presenta problemas visibles. En la zona hay presencia de capas hidrosolubles a profundidades variables que pueden provocar el hundimiento eventual del suelo (conocido localmente como "volcanes").',
    tipoRiegoGeneral: 'Presurizado',
    sistemasPresentes: ['Goteo'],
    rpFuente: 'Turno',
    rpSuperficie: '5,0',
    rpCaudal: '30000',
    rpFrecuencia: '2',
    rpDuracion: '8',
    rpProblemas: 'La represa disponible no tiene capacidad de retención ni almacenaje por su precaria impermeabilización.',
    rpObservaciones: 'Cuenta con desarenador al ingreso de la represa y rejillas para evitar el ingreso de materia orgánica en suspensión.',
    represa: 'Posee',
    volumenRepresa: '5600',
    medicionCaudales: 'No realiza',
    asistenciaTecnica: 'Posee',
    personalRiego: ['Propietario/familiar'],
    descripcionMejora: 'Impermeabilizar el reservorio de agua que abastece al riego presurizado (goteo) y al sistema de aspersión antiheladas, mejorando la eficiencia de aplicación del agua en la superficie productiva. Actualmente el reservorio existe pero sin correcta impermeabilización, con lo cual la capacidad de almacenaje se ve reducida a un 20 % del total.',
    objetivosMejora: 'Mejorar la eficiencia de uso del agua. Incrementar el rendimiento y el ingreso por hectárea. Aumentar las alternativas productivas de la finca.',
    materialesMejora: 'Geomembrana de polietileno de alta densidad virgen (PEAD), de 750 micrones de espesor.\nMano de obra para la colocación.',
    indicadoresMejora: 'Eficiencia de almacenaje: utilizar los 6.500 m³ de capacidad total del reservorio en lugar de los 1.300 m³ actuales.\nAumento de productividad: puesta en funcionamiento del control activo de heladas por microaspersión.',
    cronogramaEtapas: 'Mes 1: compra de insumos. Meses 2-3: extracción del agua residual y limpieza de residuos del reservorio. Meses 3-4: puesta en operación. Meses 5-6: evaluación del sistema según indicadores y participación en cursos de capacitación. Sujeto a la disponibilidad de turno de riego luego de la corta invernal.',
    tiempoTotalMeses: '6',
    presupuesto: [
      { inversion: 'Geomembrana de polietileno de alta densidad virgen (PEAD), 750 micrones de espesor', codN1: 'B', codN2: 'B02', tipo: 'B — Almacenamiento y regulación', monto: 'USD 7.880 + IVA (presupuesto original del DTR)', montoUSD: usd(7880) }
    ],
    responsableSeguimiento: 'EEA INTA Rama Caída — Equipo de Riego',
    metodosControl: 'Verificación de fin de obra (colocación de la geomembrana en el reservorio). El seguimiento se realiza al finalizar la instalación y al momento de la operación del sistema.'
  }),

  diag({
    productor: 'Germán Horn',
    finca: 'Insuterra',
    renspa: '1201405045602',
    localidad: 'Montecaseros',
    superficieTotal: '100',
    superficieCultivada: '47,35',
    superficieInculta: '53,65',
    superficieDerecho: '0',
    pozos: '08003115 - 08003114 - 08009900',
    obsGenerales: 'Finca en reconversión: transformando vid a horticultura y transformando el sistema de riego (originalmente sistema Californiano). La finca estuvo abandonada muchos años.',
    cultivos: [
      { cultivo: 'Vid', variedad: 'Aspirant, Bonarda, Cereza, Tempranillo', destino: 'Vinificación', anio: '1976-1990', marco: '2,5 x 2,5 m (Parral)', superficie: '41,42', rendimiento: '19000', rendimientoUnidad: 'Kg/ha' },
      { cultivo: 'Cebolla', variedad: '', destino: 'Semilla', anio: '', marco: '0,40 x 0,15 m', superficie: '6', rendimiento: '', rendimientoUnidad: '' }
    ],
    obsCultivos: 'Cebolla recién plantada (primera vez).',
    analisisSuelo: 'Posee',
    textura: 'Arenoso',
    problemasSuelo: 'Suelo extremadamente arenoso. Problemas de alta infiltración en cabeza y de uniformidad de riego.',
    tipoRiegoGeneral: 'Presurizado',
    sistemasPresentes: ['Goteo', 'Otro'],
    otroSistemaTexto: 'Cimalco / californiano, en transición a goteo',
    rpFuente: 'Pozo',
    rpSuperficie: '47',
    rpCaudal: '29',
    rpFrecuencia: '3',
    rpDuracion: '5',
    rpProblemas: 'Suelo arenoso. Heladas todos los años. Sistema californiano roto.',
    rpObservaciones: 'En transición de cimalco a goteo.',
    represa: 'Posee',
    volumenRepresa: '4400 (y otra de 5500 m³ sin impermeabilizar, no operativa)',
    medicionCaudales: 'Realiza',
    metodoMedicion: 'Caudalímetro',
    asistenciaTecnica: 'Posee',
    personalRiego: ['Empleado', 'Operario al día/jornalero', 'Contratista o chacarero', 'Propietario/familiar'],
    descripcionMejora: 'Transición del riego Californiano en un cuartel de 6 ha a riego por goteo. El sistema californiano estaba en desuso; al comprar la propiedad se decide redimensionarlo y transformarlo en riego por goteo.',
    objetivosMejora: 'Reducir las pérdidas de agua en conducción y aplicación. Aumentar la eficiencia de aplicación. Reconversión de vid a ajo.',
    materialesMejora: 'Sistema de bombeo y chupón flotante para la represa.\nCabezal de filtrado.\nTubería principal y secundaria de PVC y válvulas de campo.\nRed de irrigación por goteo, zanjeo y nivelación de terreno.',
    indicadoresMejora: 'Eficiencia de aplicación antes/después: aumento del 60 %.\nUniformidad de aplicación: aumento del 60 %.\nSuperficie tecnificada: 6 ha.',
    cronogramaEtapas: 'Adquisición de insumos, instalación, calibración y capacitación: 5 meses.',
    tiempoTotalMeses: '6',
    presupuesto: [
      { inversion: 'Sistema de riego por goteo (6 ha)', codN1: 'D', codN2: 'D01', tipo: 'D — Aplicación – Riego presurizado', monto: 'USD 32.563,80 (presupuesto original del DTR)', montoUSD: usd(32563.80) }
    ],
    responsableSeguimiento: 'Guillermo Cúneo (DGI)',
    metodosControl: 'Visita técnica para verificación de instalaciones.'
  }),

  diag({
    productor: 'Nicolás Rivier (administrador)',
    finca: 'Andes Seña S.A.',
    renspa: '12.015.0.01311/02',
    localidad: 'La Llave, San Rafael',
    superficieTotal: '300',
    superficieCultivada: '193',
    superficieInculta: '107',
    superficieDerecho: '233,6',
    ccpp: '4047 256 / 4047 260 / 4047 195 / 4047 239',
    pozos: '1700-2437 / 1700-1763 / 1700-1217 (uno en desuso por falta de necesidad)',
    obsGenerales: 'Cambio reciente de propietario, pero el administrador continúa siendo el mismo desde hace ~10 años (continuidad técnica y productiva). La empresa se orienta a la exportación de fardos de alfalfa a países árabes y Asia. Finca en expansión sobre terrenos incultos (zona baja) con limpieza y desmonte; también un proyecto de siembra de especies florales para producción de miel.',
    tipoProduccion: 'Agricultura',
    cultivos: [
      { cultivo: 'Alfalfa', variedad: '', destino: 'Forraje enfardado para exportación', anio: 'Hasta 5 años', marco: '', superficie: '193', rendimiento: '20000', rendimientoUnidad: 'Materia seca/ha' },
      { cultivo: 'Moha', variedad: '', destino: 'Reserva forrajera', anio: 'Anual', marco: '', superficie: '', rendimiento: '', rendimientoUnidad: '' },
      { cultivo: 'Cebada', variedad: '', destino: 'Rotación', anio: 'Anual', marco: '', superficie: '', rendimiento: '', rendimientoUnidad: '' }
    ],
    obsCultivos: 'Esquema productivo basado en pasturas para forraje ganadero. Rotaciones continuas de alfalfa (~5 años) con varios ciclos de gramíneas (sorgo, moha, cebada, maíz) durante un año; las superficies de cada cultivo no son fijas. Se complementa con cría de ganado bovino (220 + 90 cabezas). Maquinaria propia para enfardado y drones para siembra y aplicaciones. Orientación a siembra directa, reducción de agroquímicos y mejora biológica del suelo.',
    analisisSuelo: 'No posee',
    textura: 'Franco arenoso',
    problemasSuelo: 'No se observan impedimentos físicos en el suelo.',
    obsSuelo: 'Aunque la propiedad es adyacente al río Diamante, la finca está sobre la barranca del río y no tiene problemas asociados al nivel freático.',
    sistemasPresentes: ['Melgas', 'Aspersión', 'Otro'],
    otroSistemaTexto: 'Pivote central',
    rsFuente: 'Turno',
    rsSuperficie: '77',
    rsCaudal: '300',
    rsFrecTurnado: '7',
    rsDuracionTurnado: '96',
    rsCantTurnos: '30',
    rsInfraestructura: 'Nueva conducción impermeabilizada de ingreso, con nivel adecuado para el ingreso del turno al reservorio de la propiedad, desde el cual se abastecen las acequias internas. Todos los caudales de manejo se dirigen a la represa, desde la cual se realiza el abastecimiento del riego superficial.',
    rsProblemas: 'La propiedad cuenta con concesión de agua superficial y subterránea para ampliar la superficie cultivada. El riego con melgas no es lo suficientemente eficiente para aprovechar el recurso disponible y genera rendimientos dispares.',
    rsObservaciones: 'Caudales de pozos: 111 l/s y 77 l/s (el tercer pozo está en desuso, aunque funciona).',
    rpFuente: 'Turno',
    rpSuperficie: '116',
    rpCaudal: '300 l/s (turno); pozos 110 y 75 l/s',
    rpFrecuencia: 'Día por medio en temporada alta',
    rpDuracion: 'Pivote de 80 ha: 12 h (lámina 6,1 mm). Pivote de 36 ha: 8 h (lámina 5,3 mm).',
    rpProblemas: 'Los principales problemas están asociados al costo energético.',
    represa: 'Posee',
    volumenRepresa: '40000',
    medicionCaudales: 'No realiza',
    asistenciaTecnica: 'Posee',
    personalRiego: ['Empleado'],
    obsRiego: 'El tercer pozo no se utiliza por falta de necesidad; si bien tiene salida por una acequia, no puede abastecer el reservorio. El riego se planifica según las estaciones y se decide según el monitoreo con sonda de riego y datos de evapotranspiración provenientes de una estación meteorológica.',
    descripcionMejora: 'Etapa de intensificación y ampliación productiva sobre superficies ya cultivadas e incultas, impulsada por la disponibilidad de las concesiones superficial y subterránea. Incluye: instalación de un nuevo pivote central de 36 ha en el sector este; instalación de sistemas fijos de aspersión ("superficie completa") para regar cuadros hoy regados por gravedad, en dos sectores (Eq1 y Eq2); y construcción de un nuevo reservorio de 40.000 m³ en el sector oeste. Detalles en el anexo "Memoria Técnica – Proyecto Integral de Riego Presurizado".',
    objetivosMejora: 'Aumentar la productividad total de la finca. Aumentar la eficiencia de aplicación en las áreas tecnificadas. Aumentar el aprovechamiento de los caudales disponibles.',
    materialesMejora: 'Tubería de PVC y PEAD y accesorios.\nAspersores.\nCabezales de riego (bombas, válvulas, aspiración, automatización, inyección de fertilizantes, filtros, conexiones eléctricas).\nPivote central.\nZanjeos y movimientos de suelo.\nReservorio y otras obras civiles.',
    indicadoresMejora: 'Eficiencia de aplicación en áreas tecnificadas con aspersión: del 50 % al 85 %.\nUniformidad de aplicación: del 70 % al 95 %.\nCaudal disponible aprovechado: +110 l/s.\nSuperficie tecnificada: 79,3 ha (entre pivote y aspersión fija).\nRendimiento del cultivo: de 20 a 35 tonMS/ha.',
    cronogramaEtapas: 'Secuencia constructiva preliminar (~21 semanas): sistema de aspersión Eq2 y construcción del reservorio este (semanas 1-10); habilitación Eq1 y Pv3, sistema de aspersión Eq1 y montaje del pivote central Pv3 (semanas 11-16); pruebas hidráulicas y automatización (semanas 17-19); puesta en marcha, capacitación y recepción provisoria (semanas 20-21).',
    tiempoTotalMeses: '5',
    presupuesto: [
      { inversion: 'Sistema de aspersión fijo Eq1', codN1: 'D', codN2: 'D04', tipo: 'D — Aplicación – Riego presurizado', monto: 'USD 372.061,57 (presupuesto original del DTR)', montoUSD: usd(372061.57) },
      { inversion: 'Sistema de aspersión fijo Eq2 (incluye reservorio de 40.000 m³ — USD 219.276,20)', codN1: 'D', codN2: 'D04', tipo: 'D — Aplicación – Riego presurizado', monto: 'USD 153.376,32 (presupuesto original del DTR)', montoUSD: usd(153376.32) },
      { inversion: 'Pivote central nuevo (36 ha, sector este)', codN1: 'D', codN2: 'D06', tipo: 'D — Aplicación – Riego presurizado', monto: 'USD 176.051,67 (presupuesto original del DTR)', montoUSD: usd(176051.67) }
    ],
    responsableSeguimiento: 'Guillermo Cúneo (DGI)',
    metodosControl: 'Visita de verificación de instalaciones y medición de uniformidad de riego.',
    periodicidad: 'Una vez durante el ciclo posterior (2027/2028).'
  })
];

async function wipeDiagnosticos() {
  // Borra TODOS los diagnósticos existentes (y en cascada sus firmas, historial
  // y fotos). Es solo para la carga inicial: una vez que los técnicos empiecen
  // a cargar datos reales, no se debe volver a correr este seed.
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
       VALUES ($1,'aperez','Diagnóstico creado','Carga inicial desde DTR aprobado','ok')`,
      [id]
    );
    console.log('Diagnóstico cargado:', data.productor, '/', data.finca || '(sin finca)', '→ id', id);
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
