import axios from 'axios';

const BASE_URL = 'http://localhost:3000/api';

let userToken: string | null = null;

export function setToken(token: string | null) {
  userToken = token;
}

export function getToken(): string | null {
  return userToken;
}

async function getHeaders() {
  const headers: any = {
    'Content-Type': 'application/json',
  };
  if (userToken) {
    headers['Authorization'] = `Bearer ${userToken}`;
  }
  return headers;
}

export const api = {
  // Auth
  async register(email: string, password: string) {
    const res = await axios.post(`${BASE_URL}/dev/auth/register`, { email, password });
    if (res.data.token) {
      setToken(res.data.token);
    }
    return res.data;
  },

  async login(email: string, password: string) {
    const res = await axios.post(`${BASE_URL}/dev/auth/login`, { email, password });
    if (res.data.token) {
      setToken(res.data.token);
    }
    return res.data;
  },

  // Repositories
  async getRepositories() {
    const headers = await getHeaders();
    const res = await axios.get(`${BASE_URL}/dev/repositories`, { headers });
    return res.data;
  },

  async getBranches(owner: string, repo: string) {
    const headers = await getHeaders();
    const res = await axios.get(`${BASE_URL}/dev/repositories?owner=${owner}&repo=${repo}`, { headers });
    return res.data;
  },

  // Workspaces
  async createWorkspace(repoFullName: string, branch: string) {
    const headers = await getHeaders();
    const res = await axios.post(`${BASE_URL}/dev/workspaces`, { repoFullName, branch }, { headers });
    return res.data;
  },

  async getWorkspaces() {
    const headers = await getHeaders();
    const res = await axios.get(`${BASE_URL}/dev/workspaces`, { headers });
    return res.data;
  },

  async stopWorkspace(workspaceId: string) {
    const headers = await getHeaders();
    const res = await axios.post(`${BASE_URL}/dev/workspaces/${workspaceId}/stop`, {}, { headers });
    return res.data;
  },

  // Provider
  async verifyProvider(providerId: string, apiKey: string) {
    const headers = await getHeaders();
    const res = await axios.post(`${BASE_URL}/dev/providers/${providerId}/verify`, { apiKey }, { headers });
    return res.data;
  },

  // Chat & Agent Jobs
  async getChatHistory(workspaceId: string) {
    const headers = await getHeaders();
    const res = await axios.get(`${BASE_URL}/dev/chat?workspaceId=${workspaceId}`, { headers });
    return res.data;
  },

  async sendChatMessage(workspaceId: string, message: string) {
    const headers = await getHeaders();
    const res = await axios.post(`${BASE_URL}/dev/chat`, { workspaceId, message }, { headers });
    return res.data;
  },

  async getJobStatus(jobId: string) {
    const headers = await getHeaders();
    const res = await axios.get(`${BASE_URL}/dev/agent-jobs/${jobId}`, { headers });
    return res.data;
  },

  async cancelJob(jobId: string) {
    const headers = await getHeaders();
    const res = await axios.post(`${BASE_URL}/dev/agent-jobs/${jobId}/cancel`, {}, { headers });
    return res.data;
  },

  async approveJob(jobId: string, commitMessage: string) {
    const headers = await getHeaders();
    const res = await axios.post(`${BASE_URL}/dev/agent-jobs/${jobId}/approve`, { commitMessage }, { headers });
    return res.data;
  },

  async rejectJob(jobId: string, feedback: string) {
    const headers = await getHeaders();
    const res = await axios.post(`${BASE_URL}/dev/agent-jobs/${jobId}/reject`, { feedback }, { headers });
    return res.data;
  },

  // History
  async getHistory() {
    const headers = await getHeaders();
    const res = await axios.get(`${BASE_URL}/dev/history`, { headers });
    return res.data;
  }
};
export default api;
