import React, { useMemo, memo } from 'react';
import { format, formatDistanceToNow, isPast } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  FiX, FiEdit2, FiCalendar, FiCheckCircle, FiAlertTriangle,
  FiClock, FiBell, FiPaperclip,
} from 'react-icons/fi';
import { motion } from 'framer-motion';
import type { Task } from '../types';

type Props = {
  task: Task;
  onClose: () => void;
  onEdit: (task: Task) => void;
};

export const TaskDetail: React.FC<Props> = memo(({ task, onClose, onEdit }) => {
  const deadlineDate = useMemo(() => new Date(task.deadline), [task.deadline]);
  const isOverdue = !task.is_completed && isPast(deadlineDate) && task.reminder_status !== 'sent';

  const statusInfo = useMemo(() => {
    if (task.is_completed)
      return { color: '#059669', bg: 'rgba(16,185,129,0.1)', icon: FiCheckCircle, label: 'Выполнено' };
    if (task.reminder_status === 'sent')
      return { color: '#D97706', bg: 'rgba(217,119,6,0.1)', icon: FiBell, label: 'Напомнено' };
    if (isOverdue)
      return { color: '#DC2626', bg: 'rgba(239,68,68,0.1)', icon: FiAlertTriangle, label: 'Просрочено' };
    return { color: '#7C3AED', bg: 'rgba(124,58,237,0.1)', icon: FiClock, label: 'В работе' };
  }, [task.is_completed, task.reminder_status, isOverdue]);

  const deadlineText = useMemo(() => {
    try { return format(deadlineDate, 'd MMMM yyyy, HH:mm', { locale: ru }); }
    catch { return deadlineDate.toLocaleString(); }
  }, [deadlineDate]);

  const relativeText = useMemo(() => {
    if (isOverdue) return 'Просрочено';
    try { return formatDistanceToNow(deadlineDate, { addSuffix: true, locale: ru }); }
    catch { return ''; }
  }, [deadlineDate, isOverdue]);

  const sortedReminders = useMemo(() => {
    if (!task.reminders?.length) return [];
    return [...task.reminders].sort(
      (a, b) => new Date(a.remind_at).getTime() - new Date(b.remind_at).getTime()
    );
  }, [task.reminders]);

  return (
    <div className="px-5 pb-8 pt-2">
      {/* Title bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <span className="text-xl">📋</span>
          <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            Подробности
          </h2>
        </div>
        <motion.button
          whileTap={{ scale: 0.88 }}
          onClick={onClose}
          className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{ background: '#F3F0FF' }}
        >
          <FiX className="text-sm" style={{ color: '#6C5CE7' }} />
        </motion.button>
      </div>

      <div className="flex flex-col gap-5">
        {/* Status badge */}
        <div>
          <span
            className="inline-flex items-center gap-1.5 font-semibold"
            style={{
              background: statusInfo.bg,
              color: statusInfo.color,
              fontSize: 12,
              padding: '5px 12px',
              borderRadius: 20,
              border: `1px solid ${statusInfo.color}33`,
            }}
          >
            <statusInfo.icon size={12} />
            {statusInfo.label}
          </span>
        </div>

        {/* Text */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>
            Описание
          </label>
          <div
            className="rounded-2xl"
            style={{
              background: '#FAFAFE',
              border: '1px solid var(--border-light)',
              padding: '12px 14px',
            }}
          >
            <p style={{
              fontSize: 14, lineHeight: 1.5, color: 'var(--text-primary)',
              wordBreak: 'break-word',
              textDecoration: task.is_completed ? 'line-through' : 'none',
              opacity: task.is_completed ? 0.6 : 1,
            }}>
              {task.text}
            </p>
          </div>
        </div>

        {/* Deadline */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>
            Дедлайн
          </label>
          <div
            className="rounded-2xl flex items-center gap-3"
            style={{
              background: '#FAFAFE',
              border: '1px solid var(--border-light)',
              padding: '12px 14px',
            }}
          >
            <div style={{
              width: 28, height: 28, borderRadius: 9,
              background: isOverdue ? 'rgba(239,68,68,0.1)' : 'rgba(108,92,231,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <FiCalendar size={13} style={{ color: isOverdue ? '#EF4444' : '#6C5CE7' }} />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{deadlineText}</p>
              {relativeText && (
                <p style={{
                  fontSize: 12, fontWeight: 500,
                  color: isOverdue ? '#EF4444' : task.is_completed ? '#10B981' : '#9CA3AF',
                }}>
                  {relativeText}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Reminders */}
        {sortedReminders.length > 0 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <div style={{
                width: 24, height: 24, borderRadius: 8, background: 'rgba(108,92,231,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <FiBell size={12} style={{ color: '#6C5CE7' }} />
              </div>
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Напоминания
              </span>
            </div>

            <div style={{
              background: 'linear-gradient(145deg, #FAFAFE 0%, #F7F4FF 100%)',
              borderRadius: 16,
              border: '1px solid rgba(108,92,231,0.12)',
              padding: '10px 14px',
              display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              {sortedReminders.map(r => {
                const isSent = r.status === 'sent';
                let timeText: string;
                try { timeText = format(new Date(r.remind_at), 'd MMM yyyy, HH:mm', { locale: ru }); }
                catch { timeText = r.remind_at; }
                return (
                  <div
                    key={r.id}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 10px',
                      borderRadius: 11,
                      background: isSent ? 'rgba(16,185,129,0.06)' : 'rgba(108,92,231,0.07)',
                      border: `1px solid ${isSent ? 'rgba(16,185,129,0.14)' : 'rgba(108,92,231,0.14)'}`,
                    }}
                  >
                    <span style={{
                      display: 'flex', alignItems: 'center', gap: 7,
                      fontSize: 12, fontWeight: 600,
                      color: isSent ? '#059669' : '#5B4CC8',
                    }}>
                      <span style={{
                        width: 22, height: 22, borderRadius: 7,
                        background: isSent ? 'rgba(16,185,129,0.12)' : 'rgba(108,92,231,0.12)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        {isSent
                          ? <FiCheckCircle size={10} style={{ color: '#10B981' }} />
                          : <FiBell size={10} style={{ color: '#6C5CE7' }} />
                        }
                      </span>
                      {timeText}
                    </span>
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 6,
                      background: isSent ? 'rgba(16,185,129,0.1)' : 'rgba(108,92,231,0.08)',
                      color: isSent ? '#059669' : '#A29BFE',
                    }}>
                      {isSent ? 'Отправлено' : 'Ожидает'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Attachments */}
        {task.attachments?.length > 0 && (
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>
              Файлы
            </label>
            <div style={{
              background: '#FAFAFE',
              border: '1px solid var(--border-light)',
              borderRadius: 16,
              padding: '10px 14px',
              display: 'flex', flexDirection: 'column', gap: 6,
            }}>
              {task.attachments.map(a => (
                <div key={a.id} className="flex items-center gap-3 py-1">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#F3F0FF' }}>
                    <FiPaperclip size={12} style={{ color: '#6C5CE7' }} />
                  </div>
                  <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                    {a.filename}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Edit button */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => onEdit(task)}
          className="btn-gradient mt-1 flex items-center justify-center gap-2"
        >
          <FiEdit2 className="text-lg" />
          Редактировать
        </motion.button>
      </div>
    </div>
  );
});
