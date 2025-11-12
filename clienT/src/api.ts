const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

export const api = {
  register: async (username: string, password: string) => {
    const res = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  login: async (username: string, password: string) => {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  getDiscussions: async () => {
    const res = await fetch(`${API_URL}/api/discussions`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  createDiscussion: async (startNumber: number, token: string) => {
    const res = await fetch(`${API_URL}/api/discussions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ startNumber })
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  createComment: async (discussionId: number, parentId: number | null, operation: string, operand: number, token: string) => {
    const res = await fetch(`${API_URL}/api/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ discussionId, parentId, operation, operand })
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }
};