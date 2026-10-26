const BASE = '/api';

async function request(path, options = {}) {
  const url = `${BASE}${path}`;
  const config = {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  };

  const response = await fetch(url, config);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
    throw new Error(error.error?.message || `Request failed: ${response.status}`);
  }

  const contentType = response.headers.get('content-type');
  if (contentType?.includes('text/csv')) {
    return response.text();
  }
  return response.json();
}

export const api = {
  health: () => request('/health'),

  candidates: {
    list: (params = {}) => {
      const qs = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null))
      ).toString();
      return request(`/candidates${qs ? `?${qs}` : ''}`);
    },
    get: (id) => request(`/candidates/${id}`),
    stats: () => request('/candidates/stats'),
    filters: () => request('/candidates/filters'),
    updateStatus: (id, status) => request(`/candidates/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
    manualAdd: (data) => request('/candidates/manual', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    generateMessages: (id, data = {}) => request(`/candidates/${id}/generate-messages`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    prepareLinkedIn: (id, messageId) => request(`/candidates/${id}/prepare-linkedin`, {
      method: 'POST',
      body: JSON.stringify({ messageId }),
    }),
    exportAll: () => request('/candidates/export/all'),
  },

  messages: {
    forCandidate: (candidateId) => request(`/messages/candidate/${candidateId}`),
    create: (data) => request('/messages', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/messages/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id) => request(`/messages/${id}`, { method: 'DELETE' }),
  },

  activity: {
    list: (params = {}) => {
      const qs = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null))
      ).toString();
      return request(`/activity${qs ? `?${qs}` : ''}`);
    },
    clear: () => request('/activity/clear', { method: 'DELETE' }),
  },

  agent: {
    status: () => request('/agent/status'),
    chromeStatus: () => request('/agent/chrome-status'),
    scanChrome: (options = {}) => request('/agent/scan-chrome', { method: 'POST', body: JSON.stringify(options) }),
    start: () => request('/agent/start', { method: 'POST' }),
    pause: () => request('/agent/pause', { method: 'POST' }),
    stop: (emergency = false) => request('/agent/stop', { method: 'POST', body: JSON.stringify({ emergency }) }),
    ingest: (profileData, source = 'manual') => request('/agent/ingest', { method: 'POST', body: JSON.stringify({ profileData, source }) }),
    getScript: () => request('/agent/script'),
    reset: () => request('/agent/reset', { method: 'POST' }),
  },
};
