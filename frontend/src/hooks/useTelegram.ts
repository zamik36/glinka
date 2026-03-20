import { useCallback, useMemo } from 'react';
import { getTelegramWebApp, type TelegramUser, type TelegramWebApp } from '../lib/telegram';

interface UseTelegramResult {
  tg: TelegramWebApp;
  user: TelegramUser | undefined;
  initData: string;
  queryId: string | undefined;
  hapticFeedback: () => void;
  hapticError: () => void;
  closeApp: () => void;
  expandApp: () => void;
}

// Singleton — getTelegramWebApp() returns window.Telegram.WebApp which never changes.
const tg = getTelegramWebApp();

export function useTelegram(): UseTelegramResult {
  const hapticFeedback = useCallback(() => tg.HapticFeedback?.impactOccurred('light'), []);
  const hapticError = useCallback(() => tg.HapticFeedback?.notificationOccurred('error'), []);
  const closeApp = useCallback(() => tg.close(), []);
  const expandApp = useCallback(() => tg.expand(), []);

  const stableData = useMemo(() => ({
    user: tg.initDataUnsafe?.user,
    initData: tg.initData,
    queryId: tg.initDataUnsafe?.query_id,
  }), []);

  return {
    tg,
    ...stableData,
    hapticFeedback,
    hapticError,
    closeApp,
    expandApp,
  };
}