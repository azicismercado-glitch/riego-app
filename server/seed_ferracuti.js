require('dotenv').config();
const db = require('./db');

function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h).toString(16).padStart(8, '0') + Math.abs((h * 2654435761) | 0).toString(16).padStart(8, '0');
}

const SIG_PLACEHOLDER_SVG = `<svg viewBox="0 0 200 60" xmlns="http://www.w3.org/2000/svg"><path d="M10 40 Q 30 10, 50 35 T 90 30 Q 110 45, 130 20 T 190 25" fill="none" stroke="#2F5238" stroke-width="2" stroke-linecap="round"/></svg>`;

const data = {
  productor: 'Walter Ferracuti (Walter Ferracuti, Nora Contín y Lorena Ferracuti S.H. — CUIT 30-70817816-7)',
  finca: 'Chacra C75',
  renspa: '15.001.0.01075/00',
  localidad: 'Viedma - IDEVI (Paraje El Juncal, Dpto. Adolfo Alsina, Río Negro)',
  superficieTotal: '20', superficieCultivada: '14.45', superficieInculta: '', superficieDerecho: '',
  ccpp: '', pozos: '',
  obsGenerales: 'Establecimiento en plena producción y funcionamiento. Cuenta con derecho y disponibilidad de agua de riego integrada al sistema de canales del IDEVI.',
  cultivos: [
    { cultivo: 'Avellano', variedad: 'Tonda Di Giffoni', destino: '', anio: '2005-2013-2018', marco: '5 m x 4 m', superficie: '14.45', conduccion: 'Acequias', rendimiento: '2000' }
  ],
  obsCultivos: '13 ha implantadas (8-25 años); resto en preparación para nuevas plantas.',
  analisisSuelo: 'No posee',
  textura: 'Franco / Franco-limoso (característico de los valles aluviales del IDEVI)',
  problemasSuelo: 'Sin limitaciones severas actuales; salinidad normal; suelo profundo, apto para el anclaje radicular de frutales secos.',
  obsSuelo: 'Perfil típico del valle inferior del Río Negro, apto para labranza y con buena respuesta a la fertilización controlada.',
  sistemasPresentes: ['Surcos', 'Melgas'], otroSistemaTexto: '',
  rsFuente: null, rsSuperficie: '14.45', rsCaudal: '40',
  rsFrecTurnado: 'Diaria (sin riego en época de mantenimiento del canal principal, mayo-agosto)',
  rsDuracionTurnado: '192', rsCantTurnos: '12',
  rsInfraestructura: 'Fuente: Canal Secundario IDEVI. Derecho y disponibilidad de agua integrada al sistema de canales del IDEVI. Sistema de riego por surco/melga instalado en 1950.',
  rsProblemas: 'Uniformidad de aplicación 30%, superficie mojada 50%, pérdidas por escurrimiento 20%. Eficiencia de aplicación estimada en 30%.',
  rsObservaciones: 'Método de decisión de riego: observación visual, medición de humedad con higrómetro y recomendación profesional (balance hídrico). Se realiza medición de caudal (40 L/s).',
  rpFuente: null, rpSuperficie: '', rpCaudal: '', rpFrecuencia: '', rpDuracion: '', rpProblemas: '', rpObservaciones: '',
  represa: 'No posee', volumenRepresa: '',
  medicionCaudales: 'Realiza', metodoMedicion: 'Higrómetro y observación visual con criterios de balance hídrico',
  asistenciaTecnica: 'Posee', personalRiego: [],
  obsRiego: 'Principal limitante para mejorar el sistema de riego: falta de financiamiento (no se registra falta de agua, infraestructura deficiente ni falta de asesoramiento).',
  descripcionMejora: 'La presente propuesta técnico-económica tiene como objetivo estabilizar los rendimientos productivos mediante la reducción de las pérdidas ocasionadas por las heladas tardías y mejorar la eficiencia en la aplicación del riego. En la situación actual, se estima que estos eventos climáticos generan pérdidas promedio de aproximadamente el 40% de la producción.\n\nSe propone la instalación de un sistema de riego por aspersión subarbórea de doble propósito (control de heladas y riego), compuesto por cabezal de filtrado, tuberías matrices y secundarias de PVC y PEAD enterradas, líneas de aspersión distribuidas en toda la superficie productiva y un reservorio con capacidad de 12.200 m³. La infraestructura quedará preparada para incorporar en una etapa futura un sistema de fertirrigación.',
  objetivosMejora: '- Instalación de un sistema de riego por aspersión subarbórea para control de heladas.\n- Elevar el indicador de eficiencia en la aplicación de agua, alineándose con las metas de Triple Impacto del CFI.\n- Incrementar el rendimiento promedio del establecimiento y generar estabilidad en la producción.',
  materialesMejora: 'Construcción de reservorio (12.200 m³)\nSala de bombeo y filtrado\nTuberías para puentes internos\nHoras de maquinaria vial y movimiento de suelo (retroexcavadora, niveladora, zanjeadora)\nMano de obra especializada\nCabezal de filtrado principal\nBomba centrífuga y tablero eléctrico de comando y protección\nTuberías principales y secundarias de PVC y Polietileno de alta densidad (PEAD)\nLíneas de aspersión\nVálvulas de aire, reguladoras de presión y accesorios de acople hidráulico\nMano de obra técnica calificada para montaje, conexiones y puesta en marcha',
  indicadoresMejora: 'Reducción de pérdidas por heladas tardías: del 40% a menos del 10% en años con eventos de intensidad moderada\nIncremento de la producción comercial: de 2.000 a 2.800 kg/ha\nEstabilidad de los rendimientos: de Baja a Alta\nEficiencia de aplicación de agua: del 30% a valores cercanos al 90%\nMejora de la eficiencia operativa: infraestructura preparada para incorporar fertirrigación',
  cronogramaEtapas: 'Etapa 1 — Gestión, evaluación jurídica y aprobación del financiamiento ante el CFI: 30 días\nEtapa 2 — Adquisición y acopio de materiales: 10 días\nEtapa 3 — Obras de infraestructura: 30 días\nEtapa 4 — Zanjeo, conexiones de tuberías, cabezal de filtrado, bombeo y líneas de aspersión: 20 días\nEtapa 5 — Pruebas de presión, lavado de tuberías, calibración de emisores y puesta en marcha: 3 días',
  tiempoTotalMeses: '3',
  presupuesto: [
    { inversion: 'Tuberías', monto: 'USD 31.122,41 + IVA' },
    { inversion: 'Válvulas de campo', monto: 'USD 578,57 + IVA' },
    { inversion: 'Aspersores + conexiones', monto: 'USD 8.096,06 + IVA' },
    { inversion: 'Manifold', monto: 'USD 6.066,41 + IVA' },
    { inversion: 'Programación', monto: 'USD 5.699,91 + IVA' },
    { inversion: 'Inyección de fertilizantes', monto: 'USD 5.663,56 + IVA' },
    { inversion: 'Bombeo', monto: 'USD 50.087,25 + IVA' },
    { inversion: 'Instalación', monto: 'USD 12.812,00 + IVA' },
    { inversion: 'Proyecto', monto: 'USD 625,00 + IVA' },
    { inversion: 'Reservorio', monto: 'USD 29.865,00 + IVA' },
    { inversion: 'TOTAL (80% CFI / 20% productor)', monto: 'USD 150.616,17 + IVA (≈ $227.430.416,7 ARS + IVA)' }
  ],
  responsableSeguimiento: 'Secretaría de Agricultura de la Provincia de Río Negro (Ing. Fernando Arborelo / Mg. Ing. Agr. Lucio Reinoso)',
  metodosControl: 'Inspecciones visuales del avance de las obras civiles. Inspecciones visuales del avance de la instalación del sistema de riego (bombeo y filtrado).',
  periodicidad: 'Seguimiento mensual durante la ejecución.'
};

const informe = `CONSEJO FEDERAL DE INVERSIONES
Programa de Apoyo para la Tecnificación del Riego
CONFORMIDAD TÉCNICA DE DIAGNÓSTICO

1. Identificación del beneficiario y del establecimiento
Beneficiario: Ferracuti Walter, Nora Contín y Lorena Ferracuti S.H.
CUIT: 30-70817816-7
Establecimiento: Chacra C75
RENSPA: 15.001.0.01075/00
Ubicación: Ruta Nacional N.º 3, Km 970 — Paraje El Juncal, Dpto. Adolfo Alsina, Viedma, Provincia de Río Negro
Cultivo: Avellano (Corylus avellana L.)
Objeto del financiamiento: Instalación de un sistema de defensa activa contra heladas mediante aspersión subarbórea de doble propósito (protección antihelada y riego)
Línea de financiamiento: Línea de Financiamiento de Triple Impacto — Cofinanciamiento: 80% CFI / 20% productor

2. Análisis técnico
El sistema propuesto responde a una limitante productiva real y técnicamente validada: la elevada sensibilidad del avellano a las heladas tardías durante la floración y el cuaje del fruto (septiembre-octubre), con pérdidas estimadas del orden del 40% de la producción potencial. El proyecto hidráulico se encuentra correctamente dimensionado, con emisores Netafim MegaNet™ 15D, precipitación media del orden de 3 mm/h y coeficientes de uniformidad de Christiansen de 80,6% a 82,1%. El requerimiento hidráulico en cabecera queda establecido en 400 m³/h a 70 m.c.a., respaldado por planos y planillas de cálculo firmadas por profesional matriculado. El sistema mejora además la eficiencia y uniformidad de aplicación del riego respecto del sistema superficial actual (eficiencia de aplicación estimada en 30%).

3. Conformidad Técnica
En virtud del análisis precedente, en mi carácter de Coordinador del Programa de Apoyo para la Tecnificación del Riego, se emite CONFORMIDAD TÉCNICA al Diagnóstico Técnico del establecimiento referido, por considerar que la propuesta de inversión se encuentra técnicamente fundada y adecuadamente dimensionada. En consecuencia, se habilita la continuidad del trámite hacia la evaluación crediticia de la Línea de Financiamiento de Triple Impacto.

4. Observación técnica (a subsanar previo a la ejecución)
La Memoria Técnica excluye expresamente de su alcance la captación de agua, el reservorio de almacenamiento y la estación de bombeo, definiendo únicamente el requerimiento hidráulico en el punto de impulsión (400 m³/h a 70 m.c.a. en funcionamiento simultáneo). Deberá tenerse en cuenta previo al desembolso y/o ejecución de las obras:
(a) la fuente de captación definitiva y el derecho de uso de agua suficiente para el caudal requerido; y
(b) el dimensionamiento del reservorio y de la estación de bombeo que garanticen la entrega de 400 m³/h a 70 m.c.a. en el punto de impulsión durante los eventos de helada, así como la recarga del reservorio entre eventos.
Esta observación no afecta la validez técnica del Diagnóstico ni del proyecto de defensa antihelada, cuyo dimensionamiento se considera adecuado, y constituye un requisito complementario a completar en la instancia de proyecto ejecutivo.

Fecha: 30/06/2026
Ing. Agr. Lucas Costa
Equipo Técnico – Programa de Apoyo para la Tecnificación del Riego – CFI`;

async function main() {
  const { rows: urows } = await db.query('SELECT id FROM users WHERE username = $1', ['aperez']);
  if (!urows[0]) throw new Error('No existe el usuario aperez. Corré primero npm run seed.');
  const tecnicoId = urows[0].id;

  const { rows } = await db.query(
    `INSERT INTO diagnosticos (data, doc_status, informe_conformidad, created_by, created_at, updated_at)
     VALUES ($1,'firmado_cfi',$2,$3,'2026-07-01 09:00:00-03','2026-07-30 14:00:00-03') RETURNING id`,
    [data, informe, tecnicoId]
  );
  const id = rows[0].id;

  const firmas = [
    ['tecnico', 'aperez', '2026-07-02 10:00:00-03', 'Paraje El Juncal, Dpto. Adolfo Alsina, Viedma, Río Negro (Lat -40.8166, Long -63.0709)', false, '', null],
    ['provincia', 'lreinoso', '2026-07-21 09:00:00-03', 'Secretaría de Agricultura de la Provincia de Río Negro (oficina)', false, '', null],
    ['cfi', 'lcosta', '2026-07-30 14:00:00-03', 'CABA (oficina CFI)', true,
      'Observación técnica sobre captación de agua: la fuente de captación definitiva, el derecho de uso de agua y el dimensionamiento del reservorio/estación de bombeo (para garantizar 400 m³/h a 70 m.c.a.) deben completarse en la instancia de proyecto ejecutivo, previo al desembolso. No afecta la validez del diagnóstico.',
      informe]
  ];
  for (const [role, usuario, ts, geo, conObs, obs, inf] of firmas) {
    const hash = simpleHash(JSON.stringify(data) + role + ts);
    await db.query(
      `INSERT INTO signatures (diagnostico_id, role, usuario, ts, geo, hash, signature_image, con_observaciones, observaciones, informe)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [id, role, usuario, ts, geo, hash, SIG_PLACEHOLDER_SVG, conObs, obs, inf]
    );
  }

  const hist = [
    ['2026-07-01 09:00:00-03', 'aperez', 'Diagnóstico creado', 'Relevamiento en Chacra C75 — Walter Ferracuti (Viedma, Río Negro)', 'ok'],
    ['2026-07-02 10:00:00-03', 'aperez', 'Firmado por Técnico de campo', 'Identidad reautenticada', 'ok'],
    ['2026-07-21 09:00:00-03', 'lreinoso', 'Validado y firmado por Responsable provincial', 'Mg. Ing. Agr. Lucio Reinoso — Sec. de Agricultura de Río Negro. Sin observaciones', 'ok'],
    ['2026-07-29 11:00:00-03', 'lcosta', 'Borrador de Conformidad Técnica generado', 'Basado en el análisis técnico del proyecto hidráulico (Memoria Técnica Agroconsultind S.R.L.)', 'ok'],
    ['2026-07-30 14:00:00-03', 'lcosta', 'Validado y firmado por Técnico CFI', 'Con observaciones sujetas a complementación (captación de agua / reservorio / bombeo)', 'warn']
  ];
  for (const [ts, usuario, evento, detalle, tipo] of hist) {
    await db.query(
      `INSERT INTO historial (diagnostico_id, ts, usuario, evento, detalle, tipo) VALUES ($1,$2,$3,$4,$5,$6)`,
      [id, ts, usuario, evento, detalle, tipo]
    );
  }
  console.log('Diagnóstico "Chacra C75 — Walter Ferracuti" cargado, id =', id);
  await db.pool.end();
}

main().catch((err) => {
  console.error('Error al cargar el diagnóstico:', err);
  process.exit(1);
});
