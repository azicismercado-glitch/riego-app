/**
 * Generador del borrador de "Conformidad Técnica" a partir de los datos
 * del diagnóstico. Portado 1:1 desde la lógica del prototipo original.
 */
function generateConformidadDraft(d) {
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

  const limitantes = [d.rsProblemas, d.rpProblemas, d.problemasSuelo].filter(Boolean);
  const propuestaItems = (d.materialesMejora || '').split('\n').map((s) => s.trim()).filter(Boolean);
  const indicadores = (d.indicadoresMejora || '').split('\n').map((s) => s.trim()).filter(Boolean);
  const presupuesto = d.presupuesto || [];
  const presupuestoTotal =
    presupuesto
      .filter((p) => p.inversion || p.monto)
      .map((p) => `${p.inversion}${p.monto ? ': ' + p.monto : ''}`)
      .join('; ') || 's/d';

  let txt = '';
  txt += `CONFORMIDAD TÉCNICA\nPrograma de Apoyo para la Tecnificación del Riego - CFI\nProvincia de Mendoza\n\n`;
  txt += `Productor: ${productor}\nEstablecimiento/Finca: ${finca}\nLocalidad: ${localidad}\n`;
  txt += `Superficie total: ${d.superficieTotal || 's/d'} ha\nSuperficie cultivada: ${d.superficieCultivada || 's/d'} ha\nCultivos: ${cultivosStr}\nSistema actual: ${sistemaActual}\n\n`;
  txt += `Del análisis del diagnóstico técnico presentado, se considera técnicamente consistente la propuesta de inversión orientada a ${(d.descripcionMejora || '[completar descripción de la mejora]').replace(/\.$/, '').toLowerCase()}.\n\n`;
  txt += `La propuesta contempla:\n` + (propuestaItems.length ? propuestaItems.map((i) => `• ${i}`).join('\n') : '• [completar materiales de la propuesta]') + '\n\n';
  txt += `El diagnóstico identifica las siguientes limitantes del sistema actual:\n` + (limitantes.length ? limitantes.map((i) => `• ${i}`).join('\n') : '• [sin limitantes registradas]') + '\n\n';
  txt += `La intervención propuesta permitirá:\n` + (indicadores.length ? indicadores.map((i) => `• ${i}`).join('\n') : '• [completar indicadores de mejora]') + '\n\n';
  txt += `El cronograma de ejecución previsto, de ${d.tiempoTotalMeses || '[completar]'} meses, resulta razonable para la magnitud de las obras proyectadas. El presupuesto presentado (${presupuestoTotal}) resulta consistente con los componentes incluidos en la propuesta.\n\n`;
  txt += `En función de lo expuesto, se valida técnicamente el Diagnóstico de Riego correspondiente a ${finca}, del productor ${productor}, habilitándolo a avanzar a la evaluación financiera de la propuesta de inversión, en el marco del Programa de Apoyo para la Tecnificación del Riego – CFI.`;
  return txt;
}

module.exports = { generateConformidadDraft };
