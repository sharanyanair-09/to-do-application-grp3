import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export function authenticateToken(req, res, next) {
  const authorization = req.headers.authorization || '';
  const match = authorization.match(/^Bearer\s+(\S+)$/i);

  if (!match) {
    return res.status(401).json({
      success: false,
      message: 'Authentication token is required'
    });
  }

  try {
    const payload = jwt.verify(match[1], process.env.JWT_SECRET);
    if (
      !payload ||
      typeof payload === 'string' ||
      typeof payload.sub !== 'string' ||
      !/^[a-f\d]{24}$/i.test(payload.sub)
    ) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }

    req.user = {
      id: payload.sub,
      role: payload.role === 'admin' ? 'admin' : 'user'
    };
    return next();
  } catch (_error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
}

export async function requireAdmin(req, res, next) {
  const user = await User.findById(req.user.id).select('role');
  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }

  if (req.user.role !== 'admin' || user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin access is required'
    });
  }

  req.user.role = user.role;
  return next();
}
