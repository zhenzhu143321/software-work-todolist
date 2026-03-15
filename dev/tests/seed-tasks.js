const BASE = 'http://localhost:8083';

const TASKS = [
  {
    title: '2026春季学期教学质量检查方案制定',
    description: '根据学校教务处要求，制定本学期教学质量检查实施方案，涵盖课堂教学评估、实验实训检查和毕业论文中期检查三个模块。需协调各系主任确定检查时间表。',
    acceptance_criteria: '1. 方案涵盖课堂教学、实验实训、毕业论文三个模块\n2. 包含详细时间表和责任人分工\n3. 经院务会审议通过',
    deadline: '2026-04-15',
    priority: 'high',
    assignee_name: '教学副院长-姜海红',
    task_type: 'task',
    target_status: 'pending',
  },
  {
    title: '软件工程专业人才培养方案修订研讨会',
    description: '组织软件工程系全体教师和企业导师召开人才培养方案修订研讨会，重点讨论AI课程模块的增设和实践学时比例调整。需提前发出会议通知和修订草案。',
    acceptance_criteria: '1. 参会人员覆盖软工系全体教师和至少3位企业导师\n2. 形成修订意见汇总文档\n3. 确定下一步修改时间节点',
    deadline: '2026-03-25',
    priority: 'high',
    assignee_name: '副院长-单振辉',
    task_type: 'meeting',
    target_status: 'pending',
  },
  {
    title: '产教融合实训基地合作协议审核',
    description: '审核与华为、中软国际两家企业的产教融合实训基地合作协议，确认实习岗位数量、企业导师配置、知识产权条款等关键内容。法务处已初审通过，需院方复核签字。',
    acceptance_criteria: '1. 两份协议均完成逐条审核\n2. 标注需修改条款并反馈企业方\n3. 院长签字确认后报教务处备案',
    deadline: '2026-04-30',
    priority: 'medium',
    assignee_name: '院长助理-武星燕',
    task_type: 'task',
    target_status: 'in_progress',
    progress_percent: 40,
    progress_note: '已完成初稿审核，等待合作方确认',
  },
  {
    title: '本学期科研项目中期检查通知',
    description: '向全院教师发布本学期科研项目中期检查通知，收集各项目组中期进展报告和经费使用情况。重点关注省级以上课题的进度是否达标。',
    acceptance_criteria: '1. 通知覆盖全院所有在研项目负责人\n2. 收齐中期报告并汇总\n3. 提交科研处存档',
    deadline: '2026-03-20',
    priority: 'medium',
    assignee_name: '科研副院长-彭天彬',
    task_type: 'task',
    target_status: 'completed',
    progress_percent: 100,
    progress_note: '已完成全部项目中期检查并提交汇总报告',
  },
  {
    title: '毕业设计选题系统功能需求评审会',
    description: '召集教务办、各系主任和学生代表，评审毕业设计选题系统的功能需求文档。系统需支持教师出题、学生选题、双向确认和进度跟踪四大功能模块。',
    acceptance_criteria: '1. 需求文档经全体参会人员确认\n2. 标注优先级和开发阶段划分\n3. 形成会议纪要并发送全院',
    deadline: '2026-05-10',
    priority: 'low',
    assignee_name: '院长助理-李梦竹',
    task_type: 'meeting',
    target_status: 'in_progress',
    progress_percent: 20,
    progress_note: '需求收集阶段，已完成教师问卷调查',
  },
];

async function apiCall(path, options = {}) {
  const { headers: extraHeaders, ...rest } = options;
  const res = await fetch(BASE + path, {
    ...rest,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
  return res.json();
}

async function waitForServer(retries = 5) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(BASE + '/api/health');
      if (res.ok) return;
    } catch {}
    console.log(`Waiting for server... (${i + 1}/${retries})`);
    await new Promise(r => setTimeout(r, 2000));
  }
  throw new Error('Server not available');
}

async function main() {
  await waitForServer();

  // Login
  const loginData = await apiCall('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'software', password: 'b316_318' }),
  });
  if (!loginData.token) {
    throw new Error('Login failed: ' + JSON.stringify(loginData));
  }
  const token = loginData.token;
  const authHeaders = { Authorization: 'Bearer ' + token };
  console.log('Logged in as software');

  // Create tasks
  const created = [];
  for (const t of TASKS) {
    const data = await apiCall('/api/tasks', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        title: t.title,
        description: t.description,
        acceptance_criteria: t.acceptance_criteria,
        deadline: t.deadline,
        priority: t.priority,
        assignee_name: t.assignee_name,
        task_type: t.task_type,
      }),
    });
    if (!data.success) {
      throw new Error('Create failed: ' + JSON.stringify(data));
    }
    created.push({ id: data.task_id, title: t.title });
    console.log(`Created: #${data.task_id} ${t.title}`);
  }

  // Patch statuses
  // Task 3: in_progress 40%
  await apiCall(`/api/tasks/${created[2].id}/status`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({
      status: 'in_progress',
      progress_percent: TASKS[2].progress_percent,
      progress_note: TASKS[2].progress_note,
    }),
  });
  console.log(`Patched #${created[2].id} → in_progress 40%`);

  // Task 4: in_progress → completed
  await apiCall(`/api/tasks/${created[3].id}/status`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({ status: 'in_progress', progress_percent: 50, progress_note: '收集中期报告中' }),
  });
  await apiCall(`/api/tasks/${created[3].id}/status`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({
      status: 'completed',
      progress_percent: TASKS[3].progress_percent,
      progress_note: TASKS[3].progress_note,
    }),
  });
  console.log(`Patched #${created[3].id} → completed 100%`);

  // Task 5: in_progress 20%
  await apiCall(`/api/tasks/${created[4].id}/status`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({
      status: 'in_progress',
      progress_percent: TASKS[4].progress_percent,
      progress_note: TASKS[4].progress_note,
    }),
  });
  console.log(`Patched #${created[4].id} → in_progress 20%`);

  // Verify
  const allTasks = await apiCall('/api/tasks', { headers: authHeaders });
  console.log(`\nVerification: ${allTasks.tasks.length} tasks in database`);
  for (const t of allTasks.tasks) {
    console.log(`  #${t.id} [${t.status}] ${t.task_type} ${t.title}`);
  }
}

main().catch(e => {
  console.error('SEED FAILED:', e.message);
  process.exit(1);
});
