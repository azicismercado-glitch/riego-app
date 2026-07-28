const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');
const { smtpConfigured } = require('../mailer');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const { rows } = await db.query('SELECT * FROM emails ORDER BY created_at DESC LIMIT 200');
  res.json({ emails: rows, smtpConfigured: smtpConfigured() });
});

router.get('/unread-count', async (req, res) => {
  const { rows } = await db.query('SELECT count(*)::int AS n FROM emails WHERE leido = false');
  res.json({ count: rows[0].n });
});

router.post('/marcar-leidos', async (req, res) => {
  await db.query('UPDATE emails SET leido = true WHERE leido = false');
  res.json({ ok: true });
});

module.exports = router;
