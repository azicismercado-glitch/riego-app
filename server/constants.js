const STAGES = ['borrador', 'firmado_tecnico', 'firmado_provincia', 'firmado_cfi'];
const STAGE_LABELS = {
  borrador: 'Borrador',
  firmado_tecnico: 'Firmado por técnico',
  firmado_provincia: 'Firmado por provincia',
  firmado_cfi: 'Validado por CFI'
};
// Rol de sesión requerido para poder ser quien firma en cada etapa (en orden).
const STAGE_ROLE = ['tecnico', 'provincia', 'cfi'];

function stageIndex(s) {
  return STAGES.indexOf(s);
}

function emptyCultivo() {
  return { cultivo: '', variedad: '', destino: '', anio: '', marco: '', superficie: '', conduccion: '', rendimiento: '' };
}
function emptyPresupuesto() {
  return { inversion: '', monto: '' };
}
function emptyData() {
  return {
    productor: '', finca: '', renspa: '', localidad: '',
    superficieTotal: '', superficieCultivada: '', superficieInculta: '', superficieDerecho: '',
    ccpp: '', pozos: '', obsGenerales: '',
    cultivos: [emptyCultivo()], obsCultivos: '',
    analisisSuelo: null, textura: '', problemasSuelo: '', obsSuelo: '',
    sistemasPresentes: [], otroSistemaTexto: '',
    rsFuente: null, rsSuperficie: '', rsCaudal: '', rsFrecTurnado: '', rsDuracionTurnado: '', rsCantTurnos: '', rsInfraestructura: '', rsProblemas: '', rsObservaciones: '',
    rpFuente: null, rpSuperficie: '', rpCaudal: '', rpFrecuencia: '', rpDuracion: '', rpProblemas: '', rpObservaciones: '',
    represa: null, volumenRepresa: '', medicionCaudales: null, metodoMedicion: '', asistenciaTecnica: null, personalRiego: [], obsRiego: '',
    descripcionMejora: '', objetivosMejora: '', materialesMejora: '', indicadoresMejora: '', cronogramaEtapas: '', tiempoTotalMeses: '',
    presupuesto: [emptyPresupuesto()], responsableSeguimiento: '', metodosControl: '', periodicidad: ''
  };
}

function has(v) {
  return v !== null && v !== undefined && String(v).trim() !== '';
}

function completeness(data, fotosCount) {
  const d = data;
  const secs = {
    estab: { label: 'Establecimiento', req: [has(d.productor), has(d.finca), has(d.localidad), has(d.renspa), has(d.superficieTotal), has(d.superficieCultivada)] },
    cultivos: { label: 'Cultivos', req: [(d.cultivos || []).some((c) => has(c.cultivo) && has(c.superficie))] },
    suelo: { label: 'Suelo', req: [has(d.analisisSuelo) || has(d.textura)] },
    riego: { label: 'Sistema de riego', req: [(d.sistemasPresentes || []).length > 0, has(d.rsSuperficie) || has(d.rpSuperficie)] },
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
  if (!(d.cultivos || []).some((c) => has(c.cultivo))) faltan.push('Al menos un cultivo');
  if ((d.sistemasPresentes || []).length === 0) faltan.push('Sistema de riego presente');
  if (!has(d.descripcionMejora)) faltan.push('Descripción de la mejora propuesta');
  if (!(d.presupuesto || []).some((p) => has(p.inversion))) faltan.push('Al menos un ítem de presupuesto');
  return faltan;
}

module.exports = {
  STAGES, STAGE_LABELS, STAGE_ROLE, stageIndex,
  emptyCultivo, emptyPresupuesto, emptyData,
  has, completeness, missingForSign
};
