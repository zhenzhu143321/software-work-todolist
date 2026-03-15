import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { createTask, getAllTasks, getTaskById, updateTaskStatus } from '../db.js';

const router = Router();

/**
 * POST /api/tasks
 * Create a new task. Leader role required.
 * Body: { title, description, acceptance_criteria, deadline|due_date, priority, assignee_name|assignee, conversation }
 * Returns: { success: true, task_id }
 */
router.post('/', authenticate, requireRole('leader'), async (req, res) => {
  try {
    const {
      title,
      description,
      acceptance_criteria,
      deadline: _deadline,
      due_date,
      priority,
      assignee_name: _assigneeName,
      assignee,
      creator_name,
      conversation,
    } = req.body;

    // Alias mapping: assignee → assignee_name, due_date → deadline
    const deadline = _deadline || due_date || null;
    const assignee_name = _assigneeName || assignee || '';

    // Validate required fields
    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        error: '任务标题不能为空',
      });
    }

    if (!priority || !['high', 'medium', 'low'].includes(priority)) {
      return res.status(400).json({
        success: false,
        error: '优先级必须是 high、medium 或 low',
      });
    }

    const taskId = createTask({
      title: title.trim(),
      description: description || '',
      acceptance_criteria: acceptance_criteria || '',
      deadline,
      priority,
      assignee_name,
      creator_name: creator_name || null,
      conversation: conversation ? JSON.stringify(conversation) : null,
      creator_id: req.user.id,
    });

    res.status(201).json({ success: true, task_id: taskId.id });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message || '创建任务失败',
    });
  }
});

/**
 * GET /api/tasks
 * List all tasks. Any authenticated role.
 * Returns: { success: true, tasks }
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const tasks = getAllTasks();
    res.json({ success: true, tasks });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message || '获取任务列表失败',
    });
  }
});

/**
 * GET /api/tasks/:id
 * Get a single task by ID. Any authenticated role.
 * Returns: { success: true, task } or 404
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const task = getTaskById(req.params.id);
    if (!task) {
      return res.status(404).json({
        success: false,
        error: '任务不存在',
      });
    }
    res.json({ success: true, task });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message || '获取任务详情失败',
    });
  }
});

/**
 * PATCH /api/tasks/:id/status
 * Update task status and progress. Any authenticated user.
 * Body: { status, progress_note?, progress_percent? }
 */
router.patch('/:id/status', authenticate, async (req, res) => {
  try {
    const { status, progress_note, progress_percent } = req.body;

    if (!status || !['in_progress', 'completed'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'status 必须是 in_progress 或 completed',
      });
    }

    if (progress_percent !== undefined) {
      const pct = Number(progress_percent);
      if (!Number.isInteger(pct) || pct < 0 || pct > 100) {
        return res.status(400).json({
          success: false,
          error: 'progress_percent 必须是 0-100 的整数',
        });
      }
    }

    const task = updateTaskStatus(req.params.id, {
      status,
      progress_note: progress_note ?? undefined,
      progress_percent: progress_percent !== undefined ? Number(progress_percent) : undefined,
    });

    if (!task) {
      return res.status(404).json({ success: false, error: '任务不存在' });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message || '更新任务状态失败',
    });
  }
});

export default router;
