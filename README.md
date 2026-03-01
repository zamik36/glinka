Вот подробный и профессиональный `README.md` для твоего проекта. Он написан так, чтобы любой разработчик (или ты сам спустя полгода) мог сразу понять архитектуру, запустить проект и начать писать код.

---

# 📚 Homework Tracker – Telegram Mini App

**Homework Tracker** — это высоконагруженный сервис (Telegram Web App) для отслеживания домашних заданий, заметок и дедлайнов. Приложение позволяет пользователям управлять своими задачами через удобный мобильный интерфейс внутри Telegram, а бэкенд автоматически рассылает push-уведомления (напоминания) через Telegram-бота.

## 🚀 Технологический стек

**Frontend:**
* React + TypeScript
* Tailwind CSS (адаптация под системную тему Telegram)
* `@twa-dev/sdk` (Telegram Web App SDK)

**Backend:**
* Python 3.14+
* **FastAPI** (REST API) + **Granian** (Высокопроизводительный ASGI сервер, написанный на Rust)
* **Aiogram 3.x** (Telegram Bot & Worker)
* **PostgreSQL + Asyncpg** (Асинхронная работа с БД)
* **SQLAlchemy 2.0 + Alembic** (ORM и миграции)

**Инфраструктура:**
* Docker & Docker Compose
* **Caddy** (Reverse Proxy, автоматический HTTPS / SSL сертификаты)

---

## 🏗 Архитектура и HighLoad решения

Проект построен с использованием **Clean Architecture (Чистой архитектуры)**, элементов **DDD (Domain-Driven Design)** и принципов **SOLID**.

1. **Безопасность (HMAC-SHA256):** Фронтенд не имеет прямой связи с БД. Все запросы к API подписываются строкой `initData` от Telegram. Бэкенд криптографически проверяет эту подпись с помощью токена бота, исключая возможность подделки `user_id`.
2. **Параллельные Воркеры (SKIP LOCKED):** Рассылка уведомлений вынесена в отдельный Docker-контейнер (Worker). Для предотвращения двойной отправки уведомлений при масштабировании (запуске нескольких воркеров) используется механизм БД PostgreSQL `FOR UPDATE SKIP LOCKED`.
3. **Единый домен (Caddy):** Роутинг реализован на уровне веб-сервера. Запросы на `/api/*` проксируются в Python (Granian), а остальные запросы отдают статику React-приложения.

---

## 📂 Структура проекта

```text
.
├── frontend/                 # React SPA (пользовательский интерфейс)
├── app/                      # Backend логика
│   ├── application/          # Бизнес-логика (Services, Use Cases)
│   ├── core/                 # Настройки, валидация Telegram
│   ├── domain/               # Сущности (Entities) и интерфейсы репозиториев
│   ├── infrastructure/       # Модели SQLAlchemy, имплементация репозиториев
│   ├── presentation/         # FastAPI роутеры (API) и зависимости (DI)
│   └── worker/               # Фоновый процесс рассылки уведомлений (Aiogram)
├── alembic/                  # Миграции базы данных
├── main_api.py               # Точка входа для запуска API (Granian)
├── Caddyfile                 # Конфигурация Reverse Proxy
├── docker-compose.yml        # Инфраструктура проекта
└── README.md
```

---

## 🛠 Ключевые методы и логика

### 1. Валидация сессии (Security)
**Файл:** `app/core/security.py` -> `validate_telegram_data()`
Главный метод защиты API. Берет строку `initData`, переданную фронтендом в Header'ах, сортирует параметры по алфавиту и хеширует их с помощью секретного ключа (Bot Token). Если хеш совпадает — запрос пропускается, а из данных извлекается `tg_id` пользователя.

### 2. Бизнес-логика создания задач
**Файл:** `app/application/task_services.py` -> `create_task_with_reminder()`
Сервисный слой. Принимает запрос от пользователя, создает запись в таблице `Tasks`, и **автоматически вычисляет время напоминания** (например, за 2 часа до дедлайна), создавая связанную запись в таблице `Reminders`.

### 3. HighLoad выборка задач для уведомлений
**Файл:** `app/infrastructure/repositories.py` -> `get_pending_and_lock()`
Критически важный метод для воркера. Делает SQL-запрос в PostgreSQL, используя:
* `.with_for_update(skip_locked=True, of=ReminderModel)`
Берет пачку невыполненных задач, дедлайн которых уже наступил, и **блокирует эти строки**. Если параллельно работает 5 воркеров, они никогда не возьмут одну и ту же задачу, что исключает спам пользователю.

### 4. Фоновый Worker
**Файл:** `app/worker/main.py` -> `worker_loop()`
Асинхронный бесконечный цикл. Раз в N секунд обращается к репозиторию, забирает пачку заблокированных `Reminders`, рассылает сообщения пользователям через экземпляр `Bot(token)` и помечает записи как `is_sent = True`, после чего коммитит транзакцию БД (снимая блокировку).

---

## 🔌 API Endpoints (REST)

Все запросы к API должны содержать заголовок `initData` с данными сессии Telegram.

* `GET /api/tasks` — Получить список задач текущего пользователя (отсортированы по дедлайну).
* `POST /api/tasks` — Создать новую задачу.
  * **Body:** `{"text": "Сделать эссе", "deadline": "2024-05-20T10:00:00Z"}` (ISO 8601 UTC).

---

## 🚀 Руководство по развертыванию (Production)

### Предварительные требования
1. VPS сервер (Ubuntu/Debian) с установленным Docker и Docker Compose.
2. Привязанный домен (например, `app.my-bot.com`), A-запись которого указывает на IP сервера.
3. Telegram Бот (созданный через [@BotFather](https://t.me/BotFather)), от которого получен `BOT_TOKEN`.

### Шаг 1: Настройка окружения
Склонируйте репозиторий и создайте файл `.env` в корне проекта:
```env
BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrSTUvwxYZ
DEBUG=False
```
В файле `Caddyfile` замените `my-cool-bot.com` на ваш реальный домен.

### Шаг 2: Инициализация базы данных
Запустите только контейнер с базой данных:
```bash
docker-compose up -d db
```
Подождите 5 секунд. Затем создайте и примените первую миграцию через Alembic:
```bash
docker-compose run --rm api alembic revision --autogenerate -m "Init tables"
docker-compose run --rm api alembic upgrade head
```

### Шаг 3: Запуск проекта
Запустите все сервисы в фоновом режиме:
```bash
docker-compose up -d --build
```
*Caddy автоматически запросит и установит SSL-сертификаты от Let's Encrypt для вашего домена.*

### Шаг 4: Настройка Telegram
1. Перейдите в [@BotFather](https://t.me/BotFather).
2. Выберите вашего бота -> `Bot Settings` -> `Menu Button` -> `Configure menu button`.
3. Отправьте ссылку на ваш домен: `https://app.my-bot.com` (обязательно HTTPS).
4. Готово! Запускайте бота командой `/start` и открывайте Mini App.

---

## 💻 Локальная разработка

### Вариант 1: запуск без Docker (рекомендуется для разработки)
1. Убедитесь, что установлен Python `3.14` и `uv`.
2. Создайте `.env` в корне:
```env
BOT_TOKEN=ваш_токен_бота
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/homework_db
DEBUG=True
```
3. Установите зависимости backend:
```bash
uv sync
```
4. Запустите API:
```bash
uv run python main_api.py
```
5. В отдельном терминале запустите worker:
```bash
uv run python app/worker/main.py
```
6. В отдельном терминале запустите frontend:
```bash
cd frontend
npm ci
npm run dev
```

### Вариант 2: запуск через Docker Compose
1. Заполните `.env` (`BOT_TOKEN` обязателен).
2. Для локального стенда замените домен в `Caddyfile` на `localhost`.
3. Запустите контейнеры:
```bash
docker-compose up -d --build
```
4. Для миграций:
```bash
docker-compose run --rm api alembic revision --autogenerate -m "Init tables"
docker-compose run --rm api alembic upgrade head
```

**Полезные команды:**
* Просмотр логов воркера: `docker-compose logs -f worker`
* Перезапуск только API при изменении кода: `docker-compose restart api`
* Создание новой миграции БД: `docker-compose run --rm api alembic revision --autogenerate -m "Name"`