import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTelegram } from './hooks/useTelegram';
import { TaskList } from './pages/TaskList';
import type { TaskListHandle } from './pages/TaskList';
import { AddTask } from './pages/AddTask';
import { FiPlus } from 'react-icons/fi';
import type { Task } from './types';

const App: React.FC = () => {
  const { tg, expandApp } = useTelegram();
  const [showAddTask, setShowAddTask] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const taskListRef = useRef<TaskListHandle>(null);

  useEffect(() => {
    tg.ready();
    expandApp();
  }, [tg, expandApp]);

  const handleTaskCreated = useCallback(() => {
    setShowAddTask(false);
    setEditingTask(null);
    taskListRef.current?.reload();
  }, []);

  const handleEdit = useCallback((task: Task) => {
    setEditingTask(task);
    setShowAddTask(true);
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
      </header>

      {/* Main content */}
      <main className="relative z-10 px-4 pb-28">
        <TaskList ref={taskListRef} onEdit={handleEdit} />
      </main>

      {/* FAB — hidden when bottom sheet is open */}
      <AnimatePresence>
        {!showAddTask && (
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

      {/* Bottom Sheet */}
      <AnimatePresence>
        {showAddTask && (
          <>
            <motion.div
              className="fixed inset-0 z-40"
              style={{ background: 'rgba(26, 26, 46, 0.4)', backdropFilter: 'blur(4px)' }}
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
              }}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 350 }}
            >
              {/* Drag handle */}
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
    </div>
  );
};

export default App;
