export interface Task {
  id: number;
  text: string;
  deadline: string;
  is_completed: boolean;
}

export interface TaskCreateRequest {
  text: string;
  deadline: string; // ISO (UTC)
}