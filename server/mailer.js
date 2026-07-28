const nodemailer = require('nodemailer');
const db = require('./db');

const DEMO_USERS_BY_ROLE = {
  tecnico: { nombre: 'Ana Pérez', email: 'aperez@dgi.mendoza.gov.ar' },
  provincia: { nombre: 'Mario Gómez', email: 'mgomez@mendoza.gov.ar' },
  cfi: { nombre: 'Lucas Costa', email: 'lcosta@cfi.org.ar' }
};

let transporter = null;
function smtpConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}
function getTransporter() {
  if (!smtpConfigured()) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
  }
  return transporter;
}

/**
 * Guarda el correo en la tabla `emails` (bandeja persistida) y, si hay SMTP
 * configurado en el .env, además lo envía de verdad. Si no hay credenciales
 * todavía, queda logueado en consola y en la base con estado "logged" para
 * no perder la trazabilidad — se puede reenviar más adelante.
 */
async function sendMail({ diagnosticoId, toKey, subject, body }) {
  const dest = DEMO_USERS_BY_ROLE[toKey];
  if (!dest) throw new Error('Destinatario desconocido: ' + toKey);

  let status = 'logged';
  let error = null;
  const t = getTransporter();
  if (t) {
    try {
      await t.sendMail({
        from: process.env.SMTP_FROM || 'no-reply@example.org',
        to: `${dest.nombre} <${dest.email}>`,
        subject,
        text: body
      });
      status = 'sent';
    } catch (e) {
      status = 'failed';
      error = e.message;
      console.error('[mailer] Error enviando correo real:', e.message);
    }
  } else {
    console.log(`[mailer] SMTP no configurado — correo guardado sin enviar. Para: ${dest.email} · Asunto: ${subject}`);
  }

  const { rows } = await db.query(
    `INSERT INTO emails (diagnostico_id, to_email, to_name, subject, body, status, error)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [diagnosticoId, dest.email, dest.nombre, subject, body, status, error]
  );
  return rows[0];
}

/**
 * Replica las notificaciones del prototipo original para cada evento del
 * circuito de firmas.
 */
async function sendEmailNotif(diagnosticoId, finca, productor, tipo, extra) {
  finca = finca || 'diagnóstico sin nombre';
  productor = productor || 's/d';
  const enviados = [];

  const push = async (toKey, subject, body) => enviados.push(await sendMail({ diagnosticoId, toKey, subject, body }));

  if (tipo === 'firma_tecnico') {
    await push('provincia', `[DTR] ${finca} — listo para tu revisión`,
`Hola ${DEMO_USERS_BY_ROLE.provincia.nombre},

El técnico de campo ${DEMO_USERS_BY_ROLE.tecnico.nombre} firmó el Diagnóstico Técnico de Riego de la finca "${finca}" (productor: ${productor}).

Te corresponde revisarlo y validarlo (o devolverlo con observaciones) como Responsable provincial.

Ingresá a la aplicación para continuar el proceso.`);
  }
  if (tipo === 'firma_provincia') {
    await push('cfi', `[DTR] ${finca} — listo para validación de CFI`,
`Hola ${DEMO_USERS_BY_ROLE.cfi.nombre},

El Responsable provincial ${DEMO_USERS_BY_ROLE.provincia.nombre} validó y firmó el Diagnóstico Técnico de Riego de la finca "${finca}" (productor: ${productor}).

Te corresponde la validación técnica final y la emisión de la Conformidad Técnica.

Ingresá a la aplicación para continuar el proceso.`);
  }
  if (tipo === 'firma_cfi') {
    const conObs = extra && extra.conObservaciones;
    await push('tecnico', `[DTR] ${finca} — validado por CFI${conObs ? ' (con observaciones)' : ''}`,
`Hola ${DEMO_USERS_BY_ROLE.tecnico.nombre},

El Diagnóstico Técnico de Riego de la finca "${finca}" (productor: ${productor}) fue validado técnicamente por CFI y queda habilitado para avanzar a la evaluación financiera.${conObs ? `

ATENCIÓN — quedó sujeto a complementar la siguiente información:
${extra.observaciones}` : ''}

El documento final firmado ya está disponible en la aplicación.`);
    await push('provincia', `[DTR] ${finca} — proceso completado`,
`Hola ${DEMO_USERS_BY_ROLE.provincia.nombre},

Te informamos que el Diagnóstico Técnico de Riego de la finca "${finca}" completó el circuito de firmas y fue validado por CFI.`);
  }
  if (tipo === 'rechazo_provincia') {
    await push('tecnico', `[DTR] ${finca} — devuelto por el Responsable provincial`,
`Hola ${DEMO_USERS_BY_ROLE.tecnico.nombre},

El Responsable provincial ${DEMO_USERS_BY_ROLE.provincia.nombre} devolvió el Diagnóstico Técnico de Riego de la finca "${finca}" (productor: ${productor}).

Motivo:
${extra.motivo}

Te corresponde corregir el diagnóstico y volver a firmarlo para reiniciar el circuito.`);
  }
  if (tipo === 'rechazo_cfi') {
    await push('provincia', `[DTR] ${finca} — devuelto por CFI`,
`Hola ${DEMO_USERS_BY_ROLE.provincia.nombre},

El equipo técnico de CFI (${DEMO_USERS_BY_ROLE.cfi.nombre}) devolvió el Diagnóstico Técnico de Riego de la finca "${finca}" (productor: ${productor}).

Motivo:
${extra.motivo}

El expediente volvió a tu instancia: podés revisarlo nuevamente o, si la corrección corresponde al relevamiento de campo, devolvérselo al técnico.`);
  }
  return enviados;
}

module.exports = { sendEmailNotif, sendMail, smtpConfigured, DEMO_USERS_BY_ROLE };
