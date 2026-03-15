import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { createTask, getAllTasks, getTaskById } from '../db.js';

const router = Router();

/**
 * POST /api/tasks
 * Create a new task. Leader role required.
 * Body: { title, description, acceptance_criteria, deadline, priority, assignee_name, conversation }
 * Returns: { success: true, task_id }
 */
router.post('/', authenticate, requireRole('leader'), async (req, res) => {
  try {
    const {
      title,
      description,
      acceptance_criteria,
      deadline,
      priority,
      assignee_name,
      creator_name,
      conversation,
    } = req.body;

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
      deadline: deadline || null,
      priority,
      assignee_name: assignee_name || '',
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

export default router;
