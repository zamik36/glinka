import React, { useMemo, useState, useCallback, useRef, useEffect, memo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow, isPast, format } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  FiPaperclip, FiClock, FiCheckCircle, FiAlertTriangle,
  FiEdit2, FiTrash2, FiCalendar, FiCheck, FiBell,
} from 'react-icons/fi';
import type { Task } from '../types';

// ─── Confetti — exported so TaskList can own the lifetime ─────────────────────

const CONFETTI_POOL = ['✨', '⭐', '🌟', '💫', '🎉', '🎊', '🏆', '🥳', '💥', '🔥', '🎈', '🌈', '💎', '🦋', '🌸', '⚡'];
const PARTICLE_COUNT = 10;

interface Particle { id: number; emoji: string; angle: number; distance: number; }

export function makeConfettiParticles(): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    id: i,
    emoji: CONFETTI_POOL[Math.floor(Math.random() * CONFETTI_POOL.length)],
    angle: (360 / PARTICLE_COUNT) * i + (Math.random() * 24 - 12),
    distance: 80 + Math.random() * 80,
  }));
}

/** Renders into document.body via portal — CSS animation, no Framer Motion context needed. */
export const ConfettiBurst: React.FC<{ originX: number; originY: number }> = memo(({ originX, originY }) => {
  const particles = useMemo(() => makeConfettiParticles(), []);
  return createPortal(
    <>
      {particles.map(p => {
        const rad = (p.angle * Math.PI) / 180;
        const tx = Math.cos(rad) * p.distance;
        const ty = Math.sin(rad) * p.distance;
        return (
          <span
            key={p.id}
            className="confetti-particle"
            style={{
              left: originX,
              top: originY,
              '--tx': `${tx}px`,
              '--ty': `${ty}px`,
            } as React.CSSProperties}
          >
            {p.emoji}
          </span>
        );
      })}
    </>,
    document.body,
  );
});

// ─── Ring burst — on task uncomplete ─────────────────────────────────────────

const RingBurst: React.FC = memo(() => (
  <>
    <motion.span
      initial={{ scale: 0.4, opacity: 1 }}
      animate={{ scale: 2.8, opacity: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      style={{
        position: 'absolute', left: 0, top: 0, width: 22, height: 22,
        borderRadius: '50%', border: '2.5px solid #6C5CE7',
        pointerEvents: 'none', zIndex: 50,
      }}
    />
    <motion.span
      initial={{ scale: 0.4, opacity: 0.6 }}
      animate={{ scale: 2.0, opacity: 0 }}
      transition={{ duration: 0.38, ease: 'easeOut', delay: 0.08 }}
      style={{
        position: 'absolute', left: 0, top: 0, width: 22, height: 22,
        borderRadius: '50%', border: '1.5px solid #A29BFE',
        pointerEvents: 'none', zIndex: 50,
      }}
    />
  </>
));

// ─── PulsingDot ───────────────────────────────────────────────────────────────

const PulsingDot: React.FC<{ color: string }> = memo(({ color }) => (
  <span style={{ position: 'relative', display: 'inline-flex', width: 8, height: 8, flexShrink: 0 }}>
    <span className="pulse-ring" style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: color }} />
    <span style={{ position: 'relative', width: 8, height: 8, borderRadius: '50%', background: color, display: 'block' }} />
  </span>
));

// ─── TaskCard ─────────────────────────────────────────────────────────────────

type TaskCardProps = {
  task: Task;
  index: number;
  onEdit?: (task: Task) => void;
  onDelete?: (taskId: number) => void;
  onToggleComplete?: (taskId: number, value: boolean) => void;
  onView?: (task: Task) => void;
  /** Called with fixed screen coords of the checkbox center right when user clicks */
  onConfettiTrigger?: (x: number, y: number) => void;
};

export const TaskCard: React.FC<TaskCardProps> = memo(({
  task, index, onEdit, onDelete, onToggleComplete, onConfettiTrigger, onView,
}) => {
  const deadlineDate = useMemo(() => new Date(task.deadline), [task.deadline]);
  const isOverdue    = !task.is_completed && isPast(deadlineDate) && task.reminder_status !== 'sent';
  const isInProgress = !task.is_completed && !isOverdue && task.reminder_status !== 'sent';

  const { relativeText, dateText } = useMemo(() => {
    let relText = '';
    try {
      relText = isOverdue
        ? 'Просрочено'
        : formatDistanceToNow(deadlineDate, { addSuffix: true, locale: ru });
    } catch { /* noop */ }
    let dText = '';
    try { dText = format(deadlineDate, 'd MMM, HH:mm', { locale: ru }); }
    catch { dText = deadlineDate.toLocaleString(); }
    return { relativeText: relText, dateText: dText };
  }, [deadlineDate, isOverdue]);

  const status = useMemo(() => {
    if (task.is_completed)
      return { color: '#059669', glow: 'rgba(16,185,129,0.18)',  bg: 'rgba(16,185,129,0.13)',  border: 'rgba(16,185,129,0.25)',  icon: FiCheckCircle,   label: 'Готово',     accent: '#10B981', accentEnd: '#34D399', tint: 'rgba(16,185,129,0.04)',  shadow: '0 4px 20px rgba(16,185,129,0.12)' };
    if (task.reminder_status === 'sent')
      return { color: '#D97706', glow: 'rgba(217,119,6,0.18)',   bg: 'rgba(217,119,6,0.10)',   border: 'rgba(217,119,6,0.22)',   icon: FiBell,          label: 'Напомнено',  accent: '#F59E0B', accentEnd: '#FCD34D', tint: 'rgba(217,119,6,0.04)',   shadow: '0 4px 20px rgba(217,119,6,0.10)' };
    if (isOverdue)
      return { color: '#DC2626', glow: 'rgba(239,68,68,0.2)',    bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.25)',   icon: FiAlertTriangle, label: 'Просрочено', accent: '#EF4444', accentEnd: '#F87171', tint: 'rgba(239,68,68,0.05)',   shadow: '0 4px 20px rgba(239,68,68,0.12)' };
    return   { color: '#7C3AED', glow: 'rgba(124,58,237,0.2)',   bg: 'rgba(124,58,237,0.1)',   border: 'rgba(124,58,237,0.2)',   icon: FiClock,         label: 'В работе',   accent: '#6C5CE7', accentEnd: '#A29BFE', tint: 'rgba(108,92,231,0.04)', shadow: '0 4px 20px rgba(108,92,231,0.1)' };
  }, [task.is_completed, task.reminder_status, isOverdue]);

  const attachmentCount = task.attachments?.length ?? 0;

  const nextReminderText = useMemo(() => {
    if (task.is_completed || !task.reminders?.length) return null;
    const now = Date.now();
    const pending = task.reminders
      .filter(r => r.status === 'pending' && new Date(r.remind_at).getTime() > now)
      .sort((a, b) => new Date(a.remind_at).getTime() - new Date(b.remind_at).getTime());
    if (!pending.length) return null;
    try { return format(new Date(pending[0].remind_at), 'd MMM, HH:mm', { locale: ru }); }
    catch { return null; }
  }, [task.is_completed, task.reminders]);

  const [showRing, setShowRing]       = useState(false);
  const [checkBounce, setCheckBounce] = useState(false);
  const checkboxRef                   = useRef<HTMLDivElement>(null);
  const isTogglingRef                 = useRef(false);
  const pendingTimers                 = useRef<ReturnType<typeof setTimeout>[]>([]);
  const onToggleCompleteRef           = useRef(onToggleComplete);
  onToggleCompleteRef.current = onToggleComplete;

  useEffect(() => {
    const timers = pendingTimers.current;
    return () => {
      timers.forEach(clearTimeout);
    };
  }, []);

  const handleCheckboxClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (isTogglingRef.current) return;
    isTogglingRef.current = true;
    const becomingComplete = !task.is_completed;

    const schedule = (fn: () => void, ms: number) => {
      const id = setTimeout(fn, ms);
      pendingTimers.current.push(id);
      return id;
    };

    if (becomingComplete) {
      const rect = checkboxRef.current?.getBoundingClientRect();
      const ox = rect ? rect.left + rect.width / 2 : 0;
      const oy = rect ? rect.top + rect.height / 2 : 0;
      onConfettiTrigger?.(ox, oy);
      setCheckBounce(true);
      schedule(() => setCheckBounce(false), 600);
      schedule(() => {
        onToggleCompleteRef.current?.(task.id, becomingComplete);
        isTogglingRef.current = false;
      }, 650);
    } else {
      setShowRing(true);
      schedule(() => setShowRing(false), 550);
      schedule(() => {
        onToggleCompleteRef.current?.(task.id, becomingComplete);
        isTogglingRef.current = false;
      }, 200);
    }
  }, [task.id, task.is_completed, onConfettiTrigger]);

  return (
    <article
      className="mb-3 relative animate-card-in"
      onClick={() => onView?.(task)}
      style={{
        cursor: onView ? 'pointer' : undefined,
        animationDelay: `${index * 0.06}s`,
        borderRadius: 20,
        background: 'linear-gradient(145deg, rgba(255,255,255,0.94) 0%, rgba(255,255,255,0.87) 100%)',
        border: '1px solid rgba(255,255,255,0.65)',
        boxShadow: [
          '0 0 0 0.5px rgba(255,255,255,0.45) inset',
          status.shadow,
          '0 1px 4px rgba(0,0,0,0.05)',
        ].join(', '),
      }}
    >
      {/* Decorative layer with its own overflow:hidden */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 20,
        overflow: 'hidden', pointerEvents: 'none', zIndex: 0,
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: `radial-gradient(ellipse at 95% 5%, ${status.tint} 0%, transparent 55%)`,
        }} />
        <div style={{
          position: 'absolute', top: 0, left: '8%', right: '8%', height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.95) 35%, rgba(255,255,255,0.95) 65%, transparent)',
        }} />
        <div className="glare-sweep" style={{ animationDelay: `${index * 0.06 + 0.05}s` }} />
        <div
          className="bar-reveal"
          style={{
            animationDelay: `${index * 0.06 + 0.1}s`,
            background: `linear-gradient(90deg, ${status.accent} 0%, ${status.accentEnd} 60%, transparent 100%)`,
          }}
        />
      </div>

      {/* Card body */}
      <div style={{ padding: '13px 15px 13px', position: 'relative', zIndex: 4 }}>

        {/* Row 1: checkbox + text + status badge */}
        <div className="flex items-start gap-3 mb-3">

          {/* Checkbox */}
          <div ref={checkboxRef} style={{ position: 'relative', flexShrink: 0, marginTop: 2 }}>
            {showRing && <RingBurst />}

            <motion.button
              animate={checkBounce ? { scale: [1, 1.4, 0.9, 1] } : { scale: 1 }}
              transition={checkBounce
                ? { duration: 0.4, times: [0, 0.4, 0.7, 1], type: 'spring', stiffness: 500, damping: 20 }
                : { duration: 0.15 }
              }
              whileTap={{ scale: 0.78, transition: { duration: 0.1, type: 'spring', stiffness: 500 } }}
              onClick={handleCheckboxClick}
              aria-label={task.is_completed ? 'Отметить активной' : 'Отметить выполненной'}
              style={{
                width: 22, height: 22, borderRadius: '50%',
                border: `2px solid ${task.is_completed ? '#10B981' : status.accent}`,
                background: task.is_completed
                  ? 'linear-gradient(135deg, #10B981, #34D399)'
                  : 'rgba(255,255,255,0.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: task.is_completed
                  ? '0 2px 8px rgba(16,185,129,0.35)'
                  : `0 1px 4px ${status.accent}22`,
                transition: 'background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
              }}
            >
              <AnimatePresence mode="wait" initial={false}>
                {task.is_completed && (
                  <motion.span
                    key="check"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 600, damping: 20 }}
                  >
                    <FiCheck size={12} color="white" strokeWidth={3} />
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </div>

          <p
            className="flex-1 font-semibold"
            style={{
              color: task.is_completed ? '#9CA3AF' : '#1A1A2E',
              fontSize: 15,
              lineHeight: 1.45,
              wordBreak: 'break-word',
              textDecoration: task.is_completed ? 'line-through' : 'none',
              transition: 'color 0.25s ease, text-decoration 0.1s ease',
            }}
          >
            {task.text}
          </p>

          {/* Status badge */}
          <span
            className="flex-shrink-0 inline-flex items-center gap-1.5 font-semibold animate-badge-in"
            style={{
              animationDelay: `${index * 0.06 + 0.22}s`,
              background: status.bg,
              color: status.color,
              fontSize: 11,
              padding: '4px 9px 4px 7px',
              borderRadius: 20,
              border: `1px solid ${status.border}`,
              boxShadow: `0 2px 10px ${status.glow}`,
              marginTop: 1,
              whiteSpace: 'nowrap',
              transition: 'background 0.25s ease, color 0.25s ease, border-color 0.25s ease',
            }}
          >
            {isInProgress ? <PulsingDot color={status.color} /> : <status.icon size={10} />}
            {status.label}
          </span>
        </div>

        {/* Row 2: date info + action buttons */}
        <div className="flex items-end justify-between gap-2">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#6C5CE7', fontSize: 12, fontWeight: 600 }}>
              <FiCalendar size={11} />
              <span>{dateText}</span>
            </div>
            {relativeText && (
              <span style={{
                color: isOverdue ? '#EF4444' : task.is_completed ? '#10B981' : '#9CA3AF',
                fontSize: 11, fontWeight: 500, paddingLeft: 1,
                transition: 'color 0.25s ease',
              }}>
                {relativeText}
              </span>
            )}
            {nextReminderText && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#A29BFE', fontSize: 11, fontWeight: 500 }}>
                <FiBell size={10} />
                <span>{nextReminderText}</span>
              </div>
            )}
          </div>

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
                  background: 'rgba(108,92,231,0.14)',
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
                  background: 'rgba(239,68,68,0.14)',
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
    </article>
  );
});
