import { getTelegramInitData } from '../lib/telegram';
import type { Task, TaskCreateRequest } from '../types';

// Благодаря Caddy мы шлем запросы на тот же домен, где открыт фронт!
const API_BASE = '/api';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function readErrorMessage(response: Response): Promise<string> {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const payload = (await response.json()) as { detail?: string; message?: string };
    if (payload.detail) return payload.detail;
    if (payload.message) return payload.message;
  }
  return `HTTP ${response.status} ${response.statusText}`.trim();
}

async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'initData': getTelegramInitData(),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  
  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new ApiError(response.status, message);
  }
  return response.json();
}

export const api = {
  getTasks: (): Promise<Task[]> => fetchWithAuth('/tasks'),
  createTask: (data: TaskCreateRequest): Promise<{status: string, task_id: number}> => 
    fetchWithAuth('/tasks', { method: 'POST', body: JSON.stringify(data) }),
};