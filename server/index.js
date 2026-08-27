require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const diagnosticosRoutes = require('./routes/diagnosticos');
const fotosRoutes = require('./routes/fotos');
const emailsRoutes = require('./routes/emails');
const dashboardRoutes = require('./routes/dashboard');
const creditosSigiRoutes = require('./routes/creditosSigi');
const adminRoutes = require('./routes/admin');
const consultasRoutes = require('./routes/consultas');
const documentoSueloRoutes = require('./routes/documentoSuelo');

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/diagnosticos', diagnosticosRoutes);
app.use('/api/diagnosticos', fotosRoutes);
app.use('/api/emails', emailsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/creditos-sigi', creditosSigiRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/consultas', consultasRoutes);
app.use('/api/diagnosticos', documentoSueloRoutes);

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
