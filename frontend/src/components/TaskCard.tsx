import React from 'react';
import { motion } from 'framer-motion';
import { formatDistanceToNow, isPast, format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { FiPaperclip, FiClock, FiCheckCircle, FiAlertTriangle } from 'react-icons/fi';
import type { Task } from '../types';

type TaskCardProps = {
  task: Task;
  index: number;
};

export const TaskCard: React.FC<TaskCardProps> = ({ task, index }) => {
  const deadlineDate = new Date(task.deadline);
  const isOverdue = !task.is_completed && isPast(deadlineDate);

  let relativeText: string;
  try {
    relativeText = isOverdue
      ? 'Просрочено'
      : formatDistanceToNow(deadlineDate, { addSuffix: true, locale: ru });
  } catch {
    relativeText = '';
  }

  let dateText: string;
  try {
    dateText = format(deadlineDate, 'd MMM, HH:mm', { locale: ru });
  } catch {
    dateText = deadlineDate.toLocaleString();
  }

  const statusConfig = task.is_completed
    ? { color: '#10B981', bg: '#ECFDF5', icon: FiCheckCircle, label: 'Готово' }
    : isOverdue
      ? { color: '#EF4444', bg: '#FEF2F2', icon: FiAlertTriangle, label: 'Просрочено' }
      : { color: '#F59E0B', bg: '#FFFBEB', icon: FiClock, label: 'В работе' };

  const StatusIcon = statusConfig.icon;
  const attachmentCount = task.attachments?.length ?? 0;

  const accentBar = task.is_completed
    ? 'linear-gradient(180deg, #10B981, #34D399)'
    : isOverdue
      ? 'linear-gradient(180deg, #EF4444, #F87171)'
      : 'linear-gradient(180deg, #6C5CE7, #A29BFE)';

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      whileTap={{ scale: 0.98 }}
      className="card mb-3 p-0 overflow-hidden flex"
    >
      {/* Left accent bar */}
      <div className="w-1.5 flex-shrink-0 rounded-l-[20px]" style={{ background: accentBar }} />

      <div className="flex-1 p-4 pl-3.5">
        {/* Task text */}
        <p className="text-[15px] leading-relaxed font-medium mb-3 whitespace-pre-wrap break-words" style={{ color: 'var(--text-primary)' }}>
          {task.text}
        </p>

        {/* Bottom row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Date badge */}
            <span
              className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full"
              style={{ background: '#F3F0FF', color: '#6C5CE7' }}
            >
              <FiClock className="text-[11px]" />
              {dateText}
            </span>

            {/* Relative time */}
            {relativeText && (
              <span className="text-xs" style={{ color: isOverdue ? '#EF4444' : 'var(--text-muted)' }}>
                {relativeText}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {/* Attachments */}
            {attachmentCount > 0 && (
              <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                <FiPaperclip className="text-xs" />
                {attachmentCount}
              </span>
            )}

            {/* Status badge */}
            <span
              className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: statusConfig.bg, color: statusConfig.color }}
            >
              <StatusIcon className="text-[11px]" />
              {statusConfig.label}
            </span>
          </div>
        </div>
      </div>
    </motion.article>
  );
};
