import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { chat } from '../services/llm.js';

const router = Router();

/**
 * POST /api/llm/chat
 * AI-assisted task creation chat. Leader role required.
 * Body: { message: string, history: Array<{role, content}> }
 * Returns: { success: true, reply: string }
 */
router.post('/chat', authenticate, requireRole('leader'), async (req, res) => {
  try {
    const { message, history } = req.body;

    // Validate history format if provided
    if (history !== undefined && !Array.isArray(history)) {
      return res.status(400).json({
        success: false,
        error: 'history 必须是数组格式',
      });
    }

    const reply = await chat(message || '', history || []);

    res.json({ success: true, reply });
  } catch (err) {
    const statusCode = err.message?.includes('未配置') ? 503 : 500;
    res.status(statusCode).json({
      success: false,
      error: err.message || 'AI 服务异常',
    });
  }
});

export default router;
