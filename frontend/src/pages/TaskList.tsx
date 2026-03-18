import React, { useState, useCallback, useMemo, useRef, startTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../api/client';
import type { Task } from '../types';
import { TaskCard, ConfettiBurst } from '../components/TaskCard';
import { FiBookOpen } from 'react-icons/fi';
import { isPast } from 'date-fns';
import { useTelegram } from '../hooks/useTelegram';

type Filter = 'active' | 'done' | 'overdue';

const SkeletonCard: React.FC = () => (
  <div
    className="mb-3 overflow-hidden"
    style={{
      background: 'var(--surface-card)',
      borderRadius: 18,
      border: '1px solid var(--border-light)',
    }}
  >
    <div className="animate-shimmer" style={{ height: 3, borderRadius: '18px 18px 0 0' }} />
    <div style={{ padding: '14px 16px 12px' }}>
      <div className="flex justify-between items-start mb-3 gap-3">
        <div className="h-4 w-3/5 animate-shimmer rounded-lg" />
        <div className="h-5 w-16 animate-shimmer rounded-full flex-shrink-0" />
      </div>
      <div className="flex justify-between items-end">
        <div className="flex flex-col gap-1">
          <div className="h-3.5 w-24 animate-shimmer rounded" />
          <div className="h-3 w-16 animate-shimmer rounded" />
        </div>
        <div className="flex gap-2">
          <div className="w-8 h-8 animate-shimmer rounded-[10px]" />
          <div className="w-8 h-8 animate-shimmer rounded-[10px]" />
        </div>
      </div>
    </div>
  </div>
);

const PAGE_SIZE = 20;
const COMPLETE_ANIM_MS = 650;
const UNCOMPLETE_ANIM_MS = 200;

type TaskListProps = {
  tasks: Task[];
  isLoading: boolean;
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  onEdit?: (task: Task) => void;
  onView?: (task: Task) => void;
};

export function TaskList({ tasks, isLoading, setTasks, onEdit, onView }: TaskListProps) {
  const [filter, setFilter] = useState<Filter>('active');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [confettiBursts, setConfettiBursts] = useState<{ id: number; x: number; y: number }[]>([]);
  const burstCounter = useRef(0);
  const { tg, hapticFeedback } = useTelegram();

  const handleDelete = useCallback((taskId: number) => {
    tg.showConfirm('Удалить задание?', async (confirmed: boolean) => {
      if (!confirmed) return;
      try {
        await api.deleteTask(taskId);
        hapticFeedback();
        setTasks(prev => prev.filter(t => t.id !== taskId));
      } catch (error) {
        console.error('Delete failed:', error instanceof Error ? error.message : 'Unknown error');
        tg.showAlert('Ошибка при удалении');
      }
    });
  }, [tg, hapticFeedback, setTasks]);

  const handleConfettiTrigger = useCallback((x: number, y: number) => {
    const id = ++burstCounter.current;
    setConfettiBursts(prev => [...prev, { id, x, y }]);
    setTimeout(() => setConfettiBursts(prev => prev.filter(b => b.id !== id)), 4000);
  }, []);

  const handleToggleComplete = useCallback(async (taskId: number, value: boolean) => {
    hapticFeedback();
    const animDelay = new Promise<void>(r => setTimeout(r, value ? COMPLETE_ANIM_MS : UNCOMPLETE_ANIM_MS));
    try {
      await Promise.all([api.toggleComplete(taskId, value), animDelay]);
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, is_completed: value } : t));
    } catch (error) {
      console.error('Toggle failed:', error instanceof Error ? error.message : 'Unknown error');
      tg.HapticFeedback?.notificationOccurred('error');
    }
  }, [hapticFeedback, tg, setTasks]);

  const changeFilter = useCallback((f: Filter) => {
    startTransition(() => setFilter(f));
    setVisibleCount(PAGE_SIZE);
  }, []);

  // Single pass through tasks — no repeated iterations on every render
  const { overdueCount, activeCount, doneCount, filteredTasks } = useMemo(() => {
    const overdue: Task[] = [], active: Task[] = [], done: Task[] = [];
    for (const t of tasks) {
      if (t.is_completed) done.push(t);
      else if (isPast(new Date(t.deadline)) && t.reminder_status !== 'sent') overdue.push(t);
      else active.push(t);
    }
    // Sort active: tasks with sent reminders appear before pending ones.
    // Precompute rank + deadline ms to avoid repeated allocations in comparator.
    type Keyed = { task: Task; rank: number; deadlineMs: number };
    const keyed: Keyed[] = active.map(t => ({
      task: t,
      rank: t.reminder_status === 'sent' ? 0 : 1,
      deadlineMs: new Date(t.deadline).getTime(),
    }));
    keyed.sort((a, b) => a.rank - b.rank || a.deadlineMs - b.deadlineMs);
    active.length = 0;
    for (const k of keyed) active.push(k.task);
    const map: Record<Filter, Task[]> = { active, done, overdue };
    return {
      overdueCount: overdue.length,
      activeCount: active.length,
      doneCount: done.length,
      filteredTasks: map[filter],
    };
  }, [tasks, filter]);

  const statTabs: { key: Filter; count: number; label: string; color: string; bg: string; activeBg: string }[] = [
    { key: 'active', count: activeCount, label: 'Активных', color: '#6C5CE7', bg: 'rgba(108,92,231,0.07)', activeBg: 'rgba(108,92,231,0.14)' },
    { key: 'done', count: doneCount, label: 'Готово', color: '#059669', bg: 'rgba(16,185,129,0.07)', activeBg: 'rgba(16,185,129,0.14)' },
    ...(overdueCount > 0
      ? [{ key: 'overdue' as Filter, count: overdueCount, label: 'Просрочено', color: '#DC2626', bg: 'rgba(239,68,68,0.07)', activeBg: 'rgba(239,68,68,0.14)' }]
      : []),
  ];

  if (isLoading) {
    return (
      <div>
        <div className="h-7 w-48 animate-shimmer mb-2 rounded-lg" />
        <div className="h-5 w-36 animate-shimmer mb-5 rounded-lg" />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  return (
    <div>
      {/* Filter tabs */}
      {tasks.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex gap-2.5 mb-5"
        >
          {statTabs.map(tab => {
            const isActive = filter === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => changeFilter(tab.key)}
                className="flex-1 text-center"
                style={{
                  background: isActive ? tab.activeBg : tab.bg,
                  borderRadius: 14,
                  padding: '10px 8px',
                  border: isActive ? `1.5px solid ${tab.color}44` : '1.5px solid transparent',
                  cursor: 'pointer',
                  opacity: isActive ? 1 : 0.65,
                  transform: isActive ? 'scale(1.03)' : 'scale(1)',
                  transition: 'background 0.2s ease, opacity 0.2s ease, border-color 0.2s ease, transform 0.2s ease',
                }}
              >
                <p className="text-[22px] font-bold leading-none mb-0.5" style={{ color: tab.color }}>{tab.count}</p>
                <p className="text-[11px] font-semibold" style={{ color: tab.color + 'BB' }}>{tab.label}</p>
              </button>
            );
          })}
        </motion.div>
      )}

      {tasks.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center justify-center mt-16"
        >
          <div
            className="w-24 h-24 rounded-3xl flex items-center justify-center mb-6 animate-float"
            style={{ background: 'linear-gradient(135deg, #F3F0FF, #E9E5FF)' }}
          >
            <FiBookOpen className="text-4xl" style={{ color: '#6C5CE7' }} />
          </div>
          <p className="text-lg font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
            Нет заданий
          </p>
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
            Самое время отдохнуть или добавить новое
          </p>
          <div
            className="inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-full"
            style={{ background: '#F3F0FF', color: '#6C5CE7' }}
          >
            Нажми <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg text-white text-xs font-bold" style={{ background: '#6C5CE7' }}>+</span> чтобы начать
          </div>
        </motion.div>
      ) : (
        // Cards + empty-filter message share one AnimatePresence so
        // the last card always plays its exit before the empty state appears.
        <AnimatePresence mode="wait">
          <motion.div
            key={filter}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <AnimatePresence>
              {filteredTasks.slice(0, visibleCount).map((task, i) => (
                <motion.div
                  key={task.id}
                  layout
                  initial={{ opacity: 0, y: 16, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{
                    duration: 0.38,
                    delay: Math.min(i, 11) * 0.06,
                    ease: [0.22, 1, 0.36, 1],
                    layout: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
                  }}
                >
                  <TaskCard
                    task={task}
                    index={Math.min(i, 11)}
                    onEdit={onEdit}
                    onDelete={handleDelete}
                    onToggleComplete={handleToggleComplete}
                    onConfettiTrigger={handleConfettiTrigger}
                    onView={onView}
                  />
                </motion.div>
              ))}
            </AnimatePresence>

            {filteredTasks.length > visibleCount && (
              <button
                onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
                style={{
                  width: '100%',
                  padding: '12px',
                  marginTop: 4,
                  borderRadius: 14,
                  border: '1.5px solid rgba(108,92,231,0.2)',
                  background: 'rgba(108,92,231,0.07)',
                  color: '#6C5CE7',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Показать ещё {Math.min(PAGE_SIZE, filteredTasks.length - visibleCount)}
              </button>
            )}

            {/* Empty-filter message — appears after all cards have exited */}
            <AnimatePresence>
              {filteredTasks.length === 0 && (
                <motion.div
                  key="filter-empty"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25, delay: 0.1 }}
                  className="flex flex-col items-center justify-center mt-12"
                >
                  <p className="text-base font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                    {filter === 'done'    && 'Нет выполненных заданий'}
                    {filter === 'overdue' && 'Нет просроченных заданий'}
                    {filter === 'active'  && 'Нет активных заданий'}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </AnimatePresence>
      )}

      {confettiBursts.map(b => (
        <ConfettiBurst key={b.id} originX={b.x} originY={b.y} />
      ))}
    </div>
  );
}
