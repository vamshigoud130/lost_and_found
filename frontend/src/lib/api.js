const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000/api';

function getAuthToken() {
  return localStorage.getItem('token');
}

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    let message = 'Request failed';
    try { const data = await res.json(); message = data.error || message; } catch {}
    throw new Error(message);
  }
  try { return await res.json(); } catch { return null; }
}

export const api = {
  register: (body) => request('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body) => request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  updateProfile: (body) => request('/auth/profile', { method: 'PUT', body: JSON.stringify(body) }),
  createItem: (body) => request('/items', { method: 'POST', body: JSON.stringify(body) }),
  updateItem: (id, body) => request(`/items/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  resolveItem: (id) => request(`/items/${id}/resolve`, { method: 'POST' }),
  myItems: () => request('/items/mine'),
  browse: (params) => {
    const qs = new URLSearchParams(params || {}).toString();
    return request(`/items${qs ? `?${qs}` : ''}`);
  },
  createMatch: (body) => request('/matches', { method: 'POST', body: JSON.stringify(body) }),
  myMatches: () => request('/matches/mine'),
  getNotifications: () => request('/notifications'),
  markNotificationRead: (id) => request(`/notifications/${id}/read`, { method: 'PATCH' }),
  deleteNotification: (id) => request(`/notifications/${id}`, { method: 'DELETE' }),
  deleteNotifications: (notificationIds) => request('/notifications/bulk', { method: 'DELETE', body: JSON.stringify({ notificationIds }) }),
  markAllNotificationsRead: () => request('/notifications/mark-all-read', { method: 'PATCH' }),
  clearAllNotifications: () => request('/notifications/clear-all', { method: 'DELETE' }),
  
  // Admin API
  admin: {
    getStats: () => request('/admin/stats'),
    getAnalytics: (params) => {
      const qs = new URLSearchParams(params || {}).toString();
      return request(`/admin/analytics/trends${qs ? `?${qs}` : ''}`);
    },
    getItems: (params) => {
      const qs = new URLSearchParams(params || {}).toString();
      return request(`/admin/items${qs ? `?${qs}` : ''}`);
    },
    getItem: (id) => request(`/admin/items/${id}`),
    moderateItem: (id, body) => request(`/admin/items/${id}/moderate`, { method: 'PATCH', body: JSON.stringify(body) }),
    updateItemStatus: (id, body) => request(`/admin/items/${id}/status`, { method: 'PATCH', body: JSON.stringify(body) }),
    deleteItem: (id) => request(`/admin/items/${id}`, { method: 'DELETE' }),
    getMatches: (params) => {
      const qs = new URLSearchParams(params || {}).toString();
      return request(`/admin/matches${qs ? `?${qs}` : ''}`);
    },
    getMatch: (id) => request(`/admin/matches/${id}`),
    updateMatchStatus: (id, body) => request(`/admin/matches/${id}/status`, { method: 'PATCH', body: JSON.stringify(body) }),
    createMatch: (body) => request('/admin/matches', { method: 'POST', body: JSON.stringify(body) }),
    getUsers: (params) => {
      const qs = new URLSearchParams(params || {}).toString();
      return request(`/admin/users${qs ? `?${qs}` : ''}`);
    },
    updateUserRole: (id, body) => request(`/admin/users/${id}/role`, { method: 'PATCH', body: JSON.stringify(body) }),
    suspendUser: (id, body) => request(`/admin/users/${id}/suspend`, { method: 'PATCH', body: JSON.stringify(body) }),
    deleteUser: (id) => request(`/admin/users/${id}`, { method: 'DELETE' }),
    getAuditLogs: (params) => {
      const qs = new URLSearchParams(params || {}).toString();
      return request(`/admin/audit-logs${qs ? `?${qs}` : ''}`);
    },
    getSettings: () => request('/admin/settings'),
    saveSettings: (settings) => request('/admin/settings', { method: 'PUT', body: JSON.stringify({ settings }) }),
    getNotifications: (params) => {
      const qs = new URLSearchParams(params || {}).toString();
      return request(`/admin/notifications${qs ? `?${qs}` : ''}`);
    },
    sendNotifications: (body) => request('/admin/notifications', { method: 'POST', body: JSON.stringify(body) }),
    sendMatchEmail: (matchId, body) => request(`/admin/matches/${matchId}/send-email`, { method: 'POST', body: JSON.stringify(body) }),
    deleteNotification: (id) => request(`/admin/notifications/${id}`, { method: 'DELETE' }),
    deleteNotifications: (notificationIds) => request('/admin/notifications/bulk', { method: 'DELETE', body: JSON.stringify({ notificationIds }) }),
    clearUserNotifications: (userId) => request(`/admin/notifications/user/${userId}`, { method: 'DELETE' }),
  }
};


