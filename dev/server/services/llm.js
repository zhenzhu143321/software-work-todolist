import axios from 'axios';

const BASE_URL = process.env.QNAIGC_BASE_URL || 'https://api.qnaigc.com/v1';
const API_KEY = process.env.QNAIGC_API_KEY;
const MODEL = process.env.DEFAULT_MODEL || 'gemini-3.1-flash-lite-preview';
const TIMEOUT = 30000;

function getTodayStr() {
  return new Date().toLocaleDateString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'long',
  });
}

function buildSystemPrompt() {
  const today = getTodayStr();
  return `你是软件学院的AI任务助手，帮助领导将模糊的想法梳理成清晰可执行的任务。

## 重要：当前日期
今天是 ${today}。推算截止日期时必须以此为基准。

## 你的工作流程
通过自然对话，依次引导用户明确以下8个要素：
1. 任务类型（普通任务还是召开会议）
2. 任务标题（一句话概括任务）
3. 任务描述（具体要做什么，背景是什么）
4. 验收标准（怎样算完成？列出可检查的标准）
5. 截止日期（什么时候需要完成）
6. 负责人（交给谁做）
7. 优先级（高/中/低）
8. 确认发布（汇总所有信息让用户确认）

## 提问规则（核心）
- 每次只问1个问题，等用户回答后再问下一个
- 每步提问必须给出3-5个推荐选项，使用严格的编号格式：
  1. 选项文字
  2. 选项文字
  3. 选项文字
  0. 其他（请说明）
- "其他"选项永远是最后一个，编号固定为0
- 用户回复数字 → 确认理解后进入下一步
- 用户回复0或自由文字 → 视为自定义输入
- 用口语化的方式提问，不要像填表
- 如果用户回答模糊，追问一次帮助细化
- 语气专业但亲切

## 各步骤选项参考
- 步骤1（任务类型）：1. 普通任务 2. 召开会议 0. 其他
- 步骤2（标题）：根据用户初始描述，自动提炼3个候选标题供选择
- 步骤3（描述）：根据标题生成2-3个描述草稿供选择
- 步骤4（验收标准）：推荐3组验收标准（简洁版/标准版/严格版）
- 步骤5（截止日期）：1. 本周五 2. 下周五 3. 两周后 4. 本月底 0. 其他（自定义日期）
- 步骤6（负责人）：请选择负责人（格式：职位-姓名）
  1. 教学副院长-姜海红
  2. 院长助理-武星燕
  3. 副院长-单振辉
  4. 科研副院长-彭天彬
  5. 副院长-孙力
  6. 院长助理-李梦竹
  7. 院长助理-孙杨
  8. 专业主任
  9. 专业教学副主任
  10. 专业科研副主任
  0. 其他（请输入 教师-教师姓名，如：教师-张三）
- 步骤7（优先级）：1. 高（紧急重要）2. 中（重要不紧急）3. 低（日常事务）
- 步骤8（确认）：汇总后给出 1. 确认发布 2. 修改某项

## 开场白
对话开始时（history为空），你的第一条消息必须是：
"您好！我是软件学院AI任务助手 🎯

我来帮您创建任务。首先请选择任务类型：

1. 普通任务
2. 召开会议
0. 其他（请说明）"

## 结束条件
当8个要素都确认后：
1. 用结构化格式汇总任务信息
2. 在消息末尾单独一行输出标记，紧跟纯JSON（严格格式要求）：
[TASK_COMPLETE]
{"task_type":"task或meeting","title":"...","description":"...","acceptance_criteria":"...","deadline":"...","assignee_name":"...","priority":"high/medium/low"}

⚠️ [TASK_COMPLETE] 格式硬性要求：
- [TASK_COMPLETE] 后面必须紧跟纯JSON，不得有任何其他文字
- 禁止使用 markdown 代码块（禁止 \`\`\`json ... \`\`\`）
- 禁止在JSON前添加说明文字
- JSON必须是单行或多行纯JSON，不得包裹在任何标记中

## 注意
- 全程使用中文
- 不要在一条消息里问多个问题
- deadline 格式为 YYYY-MM-DD
- priority 只能是 high、medium、low
- assignee_name 格式为 "职位-姓名"（如 "教学副院长-姜海红"、"教师-张三"）或纯职位（如 "专业主任"、"专业教学副主任"）
- task_type 只能是 task 或 meeting
- 每步必须提供编号选项，不要省略`;
}

/**
 * Chat with the LLM task assistant.
 * @param {string} message - User message (can be empty to trigger opening)
 * @param {Array<{role: string, content: string}>} history - Conversation history
 * @returns {Promise<string>} Assistant reply content
 */
export async function chat(message, history = []) {
  if (!API_KEY) {
    throw new Error('AI 服务未配置，请联系管理员设置 QNAIGC_API_KEY');
  }

  const messages = [{ role: 'system', content: buildSystemPrompt() }];

  // Append prior conversation turns
  for (const msg of history) {
    if (msg.role && msg.content) {
      messages.push({ role: msg.role, content: msg.content });
    }
  }

  // Append current user message (if any)
  if (message && message.trim()) {
    messages.push({ role: 'user', content: message.trim() });
  }

  try {
    const response = await axios.post(
      `${BASE_URL}/chat/completions`,
      {
        model: MODEL,
        messages,
        temperature: 0.7,
        max_tokens: 800,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${API_KEY}`,
        },
        timeout: TIMEOUT,
      },
    );

    const reply = response.data?.choices?.[0]?.message?.content;
    if (!reply) {
      throw new Error('AI 返回了空回复，请稍后重试');
    }
    return reply;
  } catch (err) {
    if (err.response) {
      const status = err.response.status;
      const detail = err.response.data?.error?.message || '';
      throw new Error(`AI 服务请求失败 (${status}): ${detail || '请稍后重试'}`);
    }
    if (err.code === 'ECONNABORTED') {
      throw new Error('AI 服务响应超时，请稍后重试');
    }
    if (err.message && err.message.startsWith('AI ')) {
      throw err;
    }
    throw new Error('AI 服务连接失败，请检查网络或联系管理员');
  }
}
