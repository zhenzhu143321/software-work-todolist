const API_BASE = '/api';

function formatDate(dateStr) {
  if (!dateStr) return '';
  // SQLite CURRENT_TIMESTAMP 存储 UTC 时间，无时区后缀
  // 补上 'Z' 确保浏览器按 UTC 解析，再由 toLocaleString 转为本地时间
  let str = dateStr;
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(str)) {
    str = str.replace(' ', 'T') + 'Z';
  }
  return new Date(str).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
}

function getToken() {
  return localStorage.getItem('token');
}

function getUser() {
  const u = localStorage.getItem('user');
  return u ? JSON.parse(u) : null;
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/login.html';
}

async function apiFetch(url, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    logout();
    throw new Error('登录已过期');
  }
  return res.json();
}

function requireAuth() {
  if (!getToken()) {
    window.location.href = '/login.html';
    return false;
  }
  return true;
}

// 微信 WebView / 手机浏览器 bfcache 恢复检测
// 服务端已对 HTML 设置 no-store，此处作为双保险
window.addEventListener('pageshow', function(e) {
  if (e.persisted) {
    window.location.reload();
  }
});
