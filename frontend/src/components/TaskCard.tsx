import React from 'react';
import { motion } from 'framer-motion';
import { formatDistanceToNow, isPast, format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { FiPaperclip, FiClock, FiCheckCircle, FiAlertTriangle, FiEdit2, FiTrash2, FiCalendar, FiCheck } from 'react-icons/fi';
import type { Task } from '../types';

type TaskCardProps = {
  task: Task;
  index: number;
  onEdit?: (task: Task) => void;
  onDelete?: (taskId: number) => void;
  onToggleComplete?: (taskId: number, value: boolean) => void;
};

const PulsingDot: React.FC<{ color: string }> = ({ color }) => (
  <span style={{ position: 'relative', display: 'inline-flex', width: 8, height: 8, flexShrink: 0 }}>
    <span
      className="pulse-ring"
      style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: color }}
    />
    <span
      style={{ position: 'relative', width: 8, height: 8, borderRadius: '50%', background: color, display: 'block' }}
    />
  </span>
);

export const TaskCard: React.FC<TaskCardProps> = ({ task, index, onEdit, onDelete, onToggleComplete }) => {
  const deadlineDate = new Date(task.deadline);
  const isOverdue = !task.is_completed && isPast(deadlineDate);
  const isActive = !task.is_completed && !isOverdue;

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

  const status = task.is_completed
    ? {
        color: '#059669',
        glow: 'rgba(16,185,129,0.18)',
        bg: 'rgba(16,185,129,0.13)',
        border: 'rgba(16,185,129,0.25)',
        icon: FiCheckCircle,
        label: 'Готово',
        accent: '#10B981',
        accentEnd: '#34D399',
        tint: 'rgba(16,185,129,0.04)',
        shadow: '0 4px 20px rgba(16,185,129,0.12)',
      }
    : isOverdue
      ? {
          color: '#DC2626',
          glow: 'rgba(239,68,68,0.2)',
          bg: 'rgba(239,68,68,0.12)',
          border: 'rgba(239,68,68,0.25)',
          icon: FiAlertTriangle,
          label: 'Просрочено',
          accent: '#EF4444',
          accentEnd: '#F87171',
          tint: 'rgba(239,68,68,0.05)',
          shadow: '0 4px 20px rgba(239,68,68,0.12)',
        }
      : {
          color: '#7C3AED',
          glow: 'rgba(124,58,237,0.2)',
          bg: 'rgba(124,58,237,0.1)',
          border: 'rgba(124,58,237,0.2)',
          icon: FiClock,
          label: 'В работе',
          accent: '#6C5CE7',
          accentEnd: '#A29BFE',
          tint: 'rgba(108,92,231,0.04)',
          shadow: '0 4px 20px rgba(108,92,231,0.1)',
        };

  const attachmentCount = task.attachments?.length ?? 0;

  return (
    <motion.article
      initial={{ opacity: 0, y: 18, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: -20, scale: 0.94 }}
      transition={{ delay: index * 0.06, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      whileTap={{ scale: 0.975, transition: { duration: 0.12 } }}
      className="mb-3 relative overflow-hidden"
      style={{
        borderRadius: 20,
        background: 'linear-gradient(145deg, rgba(255,255,255,0.75) 0%, rgba(255,255,255,0.6) 100%)',
        backdropFilter: 'blur(28px) saturate(180%)',
        WebkitBackdropFilter: 'blur(28px) saturate(180%)',
        border: '1px solid rgba(255,255,255,0.65)',
        boxShadow: [
          '0 0 0 0.5px rgba(255,255,255,0.45) inset',
          status.shadow,
          '0 1px 4px rgba(0,0,0,0.05)',
        ].join(', '),
      }}
    >
      {/* Status radial tint */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse at 95% 5%, ${status.tint} 0%, transparent 55%)`,
          borderRadius: 20,
          pointerEvents: 'none',
        }}
      />

      {/* Specular top highlight */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: '8%',
          right: '8%',
          height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.95) 35%, rgba(255,255,255,0.95) 65%, transparent)',
          pointerEvents: 'none',
          zIndex: 3,
        }}
      />

      {/* Glare sweep — one shot on card appear */}
      <motion.div
        initial={{ x: '-120%', skewX: -18 }}
        animate={{ x: '230%', skewX: -18 }}
        transition={{ delay: index * 0.06 + 0.05, duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          width: '38%',
          background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.38) 50%, transparent 100%)',
          pointerEvents: 'none',
          zIndex: 2,
        }}
      />

      {/* Accent bar — scaleX reveal from left */}
      <motion.div
        initial={{ scaleX: 0, originX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: index * 0.06 + 0.1, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        style={{
          height: 3,
          background: `linear-gradient(90deg, ${status.accent} 0%, ${status.accentEnd} 60%, transparent 100%)`,
          borderRadius: '20px 20px 0 0',
          transformOrigin: 'left',
        }}
      />

      {/* Card body */}
      <div style={{ padding: '13px 15px 13px', position: 'relative', zIndex: 4 }}>

        {/* Row 1: checkbox + task text + status badge */}
        <div className="flex items-start gap-3 mb-3">
          {/* Toggle complete checkbox */}
          <motion.button
            whileTap={{ scale: 0.78, transition: { duration: 0.1, type: 'spring', stiffness: 500 } }}
            onClick={(e) => { e.stopPropagation(); onToggleComplete?.(task.id, !task.is_completed); }}
            aria-label={task.is_completed ? 'Отметить активной' : 'Отметить выполненной'}
            style={{
              flexShrink: 0,
              marginTop: 2,
              width: 22,
              height: 22,
              borderRadius: '50%',
              border: `2px solid ${task.is_completed ? '#10B981' : status.accent}`,
              background: task.is_completed
                ? 'linear-gradient(135deg, #10B981, #34D399)'
                : 'rgba(255,255,255,0.5)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: task.is_completed
                ? '0 2px 8px rgba(16,185,129,0.35)'
                : `0 1px 4px ${status.accent}22`,
              transition: 'background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
            }}
          >
            {task.is_completed && <FiCheck size={12} color="white" strokeWidth={3} />}
          </motion.button>

          <p
            className="flex-1 font-semibold"
            style={{
              color: task.is_completed ? '#9CA3AF' : '#1A1A2E',
              fontSize: 15,
              lineHeight: 1.45,
              wordBreak: 'break-word',
              textDecoration: task.is_completed ? 'line-through' : 'none',
              transition: 'color 0.2s ease',
            }}
          >
            {task.text}
          </p>

          {/* Status badge — glass pill */}
          <motion.span
            initial={{ opacity: 0, scale: 0.75, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: index * 0.06 + 0.22, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="flex-shrink-0 inline-flex items-center gap-1.5 font-semibold"
            style={{
              background: status.bg,
              color: status.color,
              fontSize: 11,
              padding: '4px 9px 4px 7px',
              borderRadius: 20,
              border: `1px solid ${status.border}`,
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              boxShadow: `0 2px 10px ${status.glow}`,
              marginTop: 1,
              whiteSpace: 'nowrap',
            }}
          >
            {isActive
              ? <PulsingDot color={status.color} />
              : <status.icon size={10} />
            }
            {status.label}
          </motion.span>
        </div>

        {/* Row 2: date info + action buttons */}
        <div className="flex items-end justify-between gap-2">

          {/* Date block */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                color: '#6C5CE7',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              <FiCalendar size={11} />
              <span>{dateText}</span>
            </div>
            {relativeText && (
              <span
                style={{
                  color: isOverdue ? '#EF4444' : task.is_completed ? '#10B981' : '#9CA3AF',
                  fontSize: 11,
                  fontWeight: 500,
                  paddingLeft: 1,
                }}
              >
                {relativeText}
              </span>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {attachmentCount > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#9CA3AF', fontSize: 11 }}>
                <FiPaperclip size={11} />
                {attachmentCount}
              </span>
            )}

            {onEdit && (
              <motion.button
                whileTap={{ scale: 0.82, transition: { duration: 0.1 } }}
                onClick={(e) => { e.stopPropagation(); onEdit(task); }}
                aria-label="Редактировать"
                style={{
                  width: 34, height: 34, borderRadius: 11, border: 'none',
                  background: 'rgba(108,92,231,0.1)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  outline: '1px solid rgba(108,92,231,0.2)',
                  color: '#6C5CE7',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', flexShrink: 0,
                }}
              >
                <FiEdit2 size={13} />
              </motion.button>
            )}

            {onDelete && (
              <motion.button
                whileTap={{ scale: 0.82, transition: { duration: 0.1 } }}
                onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
                aria-label="Удалить"
                style={{
                  width: 34, height: 34, borderRadius: 11, border: 'none',
                  background: 'rgba(239,68,68,0.1)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  outline: '1px solid rgba(239,68,68,0.2)',
                  color: '#EF4444',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', flexShrink: 0,
                }}
              >
                <FiTrash2 size={13} />
              </motion.button>
            )}
          </div>
        </div>
      </div>
    </motion.article>
  );
};
