export interface Attachment {
  id: number;
  filename: string;
  mime_type: string;
  size: number;
}

export interface Reminder {
  id: number;
  remind_at: string;
  status: 'pending' | 'sent';
}

export interface Task {
  id: number;
  text: string;
  deadline: string;
  is_completed: boolean;
  reminder_status: 'pending' | 'sent' | null;
  attachments: Attachment[];
  reminders: Reminder[];
}

export interface TaskCreateRequest {
  text: string;
  deadline: string;
  files?: File[];
  reminder_at?: string[];
}

export interface TaskUpdateRequest {
  text: string;
  deadline: string;
  reminder_at?: string[];
}
