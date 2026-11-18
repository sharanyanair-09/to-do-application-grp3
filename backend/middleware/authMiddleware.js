import jwt from 'jsonwebtoken';

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
    if (!payload || typeof payload === 'string' || typeof payload.sub !== 'string') {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }

    req.user = { id: payload.sub };
    return next();
  } catch (_error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
}
