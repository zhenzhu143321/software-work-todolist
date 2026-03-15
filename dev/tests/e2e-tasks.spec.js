import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:8083';

// Helper: login via API and set localStorage
async function apiLogin(page) {
  const res = await page.request.post(`${BASE}/api/auth/login`, {
    data: { username: 'software', password: 'b316_318' },
  });
  const data = await res.json();
  await page.goto('/login.html');
  await page.evaluate(({ token, user }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  }, { token: data.token, user: data.user });
}

// ──────────────── Login Flow ────────────────

test.describe('Login Flow', () => {
  test('UI login redirects to chat.html for leader', async ({ page }) => {
    await page.goto('/login.html');
    await page.fill('#username', 'software');
    await page.fill('#password', 'b316_318');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/chat.html', { timeout: 10000 });
    expect(page.url()).toContain('/chat.html');
  });
});

// ──────────────── Task List ────────────────

test.describe('Task List', () => {
  test.beforeEach(async ({ page }) => {
    await apiLogin(page);
    await page.goto('/tasks.html');
    await page.waitForSelector('.task-card', { timeout: 10000 });
  });

  test('displays 5 task cards', async ({ page }) => {
    const cards = page.locator('.task-card');
    await expect(cards).toHaveCount(5);
  });

  test('task titles are correct', async ({ page }) => {
    const titles = [
      '2026春季学期教学质量检查方案制定',
      '软件工程专业人才培养方案修订研讨会',
      '产教融合实训基地合作协议审核',
      '本学期科研项目中期检查通知',
      '毕业设计选题系统功能需求评审会',
    ];
    for (const title of titles) {
      await expect(page.locator('.task-card-title', { hasText: title })).toBeVisible();
    }
  });

  test('filter pending shows 2 tasks', async ({ page }) => {
    await page.click('.filter-btn:has-text("待处理")');
    await expect(page.locator('.task-card')).toHaveCount(2);
  });

  test('filter in_progress shows 2 tasks', async ({ page }) => {
    await page.click('.filter-btn:has-text("进行中")');
    await expect(page.locator('.task-card')).toHaveCount(2);
  });

  test('filter completed shows 1 task', async ({ page }) => {
    await page.click('.filter-btn:has-text("已完成")');
    await expect(page.locator('.task-card')).toHaveCount(1);
  });

  test('filter meeting shows 2 tasks', async ({ page }) => {
    await page.click('.filter-btn:has-text("会议")');
    await expect(page.locator('.task-card')).toHaveCount(2);
  });

  test('task cards show correct priority and status badges', async ({ page }) => {
    // Check a high-priority pending task
    const card1 = page.locator('.task-card', { hasText: '教学质量检查' });
    await expect(card1.locator('.badge-high')).toBeVisible();
    await expect(card1.locator('.status-pending')).toBeVisible();

    // Check a completed task
    const card4 = page.locator('.task-card', { hasText: '科研项目中期检查' });
    await expect(card4.locator('.status-completed')).toBeVisible();
  });

  test('clicking task card navigates to detail page', async ({ page }) => {
    const firstCard = page.locator('.task-card').first();
    await firstCard.click();
    await page.waitForURL('**/task-detail.html?id=*', { timeout: 10000 });
    expect(page.url()).toContain('/task-detail.html?id=');
  });
});
