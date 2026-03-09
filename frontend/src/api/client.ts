import { getTelegramInitData } from '../lib/telegram';
import type { Task, TaskCreateRequest, TaskUpdateRequest } from '../types';
import { mockApi } from './mock';

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

const REQUEST_TIMEOUT_MS = 15_000;

async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
  const isFormData = options.body instanceof FormData;

  const headers: Record<string, string> = {
    'initData': getTelegramInitData(),
  };

  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      signal: controller.signal,
      headers: { ...headers, ...(options.headers as Record<string, string>) },
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ApiError(408, 'Request timed out');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new ApiError(response.status, message);
  }
  return response.json();
}

const realApi = {
  getTasks: (): Promise<Task[]> => fetchWithAuth('/tasks'),

  createTask: (data: TaskCreateRequest): Promise<{ status: string; task_id: number }> => {
    const formData = new FormData();
    formData.append('text', data.text);
    formData.append('deadline', data.deadline);

    if (data.files) {
      for (const file of data.files) {
        formData.append('files', file);
      }
    }

    if (data.reminder_at) {
      for (const r of data.reminder_at) {
        formData.append('reminder_at', r);
      }
    }

    return fetchWithAuth('/tasks', { method: 'POST', body: formData });
  },

  updateTask: (taskId: number, data: TaskUpdateRequest): Promise<{ status: string }> => {
    const formData = new FormData();
    formData.append('text', data.text);
    formData.append('deadline', data.deadline);

    if (data.reminder_at) {
      for (const r of data.reminder_at) {
        formData.append('reminder_at', r);
      }
    }

    return fetchWithAuth(`/tasks/${taskId}`, { method: 'PUT', body: formData });
  },

  deleteTask: (taskId: number): Promise<{ status: string }> =>
    fetchWithAuth(`/tasks/${taskId}`, { method: 'DELETE' }),

  toggleComplete: (taskId: number, isCompleted: boolean): Promise<{ status: string }> =>
    fetchWithAuth(`/tasks/${taskId}/complete`, {
      method: 'PATCH',
      body: JSON.stringify({ is_completed: isCompleted }),
    }),
};

// In dev mock mode the real backend is not needed.
// Create a .env.local file with VITE_DEV_MOCK=true to enable.
export const api = import.meta.env.VITE_DEV_MOCK === 'true' ? mockApi : realApi;
