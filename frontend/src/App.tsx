import React, { useEffect, useState } from 'react';
import { useTelegram } from './hooks/useTelegram';
import { TaskList } from './pages/TaskList';
import { AddTask } from './pages/AddTask';
import { FiList, FiPlusCircle } from 'react-icons/fi';

type Tab = 'list' | 'add';

const App: React.FC = () => {
  const { tg, expandApp } = useTelegram();
  const [activeTab, setActiveTab] = useState<Tab>('list');

  useEffect(() => {
    tg.ready();      // Сообщаем телеграму, что приложение загрузилось
    expandApp();     // Разворачиваем на весь экран
  }, [tg, expandApp]);

  return (
    <div className="min-h-screen bg-tg-bg text-tg-text font-sans flex flex-col">
      
      {/* Главный контент */}
      <main className="flex-1 overflow-y-auto p-4">
        {activeTab === 'list' && <TaskList />}
        {activeTab === 'add' && <AddTask onSuccess={() => setActiveTab('list')} />}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 w-full bg-tg-secondaryBg border-t border-tg-hint/20 pb-safe">
        <div className="flex justify-around items-center p-3">
          
          <button 
            onClick={() => setActiveTab('list')}
            className={`flex flex-col items-center gap-1 w-20 transition-colors ${activeTab === 'list' ? 'text-tg-button' : 'text-tg-hint'}`}
          >
            <FiList className="text-2xl" />
            <span className="text-[10px] font-medium">Задания</span>
          </button>

          <button 
            onClick={() => setActiveTab('add')}
            className={`flex flex-col items-center gap-1 w-20 transition-colors ${activeTab === 'add' ? 'text-tg-button' : 'text-tg-hint'}`}
          >
            <FiPlusCircle className="text-2xl" />
            <span className="text-[10px] font-medium">Добавить</span>
          </button>

        </div>
      </nav>
      
    </div>
  );
};

export default App;