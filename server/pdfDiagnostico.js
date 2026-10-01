// Genera el PDF del diagnóstico (con los datos cargados hasta el momento y
// las firmas que corresponda incluir) para adjuntarlo a las notificaciones
// por mail del circuito de firmas — replica, en formato más simple, las
// mismas secciones que arma printDiag() en el cliente (public/app.js).
const PDFDocument = require('pdfkit');
const zlib = require('zlib');

// pdfkit decodifica el PNG de forma asíncrona por dentro (vía zlib), y si
// el archivo viene corrupto tira una excepción que NO se puede atrapar con
// un try/catch alrededor de doc.image() — directamente tumbaría el proceso.
// Por eso se valida el PNG a mano (de forma síncrona, sí atrapable) antes
// de pasárselo a pdfkit, y si no decodifica, se omite la imagen sin
// arriesgar el resto del documento (ni el proceso del servidor).
function pngDecodeOk(buf) {
  try {
    if (buf.length < 8 || buf.readUInt32BE(0) !== 0x89504e47) return false;
    let offset = 8;
    const idatParts = [];
    while (offset + 8 <= buf.length) {
      const len = buf.readUInt32BE(offset);
      const type = buf.toString('ascii', offset + 4, offset + 8);
      const dataStart = offset + 8;
      if (dataStart + len > buf.length) return false;
      if (type === 'IDAT') idatParts.push(buf.slice(dataStart, dataStart + len));
      if (type === 'IEND') break;
      offset = dataStart + len + 4;
    }
    if (!idatParts.length) return false;
    zlib.inflateSync(Buffer.concat(idatParts));
    return true;
  } catch (e) {
    return false;
  }
}

const STAGE_LABELS = {
  borrador: 'Borrador',
  firmado_tecnico: 'Firmado por técnico',
  firmado_provincia: 'Firmado por provincia',
  firmado_cfi: 'Validado por CFI'
};
const SIGNATURE_LABELS = { tecnico: 'Técnico de campo', provincia: 'Responsable provincial', cfi: 'Técnico CFI' };
const GREEN = '#0F6E56';

function has(v) { return v !== null && v !== undefined && String(v).trim() !== ''; }
function arr(v) { return Array.isArray(v) ? v : []; }
function money(n) { return '$ ' + Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 }); }
function fmtDate(ts) { return ts ? new Date(ts).toLocaleString('es-AR') : '—'; }

function generarDiagnosticoPDF({ data, docStatus, signatures }) {
  const d = data || {};
  const sigs = signatures || {};
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 44, size: 'A4', bufferPages: true });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    let n = 0;

    function checkSpace(h) {
      if (doc.y + h > doc.page.height - doc.page.margins.bottom) doc.addPage();
    }

    // -------- encabezado --------
    doc.fontSize(17).fillColor(GREEN).font('Helvetica-Bold').text('Diagnóstico Técnico de Riego');
    doc.fontSize(9).fillColor('#555').font('Helvetica').text('Programa de Apoyo para la Tecnificación del Riego — CFI');
    doc.text(`Estado: ${STAGE_LABELS[docStatus] || docStatus || '—'}  ·  Generado: ${fmtDate(new Date())}`);
    doc.moveDown(0.5);
    doc.strokeColor(GREEN).lineWidth(1.3).moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke();
    doc.moveDown(0.5);

    // -------- helpers de contenido --------
    function section(title, fn) {
      const startY = doc.y;
      let wrote = false;
      const origText = doc.text.bind(doc);
      // arma el contenido en un buffer de líneas para saber si quedó algo antes de imprimir el título
      const lines = [];
      const api = {
        kv(label, value, unit) {
          if (!has(value)) return;
          lines.push({ type: 'kv', label, value: String(value), unit });
        },
        kvList(label, list) {
          const l = arr(list);
          if (!l.length) return;
          lines.push({ type: 'kv', label, value: l.join(', ') });
        },
        kvText(label, value) {
          if (!has(value)) return;
          lines.push({ type: 'text', label, value: String(value) });
        },
        rows(headers, items) {
          const r = arr(items);
          if (!r.length) return;
          lines.push({ type: 'rows', headers, items: r });
        },
        raw(text) {
          if (!has(text)) return;
          lines.push({ type: 'raw', value: String(text) });
        },
        sub(subtitle) {
          lines.push({ type: 'sub', value: subtitle });
        }
      };
      fn(api);
      // si la única línea es un "sub" (subtítulo) sin nada abajo, no cuenta como contenido
      const hasContent = lines.some((l) => l.type !== 'sub');
      if (!hasContent) return;

      n++;
      checkSpace(26);
      doc.moveDown(0.5);
      doc.fontSize(12).fillColor(GREEN).font('Helvetica-Bold').text(`${n}. ${title}`);
      doc.moveDown(0.15);
      doc.fillColor('#111');

      let pendingSub = false;
      for (const l of lines) {
        if (l.type === 'sub') { pendingSub = l.value; continue; }
        if (pendingSub) {
          checkSpace(16);
          doc.fontSize(9.5).font('Helvetica-BoldOblique').text(pendingSub);
          doc.moveDown(0.1);
          pendingSub = false;
        }
        if (l.type === 'kv') {
          checkSpace(13);
          doc.fontSize(9).font('Helvetica-Bold').text(`${l.label}: `, { continued: true });
          doc.font('Helvetica').text(`${l.value}${l.unit ? ' ' + l.unit : ''}`);
        } else if (l.type === 'text') {
          checkSpace(18);
          doc.fontSize(9).font('Helvetica-Bold').text(`${l.label}:`);
          doc.font('Helvetica').text(l.value);
          doc.moveDown(0.1);
        } else if (l.type === 'raw') {
          checkSpace(14);
          doc.fontSize(9).font('Helvetica').text(l.value);
        } else if (l.type === 'rows') {
          checkSpace(14);
          doc.fontSize(8.5).font('Helvetica-Bold').text(l.headers.join('  ·  '));
          doc.font('Helvetica');
          l.items.forEach((row) => {
            checkSpace(12);
            const line = l.headers.map((h, i) => has(row[i]) ? `${h}: ${row[i]}` : null).filter(Boolean).join('   ·   ');
            doc.fontSize(8.5).text(`– ${line}`);
          });
          doc.moveDown(0.15);
        }
      }
      doc.moveDown(0.25);
    }

    // -------- secciones --------
    section('Datos generales', (s) => {
      s.kv('Productor', d.productor);
      s.kv('Finca', d.finca);
      s.kv('Localidad/Departamento', d.localidad);
      s.kv('RENSPA/RUT', d.renspa);
      s.kv('CUIT', d.cuit);
      s.kv('Expediente SIGI', d.expedienteSigi);
      s.kv('Coordenadas', d.coordenadas);
      s.kv('Superficie total', d.superficieTotal, 'ha');
      s.kv('Superficie cultivada', d.superficieCultivada, 'ha');
      s.kv('Superficie inculta', d.superficieInculta, 'ha');
      s.kv('Superficie bajo riego', d.superficieBajoRiego, 'ha');
      s.kv('Superficie con derecho de riego', d.superficieDerecho, 'ha');
      s.kvList('Fuente de agua (derecho)', Array.isArray(d.fuenteRiegoDerecho) ? d.fuenteRiegoDerecho : (d.fuenteRiegoDerecho ? [d.fuenteRiegoDerecho] : []));
      s.kv('Detalle "Otra" fuente', d.fuenteRiegoDerechoOtroDetalle);
      s.kv('Padrón', d.ccpp);
      s.kv('Pozos', d.pozos);
      s.kv('Observaciones', d.obsGenerales);
    });

    section('Cultivos y producción', (s) => {
      const rows = arr(d.cultivos).filter((c) => has(c.cultivo)).map((c) => [c.cultivo, c.variedad, c.destino, c.anio, c.marco, c.superficie, has(c.rendimiento) ? c.rendimiento + ' ' + (c.rendimientoUnidad || '') : '']);
      s.rows(['Cultivo', 'Variedad', 'Destino', 'Año', 'Marco', 'Sup. (ha)', 'Rendimiento'], rows);
      s.kv('Aclaraciones sobre superficie/disponibilidad', d.aclaracionSuperficieCultivo);
      s.kv('Observaciones', d.obsCultivos);
      s.kv('Tipo de producción', d.tipoProduccion);
      if (d.tipoProduccion === 'Ganadería') {
        s.kv('Animales', d.ganaderiaAnimalTipo);
        s.kv('Cabezas', d.ganaderiaCabezas);
        s.kv('Manejo', d.ganaderiaManejo);
        s.kvList('Actividad (manejo)', arr(d.ganaderiaActividad).map((a) => a + ((d.ganaderiaActividadManejo || {})[a] ? ' — ' + d.ganaderiaActividadManejo[a] : '')));
        s.kvList('Categorías', d.ganaderiaCategorias);
      }
    });

    section('Suelo', (s) => {
      s.kv('Análisis de suelo', d.analisisSuelo);
      s.kv('Año del último análisis', d.anioAnalisisSuelo);
      s.kv('Archivo del análisis', d.analisisSueloArchivo && d.analisisSueloArchivo.originalName);
      s.kv('Aclaración', d.analisisSueloAclaracion);
      s.kv('Materia orgánica', d.materiaOrganicaPct, '%');
      s.kv('Fósforo (Pe)', d.fosforoPpm, 'ppm');
      s.kv('pH', d.phSuelo);
      s.kv('Textura', d.textura);
      s.kv('Profundidad', d.profundidadLimitante);
      s.kv('Profundidad efectiva', d.profundidadEfectivaCm, 'cm');
      s.kv('¿Hay piedras?', d.hayPiedras);
      s.kv('% de piedra', d.porcentajePiedra);
      s.kv('Nivel de salinidad', d.nivelSalinidadSuelo);
      s.kv('Observaciones del suelo', d.problemasSuelo);
      s.kv('Descripción del perfil', d.descripcionPerfilSuelo);
      s.kv('Otras observaciones', d.obsSuelo);
      s.kv('¿Sugiere análisis previo?', d.requiereAnalisisPrevio);
      s.kvList('Análisis sugeridos', d.requiereAnalisisPrevioQue);
      s.kv('Salinidad (tipo)', d.salinidadTipo);
    });

    section('Sistema de riego', (s) => {
      const sp = arr(d.sistemasPresentes);
      const superficial = sp.some((x) => ['Surcos', 'Melgas'].includes(x));
      const presurizado = sp.some((x) => ['Goteo', 'Aspersión'].includes(x));
      s.kv('Tipo de riego', d.tipoRiegoGeneral);
      s.kvList('Sistemas presentes', sp);
      s.kv('Detalle "Otro"', d.otroSistemaTexto);
      if (superficial) {
        s.sub('Riego superficial (surcos/melgas)');
        s.kv('Fuente de agua', d.rsFuente);
        s.kv('Superficie regada', d.rsSuperficie, 'ha');
        s.kv('Caudal medio', d.rsCaudal, 'l/s');
        s.kv('Frecuencia de turnado', d.rsFrecTurnado, 'días');
        s.kv('Duración de turnado', d.rsDuracionTurnado, 'hs');
        s.kv('Turnos por temporada', d.rsCantTurnos);
        s.kv('Método para decidir cuándo regar', d.rsMetodoDecision);
        s.kv('¿Riega toda la propiedad en cada turno?', d.rsRiegaTodaPropiedad);
        s.kv('% de superficie por turno', d.rsPctSuperficiePorTurno);
        s.kvList('Método para determinar la lámina', d.rsMetodoLamina);
        s.kv('Detalle método de lámina', d.rsMetodoLaminaDetalle);
        s.kv('Sistema de riego superficial', d.rsFormaRegar);
        s.kv('Hileras o surcos por tapada', d.rsCantHilerasSurcos);
        s.kv('¿Infraestructura para derivar el agua?', d.rsTieneInfraDerivar);
        s.kvList('Infraestructura utilizada', d.rsInfraDerivarItems);
        s.kvList('Tareas de mantenimiento', d.rsMantenimientoItems);
        s.kv('Nivelación: ¿cuándo se hizo?', d.rsNivelacionCuando);
        s.kv('Metodología de nivelación', d.rsMetodoNivelacion);
        s.kvList('En la tapada', d.rsTapadaItems);
        s.kv('Control de malezas', d.rsControlMalezas);
        s.kv('Infraestructura de riego', d.rsInfraestructura);
      }
      if (presurizado) {
        s.sub('Riego presurizado (goteo/aspersión)');
        s.kv('Fuente de agua', d.rpFuente);
        s.kv('Superficie regada', d.rpSuperficie, 'ha');
        s.kv('Tasa de precipitación', d.rpCaudal, 'mm/h');
        s.kv('Frecuencia por operación', d.rpFrecuencia, 'días');
        s.kv('Duración por operación', d.rpDuracion, 'hs');
        s.kvList('Método para determinar la lámina', d.rpMetodoLamina);
        s.kv('Detalle método de lámina', d.rpMetodoLaminaDetalle);
        s.kv('¿Caudalímetro en el equipo?', d.rpTieneCaudalimetro);
        s.kv('¿Controla horas de bombeo?', d.rpControlaHorasBombeo);
        s.kv('Sistema de filtrado', d.rpSistemaFiltrado);
        s.kv('Limpieza filtros primarios', d.rpFrecLimpiezaPrimario);
        s.kv('Limpieza filtros secundarios', d.rpFrecLimpiezaSecundario);
        s.kv('Parámetro de limpieza', d.rpParametroLimpieza);
        s.kv('¿Manómetros?', d.rpTieneManometros);
        s.kvList('Puntos de medición de presión', d.rpPuntosMedicion);
        s.kvList('Mantenimiento del equipo', d.rpMantenimientoItems);
        s.kvList('Control de válvulas', d.rpControlValvulasItems);
        s.kv('Cañerías', d.rpCanerias);
        s.kv('Laterales o cintas', d.rpLaterales);
        s.kv('¿Realiza medición de caudal?', d.rpRealizaMedicionCaudal);
        s.kv('Aclaración', d.rpAclaracionCaudal);
        s.kv('Problemas y limitantes (presurizado)', d.rpProblemas);
      }
      if (d.tipoRiegoGeneral !== 'No riega') {
        s.sub('Infraestructura y manejo');
        s.kv('Represa', d.represa);
        s.kv('Volumen represa', d.volumenRepresa, 'm³');
        s.kv('Medición de caudales', d.medicionCaudales);
        s.kv('Método de medición', d.metodoMedicion);
        s.kv('Asistencia técnica agronómica', d.asistenciaTecnica);
        s.kvList('Personal de riego', d.personalRiego);
        s.kv('Principales problemas y limitantes', d.rsProblemas);
        s.kv('Otras observaciones', d.obsRiego);
      }
    });

    section('Problemas y limitantes', (s) => {
      s.kvList('Problemas frecuentes', d.problemasFrecuentesItems);
      s.kv('Observaciones generales', d.problemasGeneralesObs);
      s.kvList('Limitantes para mejorar el riego', d.limitantesItems);
      s.kv('Detalle de limitantes', d.limitantesDetalle);
      s.kvList('Infraestructura deficiente en', d.infraDeficienteItems);
      s.kv('Interés en implementar mejoras', d.interesMejoras);
      s.kv('Tipo de mejora de interés', d.tipoMejoraInteres);
      s.kv('Observaciones', d.limitantesObs);
    });

    section('Propuesta de mejora', (s) => {
      s.kvText('Descripción técnica', d.descripcionMejora);
      s.kvList('Cambio propuesto', d.cambioPropuestoItems);
      s.kvList('Problema que resuelve', d.problemaJustificacionItems);
      s.kv('Justificación', d.justificacionDetalle);
      s.kv('Plazo estimado', d.tiempoTotalMeses, 'meses');
      s.kv('Cronograma (resumen)', d.cronogramaEtapas);
      s.kvText('Objetivos específicos', d.objetivosMejora);
      const invRows = arr(d.presupuesto).filter((p) => has(p.inversion) || has(p.montoUSD) || has(p.monto)).map((p) => [p.inversion, p.tipo, p.codN2, has(p.montoUSD) ? money(p.montoUSD) : '', p.superficieAsociada, p.monto]);
      s.sub('Mejoras propuestas (Nomenclador CFI)');
      s.rows(['Mejora', 'Categoría', 'Subcat.', 'Monto', 'Sup. asociada (ha)', 'Aclaración'], invRows);
      if (invRows.length) s.kv('Total de mejoras propuestas', money(arr(d.presupuesto).reduce((acc, p) => acc + (Number(p.montoUSD) || 0), 0)));
    });

    section('Materiales e insumos', (s) => {
      const mats = arr(d.materiales).filter((m) => has(m.item)).map((m) => [m.item, m.cantidad, m.unidad, m.obs]);
      s.rows(['Ítem / insumo', 'Cantidad', 'Unidad', 'Observaciones'], mats);
    });

    section('Indicadores e impacto esperado', (s) => {
      const inds = arr(d.indicadores).filter((i) => has(i.actual) || has(i.proyectada) || has(i.obs)).map((i) => [i.indicador, i.unidad, i.actual, i.proyectada, i.obs]);
      s.rows(['Indicador', 'Unidad', 'Situación actual', 'Situación proyectada', 'Observaciones'], inds);
      s.kv('Detalle productivo', d.impactoProductivoDetalle);
      s.kv('Detalle económico', d.impactoEconomicoDetalle);
      s.kv('Detalle ambiental', d.impactoAmbientalDetalle);
    });

    section('Cronograma y presupuesto', (s) => {
      const cronoRows = Array.isArray(d.cronograma)
        ? d.cronograma.filter((v) => has(v.etapa) && (has(v.desde) || has(v.hasta))).map((v) => [v.etapa, v.desde, v.hasta])
        : Object.keys(d.cronogramaGrid || {}).filter((k) => has(d.cronogramaGrid[k].desde) || has(d.cronogramaGrid[k].hasta)).map((k) => [k, d.cronogramaGrid[k].desde, d.cronogramaGrid[k].hasta]);
      s.rows(['Etapa', 'Mes desde', 'Mes hasta'], cronoRows);
      const detRows = arr(d.presupuestoDetallado).filter((p) => has(p.item)).map((p) => [p.item, p.cantidad, p.unidad, has(p.precioUnitario) ? money(p.precioUnitario) : '', money((Number(p.cantidad) || 0) * (Number(p.precioUnitario) || 0))]);
      s.rows(['Ítem', 'Cantidad', 'Unidad', 'Precio unitario', 'Subtotal'], detRows);
      if (detRows.length) {
        const totalDet = arr(d.presupuestoDetallado).reduce((acc, p) => acc + (Number(p.cantidad) || 0) * (Number(p.precioUnitario) || 0), 0);
        s.kv('Total solicitud programa de mejora', money(totalDet));
      }
      s.kv('% de aporte del productor', d.aportePorcentajeProductor);
      s.kv('% de financiamiento solicitado', d.financiamientoPorcentajeSolicitado);
    });

    section('Seguimiento y evaluación', (s) => {
      const logrados = arr(d.indicadores).filter((i) => has(i.logrado)).map((i) => [i.indicador, i.proyectada, i.logrado]);
      s.rows(['Indicador', 'Situación proyectada', 'Impacto logrado'], logrados);
      s.kv('Tipo de seguimiento', d.tipoSeguimiento);
      s.kv('Fecha estimada de seguimiento', d.fechaEstimadaSeguimiento);
      s.kv('Responsable técnico', d.responsableSeguimiento);
      s.kv('Recursos necesarios', d.recursosNecesariosSeguimiento);
      s.kvList('Métodos de control', d.metodosControl);
      s.kv('Detalle "Otro"', d.metodosControlOtro);
      s.kv('Periodicidad', d.periodicidad);
      s.kv('Criterios de éxito', d.criteriosExito);
    });

    if (sigs.cfi && sigs.cfi.informe) {
      section('Conformidad Técnica (CFI)', (s) => {
        s.raw(sigs.cfi.informe);
      });
    }

    // -------- firmas --------
    n++;
    checkSpace(30);
    doc.moveDown(0.5);
    doc.fontSize(12).fillColor(GREEN).font('Helvetica-Bold').text(`${n}. Firmas`);
    doc.moveDown(0.2);
    doc.fillColor('#111');
    for (const role of ['tecnico', 'provincia', 'cfi']) {
      const s = sigs[role];
      checkSpace(60);
      doc.fontSize(9.5).font('Helvetica-Bold').text(SIGNATURE_LABELS[role]);
      doc.fontSize(8.5).font('Helvetica');
      if (s) {
        doc.text(`Firmado — usuario ${s.usuario}  ·  ${fmtDate(s.timestamp)}`);
        doc.fontSize(7).fillColor('#666').text(`Hash de contenido: ${s.hash || '—'}`);
        doc.fillColor('#111');
        if (s.image) {
          try {
            const b64 = String(s.image).replace(/^data:image\/\w+;base64,/, '');
            const buf = Buffer.from(b64, 'base64');
            if (pngDecodeOk(buf)) {
              checkSpace(70);
              const imgX = doc.x, imgY = doc.y;
              doc.image(buf, imgX, imgY, { width: 160, height: 60, fit: [160, 60] });
              doc.y = imgY + 64; // doc.image() no mueve el cursor solo — hay que avanzarlo a mano o el texto siguiente queda encimado
              doc.x = doc.page.margins.left;
            }
          } catch (e) { /* si la imagen de firma está corrupta, se omite sin romper el PDF */ }
        }
      } else {
        doc.text('Pendiente');
      }
      doc.moveDown(0.4);
    }

    doc.moveDown(0.3);
    doc.fontSize(7.5).fillColor('#666').text('Documento generado automáticamente por Diagnóstico Técnico de Riego. Las firmas electrónicas registran usuario autenticado, reautenticación al momento de firmar, fecha/hora del servidor y hash del contenido firmado.');

    doc.end();
  });
}

module.exports = { generarDiagnosticoPDF };
