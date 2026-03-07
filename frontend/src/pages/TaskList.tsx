import React, { useEffect, useState, useCallback, useMemo, useImperativeHandle, forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../api/client';
import type { Task } from '../types';
import { TaskCard } from '../components/TaskCard';
import { FiBookOpen } from 'react-icons/fi';
import { isPast } from 'date-fns';
import { useTelegram } from '../hooks/useTelegram';

type Filter = 'active' | 'done' | 'overdue';

export interface TaskListHandle {
  reload: () => void;
}

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

type TaskListProps = {
  onEdit?: (task: Task) => void;
};

export const TaskList = forwardRef<TaskListHandle, TaskListProps>(({ onEdit }, ref) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('active');
  const { tg, hapticFeedback } = useTelegram();

  const loadTasks = useCallback(async () => {
    try {
      const data = await api.getTasks();
      setTasks(data);
    } catch (error) {
      console.error('Failed to load tasks:', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useImperativeHandle(ref, () => ({ reload: loadTasks }), [loadTasks]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

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
  }, [tg, hapticFeedback]);

  const handleToggleComplete = useCallback(async (taskId: number, value: boolean) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, is_completed: value } : t));
    hapticFeedback();
    try {
      await api.toggleComplete(taskId, value);
    } catch (error) {
      console.error('Toggle failed:', error instanceof Error ? error.message : 'Unknown error');
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, is_completed: !value } : t));
    }
  }, [hapticFeedback]);

  // Single pass through tasks — no repeated iterations on every render
  const { overdueCount, activeCount, doneCount, filteredTasks } = useMemo(() => {
    const overdue: Task[] = [], active: Task[] = [], done: Task[] = [];
    for (const t of tasks) {
      if (t.is_completed) done.push(t);
      else if (isPast(new Date(t.deadline))) overdue.push(t);
      else active.push(t);
    }
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
              <motion.button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                animate={{ scale: isActive ? 1.03 : 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                className="flex-1 text-center"
                style={{
                  background: isActive ? tab.activeBg : tab.bg,
                  borderRadius: 14,
                  padding: '10px 8px',
                  border: isActive ? `1.5px solid ${tab.color}44` : '1.5px solid transparent',
                  cursor: 'pointer',
                  opacity: isActive ? 1 : 0.65,
                  transition: 'background 0.2s ease, opacity 0.2s ease, border-color 0.2s ease',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                }}
              >
                <p className="text-[22px] font-bold leading-none mb-0.5" style={{ color: tab.color }}>{tab.count}</p>
                <p className="text-[11px] font-semibold" style={{ color: tab.color + 'BB' }}>{tab.label}</p>
              </motion.button>
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
      ) : filteredTasks.length === 0 ? (
        <motion.div
          key={filter}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center mt-12"
        >
          <p className="text-base font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
            {filter === 'done' && 'Нет выполненных заданий'}
            {filter === 'overdue' && 'Нет просроченных заданий'}
            {filter === 'active' && 'Нет активных заданий'}
          </p>
        </motion.div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={filter}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <AnimatePresence>
              {filteredTasks.map((task, i) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  index={i}
                  onEdit={onEdit}
                  onDelete={handleDelete}
                  onToggleComplete={handleToggleComplete}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
});
