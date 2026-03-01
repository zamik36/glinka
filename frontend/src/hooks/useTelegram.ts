import { getTelegramWebApp, type TelegramUser, type TelegramWebApp } from '../lib/telegram';

interface UseTelegramResult {
  tg: TelegramWebApp;
  user: TelegramUser | undefined;
  initData: string;
  queryId: string | undefined;
  hapticFeedback: () => void;
  closeApp: () => void;
  expandApp: () => void;
}

export function useTelegram(): UseTelegramResult {
  const tg = getTelegramWebApp();

  return {
    tg,
    user: tg.initDataUnsafe?.user,
    initData: tg.initData,
    queryId: tg.initDataUnsafe?.query_id,
    hapticFeedback: () => tg.HapticFeedback?.impactOccurred('light'),
    closeApp: () => tg.close(),
    expandApp: () => tg.expand(),
  };
}