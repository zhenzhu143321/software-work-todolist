import { Router } from 'express';
import crypto from 'crypto';
import { getUserByUsername, createToken, hashPassword } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

/**
 * POST /login
 * Body: { username, password }
 * Returns: { success, token, user }
 */
router.post('/login', (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ success: false, message: '用户名和密码不能为空' });
  }

  const user = getUserByUsername(username);
  if (!user) {
    return res.status(401).json({ success: false, message: '用户名或密码错误' });
  }

  const hash = hashPassword(password);
  if (hash !== user.password_hash) {
    return res.status(401).json({ success: false, message: '用户名或密码错误' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  createToken(token, user.id);

  res.json({
    success: true,
    token,
    user: {
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      role: user.role,
    },
  });
});

/**
 * GET /me
 * Requires: Bearer token
 * Returns: current user info
 */
router.get('/me', authenticate, (req, res) => {
  res.json({
    success: true,
    user: req.user,
  });
});

export default router;
