import React, { useState } from 'react';
import { api } from '../api/client';
import { useTelegram } from '../hooks/useTelegram';

export const AddTask: React.FC<{ onSuccess: () => void }> = ({ onSuccess }) => {
  const [text, setText] = useState('');
  const [deadline, setDeadline] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { tg, hapticFeedback } = useTelegram();

  const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) return error.message;
    return 'Неизвестная ошибка';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text || !deadline) return tg.showAlert("Заполни все поля");

    try {
      setIsSubmitting(true);
      // Браузер берет локальное время из input и переводит его в UTC для БД
      const utcDate = new Date(deadline).toISOString(); 
      
      await api.createTask({ text, deadline: utcDate });
      
      hapticFeedback();
      tg.showAlert("Сохранено! Мы напомним за 2 часа.");
      onSuccess();
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      tg.showAlert(`Ошибка при сохранении: ${message}`);
      console.error('Task create failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold mb-6 px-1">Новое задание</h1>
      
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-tg-hint ml-1">Что нужно сделать?</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Например: Написать эссе по истории..."
            className="w-full bg-tg-secondaryBg text-tg-text border border-tg-hint/30 p-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-tg-button transition-all resize-none h-32"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-tg-hint ml-1">Дедлайн (твой часовой пояс)</label>
          <input
            type="datetime-local"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="w-full bg-tg-secondaryBg text-tg-text border border-tg-hint/30 p-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-tg-button transition-all"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-4 w-full bg-tg-button text-tg-buttonText font-bold text-lg py-4 rounded-2xl active:scale-95 transition-transform disabled:opacity-50"
        >
          {isSubmitting ? 'Сохранение...' : 'Сохранить и напомнить'}
        </button>
      </form>
    </div>
  );
};