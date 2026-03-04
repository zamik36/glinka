export interface Attachment {
  id: number;
  filename: string;
  mime_type: string;
  size: number;
}

export interface Task {
  id: number;
  text: string;
  deadline: string;
  is_completed: boolean;
  attachments: Attachment[];
}

export interface TaskCreateRequest {
  text: string;
  deadline: string;
  files?: File[];
}

export interface TaskUpdateRequest {
  text: string;
  deadline: string;
}
