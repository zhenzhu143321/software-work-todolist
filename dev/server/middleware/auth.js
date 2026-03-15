import { getTokenUser } from '../db.js';

/**
 * Token-based authentication middleware.
 * Reads "Authorization: Bearer <token>" header, resolves user from DB.
 * Sets req.user = { id, username, display_name, role } on success.
 * Returns 401 on missing/invalid token.
 */
export function authenticate(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: '未提供认证令牌' });
  }

  const token = header.slice(7);
  if (!token) {
    return res.status(401).json({ success: false, message: '认证令牌为空' });
  }

  const user = getTokenUser(token);
  if (!user) {
    return res.status(401).json({ success: false, message: '认证令牌无效或已过期' });
  }

  req.user = user;
  next();
}

/**
 * Role-based authorization middleware factory.
 * Must be used after authenticate().
 *
 * @param  {...string} roles - Allowed roles (e.g. 'admin', 'leader', 'teacher')
 * @returns Express middleware
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: '未认证' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `权限不足，需要角色: ${roles.join(', ')}`,
      });
    }

    next();
  };
}
