import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { Task } from '../types';
import { TaskCard } from '../components/TaskCard';
import { FiLoader } from 'react-icons/fi';

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

  if (isLoading) {
    return <div className="flex justify-center items-center h-64 text-tg-button"><FiLoader className="animate-spin text-3xl" /></div>;
  }

  return (
    <div className="pb-24">
      <h1 className="text-2xl font-bold mb-6 px-1">Мои задания</h1>
      {tasks.length === 0 ? (
        <p className="text-center text-tg-hint mt-10">Пока нет заданий. Отдыхай! 🍻</p>
      ) : (
        tasks.map(task => <TaskCard key={task.id} task={task} />)
      )}
    </div>
  );
};