export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

interface TelegramInitDataUnsafe {
  user?: TelegramUser;
  query_id?: string;
}

interface TelegramHapticFeedback {
  impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void;
  notificationOccurred(type: 'error' | 'success' | 'warning'): void;
}

export interface TelegramWebApp {
  initData: string;
  initDataUnsafe?: TelegramInitDataUnsafe;
  HapticFeedback?: TelegramHapticFeedback;
  ready(): void;
  expand(): void;
  close(): void;
  showAlert(message: string): void;
  showConfirm(message: string, callback: (confirmed: boolean) => void): void;
}

const telegramFallback: TelegramWebApp = {
  initData: '',
  initDataUnsafe: undefined,
  HapticFeedback: undefined,
  ready: () => undefined,
  expand: () => undefined,
  close: () => undefined,
  showAlert: (message: string) => {
    window.alert(message);
  },
  showConfirm: (message: string, callback: (confirmed: boolean) => void) => {
    callback(window.confirm(message));
  },
};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

function readTelegramWebApp(): TelegramWebApp | undefined {
  return window.Telegram?.WebApp;
}

function readParamFromPart(part: string, key: string): string {
  const normalized = part.startsWith('#') ? part.slice(1) : part.startsWith('?') ? part.slice(1) : part;
  const params = new URLSearchParams(normalized);
  return params.get(key) ?? '';
}

function readInitDataFromLocation(): string {
  const fromHash = readParamFromPart(window.location.hash, 'tgWebAppData');
  if (fromHash) return fromHash;

  const fromSearch = readParamFromPart(window.location.search, 'tgWebAppData');
  if (fromSearch) return fromSearch;

  return '';
}

let warnedMissingInitData = false;

export function getTelegramWebApp(): TelegramWebApp {
  return readTelegramWebApp() ?? telegramFallback;
}

export function getTelegramInitData(): string {
  const webAppInitData = readTelegramWebApp()?.initData ?? '';
  if (webAppInitData) return webAppInitData;

  const locationInitData = readInitDataFromLocation();
  if (locationInitData) return locationInitData;

  if (!warnedMissingInitData && import.meta.env.DEV) {
    warnedMissingInitData = true;
    console.warn('Telegram initData is missing. API requests will be unauthorized.');
  }

  return '';
}
