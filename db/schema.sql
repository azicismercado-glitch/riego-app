-- Esquema de base de datos para Diagnóstico Técnico de Riego (CFI/DGI)
-- PostgreSQL

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('tecnico','provincia','cfi','lector')),
  nombre TEXT NOT NULL,
  rol_label TEXT NOT NULL,
  email TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS diagnosticos (
  id SERIAL PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  doc_status TEXT NOT NULL DEFAULT 'borrador'
    CHECK (doc_status IN ('borrador','firmado_tecnico','firmado_provincia','firmado_cfi')),
  rejection JSONB,
  informe_conformidad TEXT NOT NULL DEFAULT '',
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS signatures (
  id SERIAL PRIMARY KEY,
  diagnostico_id INTEGER NOT NULL REFERENCES diagnosticos(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('tecnico','provincia','cfi')),
  usuario TEXT NOT NULL,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  geo TEXT,
  hash TEXT NOT NULL,
  signature_image TEXT, -- PNG en base64 capturado del canvas
  con_observaciones BOOLEAN NOT NULL DEFAULT false,
  observaciones TEXT DEFAULT '',
  informe TEXT,
  UNIQUE (diagnostico_id, role)
);

CREATE TABLE IF NOT EXISTS historial (
  id SERIAL PRIMARY KEY,
  diagnostico_id INTEGER NOT NULL REFERENCES diagnosticos(id) ON DELETE CASCADE,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  usuario TEXT NOT NULL,
  evento TEXT NOT NULL,
  detalle TEXT DEFAULT '',
  tipo TEXT NOT NULL DEFAULT 'ok'
);

CREATE TABLE IF NOT EXISTS fotos (
  id SERIAL PRIMARY KEY,
  diagnostico_id INTEGER NOT NULL REFERENCES diagnosticos(id) ON DELETE CASCADE,
  slot_index INTEGER NOT NULL,
  filename TEXT NOT NULL,
  mimetype TEXT,
  lat NUMERIC,
  lng NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (diagnostico_id, slot_index)
);

CREATE TABLE IF NOT EXISTS emails (
  id SERIAL PRIMARY KEY,
  diagnostico_id INTEGER REFERENCES diagnosticos(id) ON DELETE SET NULL,
  to_email TEXT NOT NULL,
  to_name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'sent' | 'failed' | 'logged'
  error TEXT,
  leido BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Créditos importados desde SIGI (CFI), para cruzar por CUIT con nuestros
-- diagnósticos y saber cuáles ya tienen crédito otorgado/desembolsado.
CREATE TABLE IF NOT EXISTS creditos_sigi (
  id SERIAL PRIMARY KEY,
  cuit TEXT UNIQUE NOT NULL,
  expediente TEXT,
  titular TEXT,
  linea_programa TEXT,
  monto_ars NUMERIC,
  desembolso TEXT,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_signatures_diag ON signatures(diagnostico_id);
CREATE INDEX IF NOT EXISTS idx_historial_diag ON historial(diagnostico_id);
CREATE INDEX IF NOT EXISTS idx_fotos_diag ON fotos(diagnostico_id);
CREATE INDEX IF NOT EXISTS idx_emails_diag ON emails(diagnostico_id);
