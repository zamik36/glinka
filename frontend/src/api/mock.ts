/**
 * Dev-only mock API — активируется через VITE_DEV_MOCK=true в .env.local
 * Позволяет тестировать UI без запущенного бэкенда.
 */
import type { Task } from '../types';

const delay = (ms = 400) => new Promise(r => setTimeout(r, ms));

// Mutable in-memory store
let tasks: Task[] = [
  {
    id: 1,
    text: 'Написать реферат по истории средних веков',
    deadline: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),    // через 2 ч
    is_completed: false,
    reminder_status: 'pending',
    attachments: [],
    reminders: [
      { id: 1, remind_at: new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString(), status: 'pending' as const },
    ],
  },
  {
    id: 2,
    text: 'Сдать лабораторную по физике',
    deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),   // завтра
    is_completed: false,
    reminder_status: 'pending',
    attachments: [{ id: 1, filename: 'lab.pdf', mime_type: 'application/pdf', size: 204800 }],
    reminders: [
      { id: 2, remind_at: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(), status: 'pending' as const },
      { id: 3, remind_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), status: 'sent' as const },
    ],
  },
  {
    id: 3,
    text: 'Выучить стихотворение наизусть',
    deadline: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),    // просрочено
    is_completed: false,
    reminder_status: 'pending',
    attachments: [],
    reminders: [],
  },
  {
    id: 4,
    text: 'Решить задачи по алгебре (стр. 48, №12–18)',
    deadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),   // послезавтра
    is_completed: true,
    reminder_status: null,
    attachments: [],
    reminders: [
      { id: 4, remind_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), status: 'sent' as const },
    ],
  },
  {
    id: 5,
    text: 'Подготовить презентацию по биологии',
    deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // через 5 дней
    is_completed: false,
    reminder_status: 'pending',
    attachments: [],
    reminders: [
      { id: 5, remind_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), status: 'pending' as const },
      { id: 6, remind_at: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(), status: 'pending' as const },
    ],
  },
];

let nextId = 100;

export const mockApi = {
  getTasks: async (): Promise<Task[]> => {
    await delay();
    return [...tasks];
  },

  createTask: async (data: { text: string; deadline: string; reminder_at?: string[] }): Promise<{ status: string; task_id: number }> => {
    await delay(500);
    const taskId = nextId++;
    const task: Task = {
      id: taskId,
      text: data.text,
      deadline: data.deadline,
      is_completed: false,
      reminder_status: 'pending',
      attachments: [],
      reminders: (data.reminder_at ?? []).map((r, i) => ({ id: taskId * 100 + i, remind_at: r, status: 'pending' as const })),
    };
    tasks = [...tasks, task];
    return { status: 'ok', task_id: task.id };
  },

  updateTask: async (taskId: number, data: { text: string; deadline: string; reminder_at?: string[] }): Promise<{ status: string }> => {
    await delay(500);
    tasks = tasks.map(t => t.id === taskId ? { ...t, text: data.text, deadline: data.deadline } : t);
    return { status: 'ok' };
  },

  deleteTask: async (taskId: number): Promise<{ status: string }> => {
    await delay(300);
    tasks = tasks.filter(t => t.id !== taskId);
    return { status: 'ok' };
  },

  toggleComplete: async (taskId: number, isCompleted: boolean): Promise<{ status: string }> => {
    await delay(200);
    tasks = tasks.map(t => t.id === taskId ? { ...t, is_completed: isCompleted } : t);
    return { status: 'ok' };
  },
};
