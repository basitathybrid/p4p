const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_TTL = '7d';

function signToken(payload, role) {
  return jwt.sign({ ...payload, role }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

function signCustomerToken(phone) {
  return signToken({ phone }, 'customer');
}

function signSupervisorToken(user) {
  return signToken({
    id: user.id,
    name: user.name,
    email: user.email,
    username: user.username,
  }, 'supervisor');
}

function requireAuth(requiredRole) {
  return (req, res, next) => {
    const authHeader = String(req.header('authorization') || '');
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ success: false, code: 'UNAUTHENTICATED', message: 'Login required.' });
    }

    try {
      const payload = jwt.verify(token, JWT_SECRET);

      if (requiredRole && payload.role !== requiredRole) {
        return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'Access denied for this account role.' });
      }

      req.user = payload;
      req.customerPhone = payload.phone;
      req.supervisorUser = payload.role === 'supervisor' ? payload : null;
      return next();
    } catch (error) {
      return res.status(401).json({ success: false, code: 'INVALID_TOKEN', message: 'Session expired, please log in again.' });
    }
  };
}

function requireCustomerAuth(req, res, next) {
  return requireAuth('customer')(req, res, next);
}

function requireSupervisorAuth(req, res, next) {
  return requireAuth('supervisor')(req, res, next);
}

module.exports = {
  signCustomerToken,
  signSupervisorToken,
  requireCustomerAuth,
  requireSupervisorAuth,
  requireAuth,
};
