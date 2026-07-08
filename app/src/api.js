// API client. Talks to the Azure Functions API when it's reachable;
// otherwise falls back to the in-browser mock (localStorage-backed) so the
// app is fully reviewable with `npm run dev` and no backend.
let mockMode = false
let mock = null

async function request(path, { method = 'GET', body } = {}) {
  if (!mockMode) {
    try {
      const res = await fetch('/api' + path, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      })
      if (!res.ok) throw new Error(`API ${res.status} for ${path}`)
      return await res.json()
    } catch (err) {
      mockMode = true
      console.warn('API unavailable — running against in-browser mock data.', err.message)
    }
  }
  mock ??= await import('./mock/mockApi.js')
  return mock.handle(path, { method, body })
}

export const api = {
  bootstrap: () => request('/bootstrap'),
  saveScore: (workItemId, values) => request(`/scores/${workItemId}`, { method: 'PUT', body: values }),
  saveRanks: (order) => request('/ranks', { method: 'PUT', body: { order } }),
  submit: () => request('/submit', { method: 'POST' }),
  comments: (workItemId) => request(`/comments/${workItemId}`),
  postComment: (workItemId, text) => request(`/comments/${workItemId}`, { method: 'POST', body: { text } }),
  dashboard: () => request('/dashboard'),
  roundAction: (action) => request('/round', { method: 'POST', body: { action } }),
  setLock: (workItemId, unlocked) => request(`/locks/${workItemId}`, { method: 'PUT', body: { unlocked } }),
  askAssistant: (question) => request('/assistant', { method: 'POST', body: { question } }),
  saveFacts: (workItemId, values) => request(`/facts/${workItemId}`, { method: 'PUT', body: values }),
  rationales: (workItemId) => request(`/rationales/${workItemId}`),
  isMock: () => mockMode,
}
