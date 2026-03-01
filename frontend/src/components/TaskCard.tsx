import React from 'react';
import type { Task } from '../types';

type TaskCardProps = {
  task: Task;
};

export const TaskCard: React.FC<TaskCardProps> = ({ task }) => {
  const deadlineDate = new Date(task.deadline);
  const deadlineText = Number.isNaN(deadlineDate.getTime())
    ? task.deadline
    : deadlineDate.toLocaleString();

  return (
    <article className="mb-3 rounded-2xl border border-tg-hint/20 bg-tg-secondaryBg p-4">
      <p className="mb-2 whitespace-pre-wrap break-words text-base">{task.text}</p>
      <div className="flex items-center justify-between text-sm">
        <span className="text-tg-hint">Дедлайн: {deadlineText}</span>
        <span
          className={task.is_completed ? 'text-green-500' : 'text-yellow-500'}
          aria-label={task.is_completed ? 'completed' : 'pending'}
        >
          {task.is_completed ? 'Выполнено' : 'В работе'}
        </span>
      </div>
    </article>
  );
};
