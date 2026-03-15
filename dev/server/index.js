import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import helmet from 'helmet';
import compression from 'compression';
import { rateLimit } from 'express-rate-limit';

dotenv.config();

// Ensure data directory exists
const dataDir = path.resolve('data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const app = express();
const PORT = process.env.PORT || 8083;

// ── Security ────────────────────────────────────────────────────────────────

app.use(helmet({
  contentSecurityPolicy: false,
}));

// ── Compression ─────────────────────────────────────────────────────────────

app.use(compression());

// ── CORS ────────────────────────────────────────────────────────────────────

app.use(cors());

// ── Body parsing ────────────────────────────────────────────────────────────

app.use(express.json());

// ── Rate limiting ───────────────────────────────────────────────────────────

const llmLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'LLM 请求过于频繁，请稍后再试' },
});

// ── Routes ──────────────────────────────────────────────────────────────────

import authRouter from './routes/auth.js';

app.use('/api/auth', authRouter);

// tasks and llm routers — load dynamically so the server starts even if
// the route files don't exist yet.
try {
  const { default: tasksRouter } = await import('./routes/tasks.js');
  app.use('/api/tasks', tasksRouter);
} catch {
  console.warn('[warn] routes/tasks.js not found, /api/tasks disabled');
}

try {
  const { default: llmRouter } = await import('./routes/llm.js');
  app.use('/api/llm', llmLimiter, llmRouter);
} catch {
  console.warn('[warn] routes/llm.js not found, /api/llm disabled');
}

// ── Health check ────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Static files ────────────────────────────────────────────────────────────

const clientDir = path.resolve('client');

// 禁止微信等 WebView 缓存 HTML 页面
app.use((req, res, next) => {
  if (req.path.endsWith('.html') || req.path === '/') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

if (fs.existsSync(clientDir)) {
  app.use(express.static(clientDir));
}

// ── SPA fallback ────────────────────────────────────────────────────────────

app.get(/^\/(?!api\/).*/, (_req, res) => {
  const loginPage = path.join(clientDir, 'login.html');
  if (fs.existsSync(loginPage)) {
    res.sendFile(loginPage);
  } else {
    res.status(404).send('client/login.html not found');
  }
});

// ── Global error handler ────────────────────────────────────────────────────

app.use((err, _req, res, _next) => {
  console.error('[error]', err.stack || err);
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production'
      ? '服务器内部错误'
      : err.message,
  });
});

// ── Unhandled rejection ─────────────────────────────────────────────────────

process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

// ── Start ───────────────────────────────────────────────────────────────────

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});

export default app;
