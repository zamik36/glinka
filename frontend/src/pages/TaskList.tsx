import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '../api/client';
import type { Task } from '../types';
import { TaskCard } from '../components/TaskCard';
import { FiBookOpen } from 'react-icons/fi';
import { isPast } from 'date-fns';

const SkeletonCard: React.FC = () => (
  <div className="card mb-3 p-4">
    <div className="h-4 w-4/5 animate-shimmer mb-3" />
    <div className="h-4 w-3/5 animate-shimmer mb-4" />
    <div className="flex justify-between">
      <div className="h-6 w-28 animate-shimmer rounded-full" />
      <div className="h-6 w-20 animate-shimmer rounded-full" />
    </div>
  </div>
);

export const TaskList: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadTasks = async () => {
    try {
      const data = await api.getTasks();
      setTasks(data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const overdueCount = tasks.filter(t => !t.is_completed && isPast(new Date(t.deadline))).length;
  const activeCount = tasks.filter(t => !t.is_completed).length;
  const doneCount = tasks.filter(t => t.is_completed).length;

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
      {/* Stats row */}
      {tasks.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex gap-2 mb-5"
        >
          <div className="flex-1 rounded-2xl p-3 text-center" style={{ background: '#F3F0FF' }}>
            <p className="text-xl font-bold" style={{ color: '#6C5CE7' }}>{activeCount}</p>
            <p className="text-[11px] font-medium" style={{ color: '#8B7FE8' }}>Активных</p>
          </div>
          <div className="flex-1 rounded-2xl p-3 text-center" style={{ background: '#ECFDF5' }}>
            <p className="text-xl font-bold" style={{ color: '#10B981' }}>{doneCount}</p>
            <p className="text-[11px] font-medium" style={{ color: '#34D399' }}>Готово</p>
          </div>
          {overdueCount > 0 && (
            <div className="flex-1 rounded-2xl p-3 text-center" style={{ background: '#FEF2F2' }}>
              <p className="text-xl font-bold" style={{ color: '#EF4444' }}>{overdueCount}</p>
              <p className="text-[11px] font-medium" style={{ color: '#F87171' }}>Просрочено</p>
            </div>
          )}
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
        <div>
          {tasks.map((task, i) => (
            <TaskCard key={task.id} task={task} index={i} />
          ))}
        </div>
      )}
    </div>
  );
};
