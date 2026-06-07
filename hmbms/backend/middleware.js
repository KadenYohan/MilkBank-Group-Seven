// ============================================================
// HMBMS — Authentication & RBAC Middleware (PostgreSQL)
// ============================================================

const db = require('./db');

/**
 * Check if user is authenticated
 */
function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }
  next();
}

/**
 * Check if user has one of the allowed roles
 * @param  {...string} roles - Allowed roles
 */
function requireRole(...roles) {
  return async (req, res, next) => {
    if (!req.session.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (!roles.includes(req.session.user.role)) {
      // Log unauthorized access attempt
      try {
        await db.query(`
          INSERT INTO audit_trail (user_id, username, action, details, ip_address)
          VALUES ($1, $2, $3, $4, $5)
        `, [
          req.session.user.user_id,
          req.session.user.username,
          'UNAUTHORIZED_ACCESS_ATTEMPT',
          `Attempted to access resource requiring roles: ${roles.join(', ')}`,
          req.ip
        ]);
      } catch (err) {
        console.error('Failed to log audit trail for unauthorized access:', err);
      }

      return res.status(403).json({
        error: 'Access denied. You do not have permission to perform this action.',
        required_roles: roles,
        your_role: req.session.user.role
      });
    }
    next();
  };
}

/**
 * Log action to audit trail (immutable)
 */
async function logAudit(userId, username, action, details, ipAddress) {
  try {
    await db.query(`
      INSERT INTO audit_trail (user_id, username, action, details, ip_address)
      VALUES ($1, $2, $3, $4, $5)
    `, [userId, username, action, details || '', ipAddress || '']);
  } catch (err) {
    console.error('Failed to log audit trail:', err);
  }
}

module.exports = { requireAuth, requireRole, logAudit };
