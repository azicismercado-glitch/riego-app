const STAGES = ['borrador', 'firmado_tecnico', 'firmado_provincia', 'firmado_cfi'];
const STAGE_LABELS = {
  borrador: 'Borrador',
  firmado_tecnico: 'Firmado por técnico',
  firmado_provincia: 'Firmado por provincia',
  firmado_cfi: 'Validado por CFI'
};
// Rol de sesión requerido para poder ser quien firma en cada etapa (en orden).
const STAGE_ROLE = ['tecnico', 'provincia', 'cfi'];

// Categorías de tipo de inversión, usadas en el presupuesto y en el panel agregado.
const TIPOS_INVERSION = [
  'Riego presurizado (goteo)',
  'Riego por aspersión',
  'Paneles solares / energía',
  'Cañería / tubería',
  'Perforación de pozos',
  'Reservorio / represa',
  'Sistema antiheladas',
  'Obra civil / cabezal de riego',
  'Otro'
];

function stageIndex(s) {
  return STAGES.indexOf(s);
}

function emptyCultivo() {
  return { cultivo: '', variedad: '', destino: '', anio: '', marco: '', superficie: '', rendimiento: '', rendimientoUnidad: '' };
}
function emptyPresupuesto() {
  // codN1/codN2: categoría y subcategoría del nomenclador de inversiones CFI
  // (ver public/app.js NOMENCLADOR). "tipo" guarda la etiqueta legible de la
  // categoría elegida, para no tener que tocar la agregación del panel.
  return { inversion: '', codN1: '', codN2: '', tipo: '', monto: '', montoUSD: '' };
}
function emptyData() {
  return {
    productor: '', finca: '', renspa: '', localidad: '', cuit: '', expedienteSigi: '',
    superficieTotal: '', superficieCultivada: '', superficieInculta: '', superficieDerecho: '', fuenteRiegoDerecho: '',
    ccpp: '', pozos: '', obsGenerales: '',
    cultivos: [emptyCultivo()], obsCultivos: '',
    tipoProduccion: null, ganaderiaAnimalTipo: '', ganaderiaManejo: null, ganaderiaActividad: [], ganaderiaCabezas: '', ganaderiaCategorias: [],
    analisisSuelo: null, analisisSueloArchivo: null, textura: '', problemasSuelo: '',
    profundidadLimitante: '', profundidadEfectivaCm: '', salinidadTipo: '', hayPiedras: null, porcentajePiedra: '',
    requiereAnalisisPrevio: null, requiereAnalisisPrevioQue: [],
    tipoRiegoGeneral: null, sistemasPresentes: [], otroSistemaTexto: '',
    rsFuente: null, rsSuperficie: '', rsCaudal: '', rsFrecTurnado: '', rsDuracionTurnado: '', rsCantTurnos: '', rsInfraestructura: '', rsProblemas: '',
    rpFuente: null, rpSuperficie: '', rpCaudal: '', rpFrecuencia: '', rpDuracion: '', rpProblemas: '',
    represa: null, volumenRepresa: '', medicionCaudales: null, metodoMedicion: '', asistenciaTecnica: null, personalRiego: [], obsRiego: '',
    descripcionMejora: '', objetivosMejora: '', materialesMejora: '', indicadoresMejora: '', cronogramaEtapas: '', tiempoTotalMeses: '',
    presupuesto: [emptyPresupuesto()], responsableSeguimiento: '', metodosControl: '', periodicidad: ''
  };
}

function has(v) {
  return v !== null && v !== undefined && String(v).trim() !== '';
}

// Qué tipo(s) de riego tiene cargados el diagnóstico, para saber qué bloque
// de la pestaña Riego (superficial y/o presurizado) corresponde exigir.
function sistemasRiego(d) {
  const sp = d.sistemasPresentes || [];
  return {
    superficial: sp.some((s) => ['Surcos', 'Melgas'].includes(s)),
    presurizado: sp.some((s) => ['Goteo', 'Aspersión'].includes(s))
  };
}

// Deja solo los dígitos de un CUIT (saca guiones/espacios) para poder cruzar
// con lo importado de SIGI sin depender del formato exacto en que se escribió.
function normalizeCuit(v) {
  return String(v || '').replace(/\D/g, '');
}

function completeness(data, fotosCount) {
  const d = data;
  const { superficial, presurizado } = sistemasRiego(d);
  const riegoReq = [(d.sistemasPresentes || []).length > 0];
  if (superficial) riegoReq.push(has(d.rsSuperficie), has(d.rsFrecTurnado), has(d.rsDuracionTurnado));
  if (presurizado) riegoReq.push(has(d.rpSuperficie), has(d.rpFrecuencia), has(d.rpDuracion));
  if (!superficial && !presurizado) riegoReq.push(has(d.rsSuperficie) || has(d.rpSuperficie));

  const secs = {
    estab: { label: 'Establecimiento', req: [has(d.productor), has(d.finca), has(d.localidad), has(d.renspa), has(d.superficieTotal), has(d.superficieCultivada)] },
    cultivos: { label: 'Cultivos', req: [(d.cultivos || []).some((c) => has(c.cultivo) && has(c.superficie))] },
    suelo: { label: 'Suelo', req: [has(d.analisisSuelo), has(d.textura)] },
    riego: { label: 'Sistema de riego', req: riegoReq },
    propuesta: { label: 'Propuesta de mejora', req: [has(d.descripcionMejora), has(d.materialesMejora), has(d.indicadoresMejora), has(d.tiempoTotalMeses), (d.presupuesto || []).some((p) => has(p.inversion) && has(p.monto))] },
    fotos: { label: 'Fotos', req: [(fotosCount || 0) > 0] }
  };
  let done = 0, total = 0;
  for (const k in secs) {
    const ok = secs[k].req.filter(Boolean).length;
    secs[k].done = ok;
    secs[k].total = secs[k].req.length;
    secs[k].state = ok === secs[k].total ? 'ok' : ok > 0 ? 'part' : 'no';
    done += ok;
    total += secs[k].total;
  }
  return { secs, pct: total ? Math.round((done / total) * 100) : 0 };
}

function missingForSign(data) {
  const d = data;
  const faltan = [];
  if (!has(d.productor)) faltan.push('Nombre del productor');
  if (!has(d.finca)) faltan.push('Nombre de la finca');
  if (!has(d.localidad)) faltan.push('Localidad/Departamento');
  if (!has(d.superficieTotal)) faltan.push('Superficie total');
  if (!has(d.textura)) faltan.push('Textura del suelo');
  if (!(d.cultivos || []).some((c) => has(c.cultivo))) faltan.push('Al menos un cultivo');
  if ((d.sistemasPresentes || []).length === 0) faltan.push('Sistema de riego presente');
  const { superficial, presurizado } = sistemasRiego(d);
  if (superficial) {
    if (!has(d.rsSuperficie)) faltan.push('Superficie regada (riego superficial)');
    if (!has(d.rsFrecTurnado)) faltan.push('Frecuencia de turnado (riego superficial)');
    if (!has(d.rsDuracionTurnado)) faltan.push('Duración de turnado (riego superficial)');
  }
  if (presurizado) {
    if (!has(d.rpSuperficie)) faltan.push('Superficie regada (riego presurizado)');
    if (!has(d.rpFrecuencia)) faltan.push('Frecuencia por operación (riego presurizado)');
    if (!has(d.rpDuracion)) faltan.push('Duración por operación (riego presurizado)');
  }
  if (!has(d.descripcionMejora)) faltan.push('Descripción de la mejora propuesta');
  if (!(d.presupuesto || []).some((p) => has(p.inversion))) faltan.push('Al menos un ítem de presupuesto');
  return faltan;
}

module.exports = {
  STAGES, STAGE_LABELS, STAGE_ROLE, TIPOS_INVERSION, stageIndex,
  emptyCultivo, emptyPresupuesto, emptyData,
  has, sistemasRiego, completeness, missingForSign, normalizeCuit
};
