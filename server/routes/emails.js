const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');
const { smtpConfigured } = require('../mailer');
const { getScope, visibleClause } = require('../access');

// Un mensaje se ve si no está ligado a un diagnóstico o si el diagnóstico es visible para el usuario.
async function emailFilter(req, firstParam = 1) {
  const v = visibleClause(await getScope(req.user), firstParam);
  return {
    sql: `(e.diagnostico_id IS NULL OR e.diagnostico_id IN (SELECT d.id FROM diagnosticos d LEFT JOIN users cu ON cu.id = d.created_by WHERE ${v.sql}))`,
    params: v.params
  };
}

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const f = await emailFilter(req);
  const { rows } = await db.query(`SELECT e.* FROM emails e WHERE ${f.sql} ORDER BY e.created_at DESC LIMIT 200`, f.params);
  res.json({ emails: rows, smtpConfigured: smtpConfigured() });
});

router.get('/unread-count', async (req, res) => {
  const f = await emailFilter(req);
  const { rows } = await db.query(`SELECT count(*)::int AS n FROM emails e WHERE e.leido = false AND ${f.sql}`, f.params);
  res.json({ count: rows[0].n });
});

router.post('/marcar-leidos', async (req, res) => {
  const f = await emailFilter(req);
  await db.query(`UPDATE emails e SET leido = true WHERE e.leido = false AND ${f.sql}`, f.params);
  res.json({ ok: true });
});

module.exports = router;
