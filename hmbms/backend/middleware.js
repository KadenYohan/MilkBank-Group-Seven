// ============================================================
// HMBMS — Authentication & RBAC Middleware
// ============================================================

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
  return (req, res, next) => {
    if (!req.session.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (!roles.includes(req.session.user.role)) {
      // Log unauthorized access attempt
      const db = global.db;
      db.prepare(`
        INSERT INTO audit_trail (user_id, username, action, details, ip_address)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        req.session.user.user_id,
        req.session.user.username,
        'UNAUTHORIZED_ACCESS_ATTEMPT',
        `Attempted to access resource requiring roles: ${roles.join(', ')}`,
        req.ip
      );

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
function logAudit(userId, username, action, details, ipAddress) {
  const db = global.db;
  db.prepare(`
    INSERT INTO audit_trail (user_id, username, action, details, ip_address)
    VALUES (?, ?, ?, ?, ?)
  `).run(userId, username, action, details || '', ipAddress || '');
}

module.exports = { requireAuth, requireRole, logAudit };
