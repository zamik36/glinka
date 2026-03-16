import React, { useEffect, useState, useCallback, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTelegram } from './hooks/useTelegram';
import { TaskList } from './pages/TaskList';
import { AddTask } from './pages/AddTask';
import { TaskDetail } from './components/TaskDetail';
import { FiPlus, FiCalendar, FiArrowLeft } from 'react-icons/fi';
import { api } from './api/client';
import type { Task } from './types';

const CalendarView = lazy(() => import('./pages/CalendarView'));

const App: React.FC = () => {
  const { tg, expandApp } = useTelegram();
  const [showAddTask, setShowAddTask] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [viewingTask, setViewingTask] = useState<Task | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  useEffect(() => {
    tg.ready();
    expandApp();
    loadTasks();
  }, [tg, expandApp, loadTasks]);

  const handleTaskCreated = useCallback(() => {
    setShowAddTask(false);
    setEditingTask(null);
    loadTasks();
  }, [loadTasks]);

  const handleEdit = useCallback((task: Task) => {
    setViewingTask(null);
    setEditingTask(task);
    setShowAddTask(true);
  }, []);

  const handleView = useCallback((task: Task) => {
    setViewingTask(task);
  }, []);

  const handleSheetClose = useCallback(() => {
    setShowAddTask(false);
    setEditingTask(null);
  }, []);

  return (
    <div className="min-h-screen relative" style={{ background: 'var(--surface)' }}>
      {/* Decorative background blobs — fixed position, GPU-promoted via will-change in CSS */}
      <div className="bg-blob animate-blob" style={{ width: 320, height: 320, background: '#6C5CE7', top: -90, right: -70 }} />
      <div className="bg-blob animate-blob" style={{ width: 260, height: 260, background: '#A29BFE', bottom: 80, left: -90, animationDelay: '-3s' }} />
      <div className="bg-blob animate-blob" style={{ width: 220, height: 220, background: '#C4B5FD', top: '38%', right: -50, animationDelay: '-5s' }} />

      {/* Header */}
      <header className="relative z-10 pt-6 pb-4 px-5">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}
        >
          {/* Title block */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <AnimatePresence mode="wait" initial={false}>
              {showCalendar ? (
                <motion.div
                  key="cal-title"
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.2 }}
                >
                  <h1 className="text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
                    Календарь
                  </h1>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Задачи по датам
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="main-title"
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 16 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl">📚</span>
                    <h1 className="text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
                      Homework Tracker
                    </h1>
                  </div>
                  <p className="text-sm ml-10" style={{ color: 'var(--text-secondary)' }}>
                    Не забывай про дедлайны
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Calendar toggle button — top-right */}
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={() => setShowCalendar(v => !v)}
            style={{
              width: 40, height: 40, borderRadius: 12, flexShrink: 0, marginTop: 2,
              background: showCalendar
                ? 'linear-gradient(135deg, var(--gradient-start), var(--gradient-end))'
                : 'rgba(108, 92, 231, 0.1)',
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: showCalendar ? '0 4px 14px rgba(108, 92, 231, 0.35)' : 'none',
            }}
            aria-label={showCalendar ? 'Назад' : 'Календарь'}
          >
            <AnimatePresence mode="wait" initial={false}>
              {showCalendar ? (
                <motion.span
                  key="back"
                  initial={{ opacity: 0, rotate: -90 }}
                  animate={{ opacity: 1, rotate: 0 }}
                  exit={{ opacity: 0, rotate: 90 }}
                  transition={{ duration: 0.18 }}
                >
                  <FiArrowLeft style={{ color: '#fff', fontSize: 18 }} />
                </motion.span>
              ) : (
                <motion.span
                  key="cal"
                  initial={{ opacity: 0, rotate: 90 }}
                  animate={{ opacity: 1, rotate: 0 }}
                  exit={{ opacity: 0, rotate: -90 }}
                  transition={{ duration: 0.18 }}
                >
                  <FiCalendar style={{ color: 'var(--accent)', fontSize: 18 }} />
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </motion.div>
      </header>

      {/* Main content */}
      <main className="relative z-10 px-4 pb-28">
        <AnimatePresence mode="wait" initial={false}>
          {showCalendar ? (
            <motion.div
              key="calendar"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 40 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            >
              <Suspense fallback={<div className="h-64 animate-shimmer rounded-3xl" />}>
                <CalendarView tasks={tasks} isLoading={isLoading} />
              </Suspense>
            </motion.div>
          ) : (
            <motion.div
              key="tasklist"
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            >
              <TaskList tasks={tasks} isLoading={isLoading} setTasks={setTasks} onEdit={handleEdit} onView={handleView} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* FAB — hidden when bottom sheet or calendar is open */}
      <AnimatePresence>
        {!showAddTask && !showCalendar && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            onClick={() => { setEditingTask(null); setShowAddTask(true); }}
            className="fixed bottom-6 right-6 z-30 w-16 h-16 rounded-2xl flex items-center justify-center shadow-xl"
            style={{
              background: 'linear-gradient(135deg, var(--gradient-start), var(--gradient-end))',
              boxShadow: '0 6px 24px rgba(108, 92, 231, 0.4)',
            }}
            whileTap={{ scale: 0.9 }}
            aria-label="Add task"
          >
            <FiPlus className="text-white text-2xl" strokeWidth={3} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Bottom Sheet — Add/Edit Task */}
      <AnimatePresence>
        {showAddTask && (
          <>
            <motion.div
              className="fixed inset-0 z-40"
              style={{ background: 'rgba(15, 12, 35, 0.55)' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={handleSheetClose}
            />
            <motion.div
              className="fixed bottom-0 left-0 right-0 z-50 max-h-[92vh] overflow-y-auto"
              style={{
                background: 'var(--surface-elevated)',
                borderTopLeftRadius: 28,
                borderTopRightRadius: 28,
                boxShadow: '0 -8px 40px rgba(108, 92, 231, 0.15)',
                overscrollBehavior: 'contain',
                WebkitOverflowScrolling: 'touch',
              }}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 350 }}
            >
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1.5 rounded-full" style={{ background: 'var(--accent-soft)' }} />
              </div>
              <AddTask
                key={editingTask?.id ?? 'new'}
                onSuccess={handleTaskCreated}
                onClose={handleSheetClose}
                editTask={editingTask}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Bottom Sheet — Task Detail */}
      <AnimatePresence>
        {viewingTask && (
          <>
            <motion.div
              className="fixed inset-0 z-40"
              style={{ background: 'rgba(15, 12, 35, 0.55)' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={() => setViewingTask(null)}
            />
            <motion.div
              className="fixed bottom-0 left-0 right-0 z-50 max-h-[92vh] overflow-y-auto"
              style={{
                background: 'var(--surface-elevated)',
                borderTopLeftRadius: 28,
                borderTopRightRadius: 28,
                boxShadow: '0 -8px 40px rgba(108, 92, 231, 0.15)',
                overscrollBehavior: 'contain',
                WebkitOverflowScrolling: 'touch',
              }}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 350 }}
            >
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1.5 rounded-full" style={{ background: 'var(--accent-soft)' }} />
              </div>
              <TaskDetail
                key={viewingTask.id}
                task={viewingTask}
                onClose={() => setViewingTask(null)}
                onEdit={handleEdit}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
