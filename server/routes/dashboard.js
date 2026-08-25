const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../auth');
const { STAGES, STAGE_LABELS, completeness, normalizeCuit } = require('../constants');

const router = express.Router();
router.use(requireAuth);

// Días sin cambiar de etapa a partir de los cuales un diagnóstico se considera
// "estancado" y se lo señala en el panel para seguimiento activo.
const STALE_DAYS = Number(process.env.DASHBOARD_STALE_DIAS) || 10;

function nombreDiag(data, id) {
  return data.finca || data.productor || ('Diagnóstico #' + id);
}

// Panel agregado del programa: pensado para que el área de créditos / gerencia
// pueda ver de un vistazo cuántos diagnósticos hay en cada etapa, cuánto dinero
// se está pidiendo, en qué tipo de inversión, en qué zonas, cuáles están
// estancados sin avanzar, y cuáles tienen datos incompletos.
router.get('/', async (req, res) => {
  const { rows } = await db.query('SELECT id, data, doc_status, created_at, updated_at FROM diagnosticos');
  const fotosRes = await db.query('SELECT diagnostico_id, COUNT(*)::int AS cnt FROM fotos GROUP BY diagnostico_id');
  const fotosPorDiag = {};
  fotosRes.rows.forEach((r) => { fotosPorDiag[r.diagnostico_id] = r.cnt; });

  const creditosRes = await db.query('SELECT cuit, expediente, titular, linea_programa, monto_ars, desembolso FROM creditos_sigi');
  const creditosPorCuit = {};
  creditosRes.rows.forEach((r) => { creditosPorCuit[r.cuit] = r; });

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

  for (const d of rows) {
    porEstado[d.doc_status] = (porEstado[d.doc_status] || 0) + 1;

    const loc = (d.data.localidad || '').trim() || 'Sin especificar';
    porLocalidad[loc] = (porLocalidad[loc] || 0) + 1;

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
        if (estado === 'Desembolsado') { sigiDesembolsados++; montoDesembolsadoARS += montoARS; }
        else if (estado === 'En trámite') { sigiEnTramite++; montoEnTramiteARS += montoARS; }
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
    return { localidad, cantidad, monto, pct };
  });

  res.json({
    total: rows.length,
    aprobados: aprobados.length,
    porEstado: porEstadoConLabel,
    montoTotalUSD,
    montoPorTipo: montoPorTipoArr,
    porLocalidad: porLocalidadArr,
    tiempoPromedioDias,
    itemsSinCategorizar,
    staleDays: STALE_DAYS,
    estancados,
    incompletos,
    creditosSigi: {
      totalImportados: creditosRes.rows.length,
      sinCuit: sigiSinCuit,
      sinMatch: sigiSinMatch,
      enTramite: sigiEnTramite,
      desembolsados: sigiDesembolsados,
      montoDesembolsadoARS,
      montoEnTramiteARS,
      matches: sigiMatches
    }
  });
});

module.exports = router;
