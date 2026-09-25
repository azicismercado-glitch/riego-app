const db = require('./db');

// Quién ve qué: cfi y lector ven todos los diagnósticos del programa. El técnico
// y el responsable provincial ven solo los de SU provincia (la provincia de un
// diagnóstico es la del usuario que lo creó — ver dashboard.js) y, además, los
// que creó el propio usuario. Un técnico/provincial sin provincia asignada solo
// ve lo que creó él mismo.
//
// La provincia se lee de la base en cada pedido (no del token), así un cambio de
// provincia vale de inmediato y no hay que volver a iniciar sesión.
const VEN_TODO = ['cfi', 'lector'];

async function getScope(user) {
  if (VEN_TODO.includes(user.role)) return null;
  const { rows } = await db.query('SELECT provincia FROM users WHERE id = $1', [user.id]);
  return { userId: user.id, provincia: (rows[0] && rows[0].provincia) || null };
}

// Condición SQL para filtrar diagnósticos visibles. Requiere que la consulta
// tenga "diagnosticos d" y "LEFT JOIN users cu ON cu.id = d.created_by".
function visibleClause(scope, firstParam = 1) {
  if (!scope) return { sql: 'TRUE', params: [] };
  return {
    sql: `(d.created_by = $${firstParam} OR ($${firstParam + 1}::text IS NOT NULL AND cu.provincia = $${firstParam + 1}::text))`,
    params: [scope.userId, scope.provincia]
  };
}

async function canSeeDiagnostico(user, id) {
  const scope = await getScope(user);
  if (!scope) return true;
  const v = visibleClause(scope, 2);
  const { rows } = await db.query(
    `SELECT 1 FROM diagnosticos d LEFT JOIN users cu ON cu.id = d.created_by WHERE d.id = $1 AND ${v.sql}`,
    [id, ...v.params]
  );
  return rows.length > 0;
}

// Para router.param('id', ...): si el diagnóstico no existe o no es visible para
// el usuario, responde 404 igual en ambos casos (no revela que existe).
async function requireDiagnosticoVisible(req, res, next, id) {
  try {
    const n = Number(id);
    if (!Number.isInteger(n) || !(await canSeeDiagnostico(req.user, n))) {
      return res.status(404).json({ error: 'No encontrado' });
    }
    next();
  } catch (e) {
    next(e);
  }
}

module.exports = { getScope, visibleClause, canSeeDiagnostico, requireDiagnosticoVisible };
