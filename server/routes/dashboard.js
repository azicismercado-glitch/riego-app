const express = require('express');
const XLSX = require('xlsx');
const db = require('../db');
const { requireAuth, requireRole } = require('../auth');
const { getScope, visibleClause } = require('../access');
const { STAGES, STAGE_LABELS, completeness, normalizeCuit } = require('../constants');

const router = express.Router();
router.use(requireAuth);

// Días sin cambiar de etapa a partir de los cuales un diagnóstico se considera
// "estancado" y se lo señala en el panel para seguimiento activo.
const STALE_DAYS = Number(process.env.DASHBOARD_STALE_DIAS) || 10;

function nombreDiag(data, id) {
  return data.finca || data.productor || ('Diagnóstico #' + id);
}

// "Superficie regada" (rsSuperficie / rpSuperficie, pestaña Riego) es texto
// libre en el formulario — a veces el técnico escribe una descripción en vez
// de un número (ej. "Toda la superficie de durazno y ajo"). Se extrae el
// primer número que aparezca; si no hay ninguno, el diagnóstico queda afuera
// de la suma y se cuenta aparte para no informar un total falsamente exacto.
function parseSuperficie(v) {
  if (v == null) return null;
  const m = String(v).replace(',', '.').match(/\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

// Arma todo el panel agregado del programa: pensado para que el área de
// créditos / gerencia pueda ver de un vistazo cuántos diagnósticos hay en
// cada etapa, cuánto dinero se está pidiendo, en qué tipo de inversión, en
// qué zonas, cuáles están estancados sin avanzar, cuáles tienen datos
// incompletos, y cómo viene el embudo consulta -> diagnóstico -> crédito.
// La usan tanto GET / (para la vista del panel) como GET /export (para el
// Excel descargable), así evitamos calcular todo dos veces con lógica duplicada.
async function buildDashboard(scope) {
  const v = visibleClause(scope);
  const { rows } = await db.query(
    `SELECT d.id, d.data, d.doc_status, d.created_by, d.created_at, d.updated_at FROM diagnosticos d LEFT JOIN users cu ON cu.id = d.created_by WHERE ${v.sql}`,
    v.params
  );
  const fotosRes = await db.query('SELECT diagnostico_id, COUNT(*)::int AS cnt FROM fotos GROUP BY diagnostico_id');
  const fotosPorDiag = {};
  fotosRes.rows.forEach((r) => { fotosPorDiag[r.diagnostico_id] = r.cnt; });

  // La provincia de un diagnóstico no se carga a mano: se deduce de quién lo
  // creó, porque cada técnico (y cada responsable provincial) atiende una
  // sola provincia (ver server/seed.js).
  const usersRes = await db.query('SELECT id, provincia FROM users');
  const provinciaPorUserId = {};
  usersRes.rows.forEach((u) => { provinciaPorUserId[u.id] = u.provincia; });

  // SIGI y consultas provinciales son datos opcionales que se importan por
  // Excel: si esas tablas todavía no existen (base recién migrada) o la
  // consulta falla, el panel sigue mostrando el resto y marca la sección
  // como no disponible, en vez de tirar abajo el servidor.
  let creditosRes = { rows: [] };
  let consultasRes = { rows: [] };
  let sigiDisponible = true;
  try {
    creditosRes = await db.query('SELECT cuit, expediente, titular, linea_programa, monto_ars, desembolso FROM creditos_sigi');
    consultasRes = await db.query('SELECT cuit, provincia, solicitante, estado_normalizado, monto_credito_ars FROM consultas');
  } catch (e) {
    console.error('Panel: datos SIGI/consultas no disponibles —', e.message);
    sigiDisponible = false;
  }
  // Créditos SIGI y consultas provinciales son datos de todo el programa: solo los ven cfi y lector.
  if (scope) { creditosRes = { rows: [] }; consultasRes = { rows: [] }; }

  const creditosPorCuit = {};
  creditosRes.rows.forEach((r) => { creditosPorCuit[r.cuit] = r; });

  const cuitsConDiagnostico = new Set();

  const porEstado = {};
  STAGES.forEach((s) => { porEstado[s] = 0; });

  const montoPorTipo = {};
  const porLocalidad = {};
  const montoPorLocalidad = {};
  let montoTotalUSD = 0;
  let itemsSinCategorizar = 0;
  const estancados = [];
  const incompletos = [];
  const now = Date.now();

  const sigiMatches = [];
  let sigiSinCuit = 0, sigiSinMatch = 0, sigiEnTramite = 0, sigiDesembolsados = 0;
  let montoDesembolsadoARS = 0, montoEnTramiteARS = 0;

  let superficieRegadaHa = 0, superficieSuperficialHa = 0, superficiePresurizadaHa = 0;
  let diagnosticosSuperficieSinDato = 0;
  const superficiePorProvincia = {};
  const superficiePorLocalidad = {};

  for (const d of rows) {
    porEstado[d.doc_status] = (porEstado[d.doc_status] || 0) + 1;

    const loc = (d.data.localidad || '').trim() || 'Sin especificar';
    porLocalidad[loc] = (porLocalidad[loc] || 0) + 1;

    const provinciaDiag = (provinciaPorUserId[d.created_by] || '').trim() || 'Sin especificar';
    const rsHa = parseSuperficie(d.data.rsSuperficie);
    const rpHa = parseSuperficie(d.data.rpSuperficie);
    const supDiagHa = (rsHa || 0) + (rpHa || 0);
    if (rsHa != null) { superficieSuperficialHa += rsHa; superficieRegadaHa += rsHa; }
    if (rpHa != null) { superficiePresurizadaHa += rpHa; superficieRegadaHa += rpHa; }
    if ((d.data.sistemasPresentes || []).length > 0 && rsHa == null && rpHa == null) diagnosticosSuperficieSinDato++;
    if (rsHa != null || rpHa != null) {
      superficiePorProvincia[provinciaDiag] = (superficiePorProvincia[provinciaDiag] || 0) + supDiagHa;
      superficiePorLocalidad[loc] = (superficiePorLocalidad[loc] || 0) + supDiagHa;
    }

    for (const p of d.data.presupuesto || []) {
      const monto = Number(p.montoUSD) || 0;
      if (monto <= 0) continue;
      montoTotalUSD += monto;
      const tipo = (p.tipo || '').trim() || 'Sin categorizar';
      if (tipo === 'Sin categorizar') itemsSinCategorizar++;
      montoPorTipo[tipo] = (montoPorTipo[tipo] || 0) + monto;
      montoPorLocalidad[loc] = (montoPorLocalidad[loc] || 0) + monto;
    }

    const cuit = normalizeCuit(d.data.cuit);
    if (cuit) cuitsConDiagnostico.add(cuit);
    if (!cuit) {
      sigiSinCuit++;
    } else {
      const credito = creditosPorCuit[cuit];
      if (!credito) {
        sigiSinMatch++;
      } else {
        const desembolso = (credito.desembolso || '').trim();
        const estado = !desembolso ? 'Sin dato' : /en\s*tr[aá]mite/i.test(desembolso) ? 'En trámite' : 'Desembolsado';
        const montoARS = Number(credito.monto_ars) || 0;
        sigiMatches.push({
          id: d.id,
          nombre: nombreDiag(d.data, d.id),
          cuit: d.data.cuit,
          expediente: credito.expediente,
          lineaPrograma: credito.linea_programa,
          montoARS,
          estado,
          desembolso
        });
      }
    }

    if (d.doc_status !== 'firmado_cfi') {
      const diasSinAvanzar = Math.floor((now - new Date(d.updated_at).getTime()) / 86400000);
      if (diasSinAvanzar >= STALE_DAYS) {
        estancados.push({
          id: d.id,
          nombre: nombreDiag(d.data, d.id),
          etapa: STAGE_LABELS[d.doc_status],
          diasSinAvanzar
        });
      }

      const comp = completeness(d.data, fotosPorDiag[d.id] || 0);
      if (comp.pct < 100) {
        incompletos.push({
          id: d.id,
          nombre: nombreDiag(d.data, d.id),
          etapa: STAGE_LABELS[d.doc_status],
          pct: comp.pct
        });
      }
    }
  }
  estancados.sort((a, b) => b.diasSinAvanzar - a.diasSinAvanzar);
  incompletos.sort((a, b) => a.pct - b.pct);

  // Los montos y cantidades de "en trámite" / "desembolsado" se calculan sobre
  // TODOS los créditos importados de SIGI (no solo los que además coinciden
  // con un diagnóstico nuestro), para que reflejen la realidad del programa
  // aunque todavía falte cargar el CUIT en los diagnósticos.
  creditosRes.rows.forEach((credito) => {
    const desembolso = (credito.desembolso || '').trim();
    const enTramite = /en\s*tr[aá]mite/i.test(desembolso);
    const estado = !desembolso ? 'Sin dato' : enTramite ? 'En trámite' : 'Desembolsado';
    const montoARS = Number(credito.monto_ars) || 0;
    if (estado === 'Desembolsado') { sigiDesembolsados++; montoDesembolsadoARS += montoARS; }
    else if (estado === 'En trámite') { sigiEnTramite++; montoEnTramiteARS += montoARS; }
  });

  // Embudo del programa: Consulta (provincia) -> Diagnóstico (nuestra app) ->
  // Crédito (SIGI), más cuántas quedaron desistidas o en trámite en el camino.
  const porProvinciaMap = {};
  let consultasDesistidas = 0, consultasEnTramite = 0, consultasDesembolsadas = 0;
  let consultasConDiagnostico = 0, consultasConCredito = 0;
  for (const c of consultasRes.rows) {
    if (c.estado_normalizado === 'Desistido') consultasDesistidas++;
    else if (c.estado_normalizado === 'Desembolsado') consultasDesembolsadas++;
    else consultasEnTramite++;

    const tieneDiag = cuitsConDiagnostico.has(c.cuit);
    const tieneCred = !!creditosPorCuit[c.cuit];
    if (tieneDiag) consultasConDiagnostico++;
    if (tieneCred) consultasConCredito++;

    const prov = c.provincia || 'Sin especificar';
    if (!porProvinciaMap[prov]) porProvinciaMap[prov] = { provincia: prov, total: 0, desistidos: 0, conDiagnostico: 0, conCredito: 0 };
    porProvinciaMap[prov].total++;
    if (c.estado_normalizado === 'Desistido') porProvinciaMap[prov].desistidos++;
    if (tieneDiag) porProvinciaMap[prov].conDiagnostico++;
    if (tieneCred) porProvinciaMap[prov].conCredito++;
  }
  const embudoPorProvincia = Object.values(porProvinciaMap).sort((a, b) => b.total - a.total);
  const embudoDetalle = consultasRes.rows.map((c) => ({
    cuit: c.cuit,
    solicitante: c.solicitante,
    provincia: c.provincia,
    montoARS: Number(c.monto_credito_ars) || 0,
    estado: c.estado_normalizado,
    conDiagnostico: cuitsConDiagnostico.has(c.cuit),
    conCredito: !!creditosPorCuit[c.cuit]
  }));

  const aprobados = rows.filter((d) => d.doc_status === 'firmado_cfi');
  let tiempoPromedioDias = null;
  if (aprobados.length) {
    const totalDias = aprobados.reduce((acc, d) => acc + (new Date(d.updated_at) - new Date(d.created_at)) / 86400000, 0);
    tiempoPromedioDias = +(totalDias / aprobados.length).toFixed(1);
  }

  const porEstadoConLabel = STAGES.map((s) => ({ estado: s, label: STAGE_LABELS[s], cantidad: porEstado[s] }));
  const montoPorTipoArr = Object.entries(montoPorTipo).sort((a, b) => b[1] - a[1]).map(([tipo, monto]) => ({ tipo, monto }));
  const porLocalidadArr = Object.entries(porLocalidad).sort((a, b) => b[1] - a[1]).map(([localidad, cantidad]) => {
    const monto = montoPorLocalidad[localidad] || 0;
    const pct = montoTotalUSD > 0 ? +((monto / montoTotalUSD) * 100).toFixed(1) : 0;
    const superficieHa = +((superficiePorLocalidad[localidad] || 0).toFixed(1));
    return { localidad, cantidad, monto, pct, superficieHa };
  });
  const superficiePorProvinciaArr = Object.entries(superficiePorProvincia)
    .sort((a, b) => b[1] - a[1])
    .map(([provincia, superficieHa]) => ({ provincia, superficieHa: +superficieHa.toFixed(1) }));
  const superficiePorLocalidadArr = Object.entries(superficiePorLocalidad)
    .sort((a, b) => b[1] - a[1])
    .map(([localidad, superficieHa]) => ({ localidad, superficieHa: +superficieHa.toFixed(1) }));

  return {
    total: rows.length,
    aprobados: aprobados.length,
    porEstado: porEstadoConLabel,
    montoTotalUSD,
    montoPorTipo: montoPorTipoArr,
    porLocalidad: porLocalidadArr,
    tiempoPromedioDias,
    itemsSinCategorizar,
    superficieRegadaHa: +superficieRegadaHa.toFixed(1),
    superficieSuperficialHa: +superficieSuperficialHa.toFixed(1),
    superficiePresurizadaHa: +superficiePresurizadaHa.toFixed(1),
    superficiePorProvincia: superficiePorProvinciaArr,
    superficiePorLocalidad: superficiePorLocalidadArr,
    diagnosticosSuperficieSinDato,
    staleDays: STALE_DAYS,
    estancados,
    incompletos,
    creditosSigi: {
      disponible: sigiDisponible,
      totalImportados: creditosRes.rows.length,
      sinCuit: sigiSinCuit,
      sinMatch: sigiSinMatch,
      enTramite: sigiEnTramite,
      desembolsados: sigiDesembolsados,
      montoDesembolsadoARS,
      montoEnTramiteARS,
      matches: sigiMatches
    },
    embudo: {
      totalConsultas: consultasRes.rows.length,
      desistidas: consultasDesistidas,
      enTramite: consultasEnTramite,
      desembolsadas: consultasDesembolsadas,
      conDiagnostico: consultasConDiagnostico,
      conCredito: consultasConCredito,
      porProvincia: embudoPorProvincia,
      detalle: embudoDetalle
    }
  };
}

router.get('/', async (req, res, next) => {
  try {
    res.json(await buildDashboard(await getScope(req.user)));
  } catch (e) {
    next(e); // lo toma el error-handler de index.js -> 500 {error}, sin caer el proceso
  }
});

// Excel descargable del panel: una hoja prolija por sección, en vez de un
// único CSV con todo apilado, para que se pueda abrir y leer cómodamente.
function autoWidth(rowsAoa) {
  const widths = [];
  rowsAoa.forEach((r) => {
    r.forEach((cell, i) => {
      const len = String(cell == null ? '' : cell).length;
      widths[i] = Math.max(widths[i] || 8, Math.min(len + 2, 48));
    });
  });
  return widths.map((w) => ({ wch: w }));
}
function addSheet(wb, name, rowsAoa) {
  const ws = XLSX.utils.aoa_to_sheet(rowsAoa);
  ws['!cols'] = autoWidth(rowsAoa);
  XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
}

router.get('/export', async (req, res) => {
  try {
    const dash = await buildDashboard(await getScope(req.user));
    const wb = XLSX.utils.book_new();

    addSheet(wb, 'Resumen', [
      ['Indicador', 'Valor'],
      ['Diagnósticos totales', dash.total],
      ['Validados por CFI', dash.aprobados],
      ['Monto total solicitado ($)', dash.montoTotalUSD],
      ['Tiempo promedio de aprobación (días)', dash.tiempoPromedioDias != null ? dash.tiempoPromedioDias : ''],
      ['Superficie regada total (ha)', dash.superficieRegadaHa],
      ['  · superficial (surcos/melgas) (ha)', dash.superficieSuperficialHa],
      ['  · presurizada (goteo/aspersión) (ha)', dash.superficiePresurizadaHa],
      ['Diagnósticos con sistema de riego pero sin superficie numérica cargada', dash.diagnosticosSuperficieSinDato]
    ]);

    addSheet(wb, 'Por etapa', [
      ['Etapa', 'Cantidad'],
      ...dash.porEstado.map((e) => [e.label, e.cantidad])
    ]);

    addSheet(wb, 'Monto por tipo', [
      ['Tipo de inversión', 'Monto ($)'],
      ...dash.montoPorTipo.map((t) => [t.tipo, t.monto])
    ]);

    addSheet(wb, 'Por localidad', [
      ['Localidad', 'Cantidad', 'Monto ($)', '% del total', 'Superficie regada (ha)'],
      ...dash.porLocalidad.map((l) => [l.localidad, l.cantidad, l.monto, l.pct, l.superficieHa])
    ]);

    addSheet(wb, 'Superficie por provincia', [
      ['Provincia', 'Superficie regada (ha)'],
      ...dash.superficiePorProvincia.map((p) => [p.provincia, p.superficieHa])
    ]);

    addSheet(wb, 'Demorados', [
      [`Diagnósticos demorados (más de ${dash.staleDays} días sin avanzar)`],
      ['ID', 'Nombre', 'Etapa', 'Días sin avanzar'],
      ...dash.estancados.map((e) => [e.id, e.nombre, e.etapa, e.diasSinAvanzar])
    ]);

    addSheet(wb, 'Datos incompletos', [
      ['ID', 'Nombre', 'Etapa', '% completo'],
      ...dash.incompletos.map((e) => [e.id, e.nombre, e.etapa, e.pct])
    ]);

    addSheet(wb, 'Créditos SIGI', [
      ['Indicador', 'Valor'],
      ['Registros importados de SIGI', dash.creditosSigi.totalImportados],
      ['Diagnósticos sin CUIT cargado', dash.creditosSigi.sinCuit],
      ['Diagnósticos con CUIT sin match en SIGI', dash.creditosSigi.sinMatch],
      ['En trámite', dash.creditosSigi.enTramite],
      ['Desembolsados', dash.creditosSigi.desembolsados],
      ['Monto desembolsado (ARS)', dash.creditosSigi.montoDesembolsadoARS],
      ['Monto en trámite (ARS)', dash.creditosSigi.montoEnTramiteARS],
      [],
      ['ID', 'Nombre', 'CUIT', 'Expediente', 'Estado', 'Monto (ARS)'],
      ...dash.creditosSigi.matches.map((m) => [m.id, m.nombre, m.cuit, m.expediente, m.estado, m.montoARS])
    ]);

    addSheet(wb, 'Embudo', [
      ['Indicador', 'Valor'],
      ['Consultas totales', dash.embudo.totalConsultas],
      ['Con diagnóstico técnico', dash.embudo.conDiagnostico],
      ['Con crédito (SIGI)', dash.embudo.conCredito],
      ['En trámite', dash.embudo.enTramite],
      ['Desembolsadas', dash.embudo.desembolsadas],
      ['Desistidas', dash.embudo.desistidas],
      [],
      ['Provincia', 'Total consultas', 'Con diagnóstico', 'Con crédito', 'Desistidos'],
      ...dash.embudo.porProvincia.map((p) => [p.provincia, p.total, p.conDiagnostico, p.conCredito, p.desistidos])
    ]);

    addSheet(wb, 'Detalle consultas', [
      ['CUIT', 'Solicitante', 'Provincia', 'Monto crédito (ARS)', 'Estado', 'Con diagnóstico', 'Con crédito SIGI'],
      ...dash.embudo.detalle.map((c) => [c.cuit, c.solicitante, c.provincia, c.montoARS, c.estado, c.conDiagnostico ? 'Sí' : 'No', c.conCredito ? 'Sí' : 'No'])
    ]);

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="panel-riego-${new Date().toISOString().slice(0, 10)}.xlsx"`);
    res.send(buf);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
