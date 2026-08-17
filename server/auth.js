const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_TTL = '7d';

function signCustomerToken(phone) {
  return jwt.sign({ phone, role: 'customer' }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

function requireCustomerAuth(req, res, next) {
  const authHeader = String(req.header('authorization') || '');
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, code: 'UNAUTHENTICATED', message: 'Login required.' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.customerPhone = payload.phone;
    return next();
  } catch (error) {
    return res.status(401).json({ success: false, code: 'INVALID_TOKEN', message: 'Session expired, please log in again.' });
  }
}

module.exports = {
  signCustomerToken,
  requireCustomerAuth,
};
