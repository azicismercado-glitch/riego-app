require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const diagnosticosRoutes = require('./routes/diagnosticos');
const fotosRoutes = require('./routes/fotos');
const emailsRoutes = require('./routes/emails');

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/diagnosticos', diagnosticosRoutes);
app.use('/api/diagnosticos', fotosRoutes);
app.use('/api/emails', emailsRoutes);

app.use(express.static(path.join(__dirname, '..', 'public')));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Error interno del servidor' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Diagnóstico Técnico de Riego escuchando en http://localhost:${PORT}`);
});
