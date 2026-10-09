/**
 * Generador del borrador de "Conformidad Técnica" a partir de los datos
 * del diagnóstico. Es solo un punto de partida: el técnico de CFI lo edita
 * a mano (o lo redacta de cero) en el textarea antes de firmar — esto nunca
 * se autocompleta "final", siempre queda editable hasta el momento de firmar.
 */
function arr(v) { return Array.isArray(v) ? v : []; }
function has(v) { return v !== null && v !== undefined && String(v).trim() !== ''; }
// Separa un textarea de "uno por línea" en bullets, ignorando líneas vacías.
function lineas(v) { return String(v || '').split('\n').map((l) => l.trim()).filter(Boolean); }

function generateConformidadDraft(d, provincia) {
  const productor = d.productor || '[productor]';
  const finca = d.finca || '[finca/establecimiento]';
  const localidad = d.localidad || '[localidad]';
  const cultivos = d.cultivos || [];
  const cultivosStr =
    cultivos
      .filter((c) => c.cultivo)
      .map((c) => c.cultivo + (c.variedad ? ` (${c.variedad})` : ''))
      .join(', ') || 's/d';

  const sistemasPresentes = d.sistemasPresentes || [];
  let sistemaPartes = [];
  const supF = sistemasPresentes.filter((s) => ['Surcos', 'Melgas'].includes(s));
  const preF = sistemasPresentes.filter((s) => ['Goteo', 'Aspersión'].includes(s));
  if (supF.length) sistemaPartes.push(`riego superficial por ${supF.join('/').toLowerCase()}${d.rsSuperficie ? ` en ${d.rsSuperficie} ha` : ''}`);
  if (preF.length) sistemaPartes.push(`riego presurizado por ${preF.join('/').toLowerCase()}${d.rpSuperficie ? ` en ${d.rpSuperficie} ha` : ''}`);
  const sistemaActual = sistemaPartes.length ? sistemaPartes.join(', complementado con ') + '.' : 's/d.';

  // Limitantes: junta los campos de texto libre (sistema superficial/presurizado/
  // suelo) con las listas de checkboxes y su detalle, para no dejar afuera nada
  // de lo que el técnico de campo ya marcó en la pestaña Problemas.
  const limitantes = [
    ...arr(d.problemasFrecuentesItems),
    ...arr(d.limitantesItems),
    d.limitantesDetalle,
    ...arr(d.infraDeficienteItems).map((i) => `Infraestructura deficiente: ${i}`),
    d.rsProblemas, d.rpProblemas, d.problemasSuelo
  ].filter(has);

  // Propuesta: materiales/insumos cargados + ítems del presupuesto por
  // inversión (nomenclador CFI), que suelen tener más detalle de lo que es
  // cada componente que los materiales sueltos.
  const propuestaItems = [
    ...(d.materiales || []).filter((m) => m.item).map((m) => m.item + (m.cantidad ? ` — ${m.cantidad}${m.unidad ? ' ' + m.unidad : ''}` : '')),
    ...(d.presupuesto || []).filter((p) => has(p.inversion)).map((p) => p.inversion + (p.tipo ? ` (${p.tipo})` : '') + (p.superficieAsociada ? ` — ${p.superficieAsociada} ha` : ''))
  ];

  // Indicadores: redactados como oración (de X a Y), no como par crudo.
  const indicadores = (d.indicadores || [])
    .filter((i) => has(i.actual) || has(i.proyectada))
    .map((i) => {
      const u = i.unidad ? ' ' + i.unidad : '';
      if (has(i.actual) && has(i.proyectada)) return `${i.indicador}: de ${i.actual}${u} a ${i.proyectada}${u}.`;
      return `${i.indicador}: ${i.proyectada || i.actual}${u}.`;
    });
  const objetivos = lineas(d.objetivosMejora);

  const presupuesto = d.presupuesto || [];
  const presupuestoTotal =
    presupuesto
      .filter((p) => p.inversion || p.monto || p.montoUSD)
      .map((p) => `${p.inversion}${p.montoUSD ? ': USD ' + Number(p.montoUSD).toLocaleString('es-AR') : (p.monto ? ': $' + Number(p.monto).toLocaleString('es-AR') : '')}`)
      .join('; ') || 's/d';
  const financiamiento = [
    has(d.aportePorcentajeProductor) ? `aporte del productor del ${d.aportePorcentajeProductor}%` : null,
    has(d.financiamientoPorcentajeSolicitado) ? `financiamiento solicitado del ${d.financiamientoPorcentajeSolicitado}%` : null
  ].filter(Boolean).join(' y ');

  let txt = '';
  txt += `CONFORMIDAD TÉCNICA\nPrograma de Apoyo para la Tecnificación del Riego - CFI\n${provincia ? 'Provincia de ' + provincia + '\n' : ''}\n`;
  txt += `Productor: ${productor}\nEstablecimiento/Finca: ${finca}\nLocalidad: ${localidad}\n`;
  if (has(d.renspa)) txt += `RENSPA/RUT: ${d.renspa}\n`;
  txt += `Superficie total: ${d.superficieTotal || 's/d'} ha\nSuperficie cultivada: ${d.superficieCultivada || 's/d'} ha\nCultivos: ${cultivosStr}\nSistema actual: ${sistemaActual}\n\n`;

  txt += `Del análisis del diagnóstico técnico presentado, se considera técnicamente consistente la propuesta de inversión orientada a ${(d.descripcionMejora || '[completar descripción de la mejora]').replace(/\.$/, '').toLowerCase()}. La iniciativa se encuentra alineada con los objetivos del Programa de Apoyo para la Tecnificación del Riego - CFI.\n\n`;

  txt += `La propuesta contempla:\n` + (propuestaItems.length ? propuestaItems.map((i) => `• ${i}`).join('\n') : '• [completar materiales de la propuesta]') + '\n\n';

  if (objetivos.length) txt += `Objetivos específicos:\n` + objetivos.map((o) => `• ${o}`).join('\n') + '\n\n';

  txt += `El diagnóstico identifica las siguientes limitantes del sistema actual:\n` + (limitantes.length ? limitantes.map((i) => `• ${i}`).join('\n') : '• [sin limitantes registradas]') + '\n\n';

  if (has(d.justificacionDetalle)) txt += `Justificación:\n${d.justificacionDetalle}\n\n`;

  txt += `La intervención propuesta permitirá:\n` + (indicadores.length ? indicadores.map((i) => `• ${i}`).join('\n') : '• [completar indicadores de mejora]') + '\n\n';

  txt += `El cronograma de ejecución previsto, de ${d.tiempoTotalMeses || '[completar]'} meses, resulta razonable para la magnitud de las obras proyectadas${has(d.cronogramaEtapas) ? ` (${d.cronogramaEtapas})` : ''}. El presupuesto presentado (${presupuestoTotal})${financiamiento ? `, con ${financiamiento},` : ''} resulta consistente con los componentes incluidos en la propuesta.\n\n`;

  txt += `En función de lo expuesto, se valida técnicamente el Diagnóstico de Riego correspondiente a ${finca}, del productor ${productor}, habilitándolo a avanzar a la evaluación financiera de la propuesta de inversión, en el marco del Programa de Apoyo para la Tecnificación del Riego – CFI.`;
  return txt;
}

module.exports = { generateConformidadDraft };
