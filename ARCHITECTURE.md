# Архитектура Glinka

## Общая схема

Проект построен по принципам **Clean Architecture** с чётким разделением на четыре слоя. Зависимости направлены строго внутрь: внешние слои зависят от внутренних, но не наоборот.

```
┌─────────────────────────────────────────────┐
│              Presentation                    │
│    FastAPI-маршруты, DI, middleware          │
├─────────────────────────────────────────────┤
│              Application                     │
│    TaskService, бизнес-логика, кэш          │
├─────────────────────────────────────────────┤
│              Infrastructure                  │
│    SQLAlchemy, репозитории, файлы            │
├─────────────────────────────────────────────┤
│              Domain                          │
│    Сущности, интерфейсы, исключения         │
└─────────────────────────────────────────────┘

         ┌──────────────┐
         │    Worker     │
         │  Уведомления  │
         └──────────────┘
```

Весь стек полностью асинхронный: FastAPI + SQLAlchemy async + asyncpg + aiogram.

---

## Domain (`app/domain/`)

Чистый слой без внешних зависимостей. Определяет бизнес-сущности и контракты.

**Сущности** (`entities.py`):
- `User` — tg_id, username, timezone
- `Task` — текст (до 2000 символов), дедлайн, статус выполнения
- `Reminder` — время напоминания, статус (pending/sent)
- `Attachment` — имя файла, MIME-тип, размер (до 10 МБ)

**Интерфейсы** (`interfaces.py`):
- `TaskRepository` — CRUD для задач, `get_by_id(for_update=True)` для блокировки строки
- `ReminderRepository` — создание, блокировка pending-напоминаний (`FOR UPDATE SKIP LOCKED`), отметка отправки
- `AttachmentRepository` — CRUD для вложений

**Исключения** (`exceptions.py`):
- `TaskNotFoundError`, `ForbiddenError`

---

## Application (`app/application/`)

Оркестрирует бизнес-логику через интерфейсы репозиториев.

**TaskService** (`task_services.py`):
- `create_task_with_reminder()` — создаёт задачу + автоматически генерирует напоминания (за 2 дня и за 1 день до дедлайна, в 15:00 UTC). Поддерживает кастомные `remind_at`.
- `update_task()` — обновляет текст/дедлайн, пересоздаёт напоминания
- `delete_task()` — удаляет задачу, связанные напоминания и файлы с диска
- `get_user_tasks()` — возвращает задачи с пагинацией (limit/offset)
- `toggle_complete()` — переключение статуса выполнения

**Кэширование**: TTL-кэш (30 сек) для списка задач пользователя. Инвалидируется при любой мутации (создание, обновление, удаление, toggle).

**Атомарность**: все мутирующие операции используют `SELECT ... FOR UPDATE` для предотвращения race conditions.

---

## Infrastructure (`app/infrastructure/`)

Реализация работы с данными и внешними системами.

**База данных** (`database.py`):
- AsyncEngine с пулом соединений: `pool_size=20`, `max_overflow=10`, `pool_recycle=3600`
- `pool_pre_ping=True` — проверка соединения перед использованием

**ORM-модели** (`models.py`):
- `TaskModel` — индекс на `user_id`, каскадные связи с reminders и attachments
- `ReminderModel` — составной индекс `(status, remind_at)` для быстрой выборки воркером
- `AttachmentModel` — FK-индекс на `task_id`
- PostgreSQL-триггер `trg_reminder_insert` — при INSERT в reminders вызывает `pg_notify('reminder_new', ...)`

**Репозитории** (`repositories.py`):
- `selectinload` для предотвращения N+1 запросов
- `FOR UPDATE SKIP LOCKED` в `get_pending_and_lock()` — заблокированные другим воркером строки пропускаются

**Файловое хранилище** (`file_storage.py`):
- Whitelist расширений: `.jpg`, `.png`, `.pdf`, `.docx`, `.xlsx`, `.zip` и др.
- Whitelist MIME-типов
- Защита от path traversal через нормализацию пути
- UUID-имена файлов для предотвращения коллизий
- Асинхронная запись и удаление

---

## Presentation (`app/presentation/`)

HTTP API и инъекция зависимостей.

**Маршруты** (`api.py`):

| Метод | Путь | Rate limit | Описание |
|-------|------|-----------|----------|
| GET | `/api/tasks` | 60/мин | Список задач (limit, offset) |
| POST | `/api/tasks` | 20/мин | Создание задачи с файлами |
| PUT | `/api/tasks/{id}` | 20/мин | Обновление задачи |
| DELETE | `/api/tasks/{id}` | 20/мин | Удаление задачи |
| PATCH | `/api/tasks/{id}/complete` | 30/мин | Переключение статуса |

Все эндпоинты требуют заголовок `initData` — подписанный контекст Telegram Mini App.

**DI** (`dependencies.py`):
- `get_current_user()` — валидирует HMAC-SHA256 подпись Telegram, извлекает `user_id`
- `get_task_service()` — собирает TaskService с конкретными реализациями репозиториев

**Rate limiting**: `slowapi` на базе реального IP (с учётом `X-Forwarded-For` от Caddy).

---

## Core (`app/core/`)

**Конфигурация** (`config.py`):
Pydantic Settings, все параметры через переменные окружения:
- `BOT_TOKEN` — токен Telegram-бота
- `DATABASE_URL` — строка подключения PostgreSQL
- `ALLOWED_ORIGIN` — разрешённый CORS-origin (по умолчанию пустой)
- `INIT_DATA_TTL` — максимальный возраст подписи Telegram (300 сек)
- `WORKER_CONCURRENCY` — лимит параллельных отправок в воркере (10)
- `TASK_CACHE_TTL_SECONDS` — TTL кэша задач (30 сек)

**Аутентификация** (`security.py`):
- Парсинг URL-encoded `initData` из заголовка
- HMAC-SHA256 верификация (ключ выводится из `BOT_TOKEN` через `WebAppData`)
- Проверка свежести `auth_date`
- HTTP 401 при невалидной подписи

**Логирование** (`logging_config.py`):
- JSON-формат (pythonjsonlogger) — удобно для Loki
- Поля: timestamp, level, logger, message
- Вывод только в stdout (12-factor app)

---

## Worker (`app/worker/`)

Фоновый сервис отправки напоминаний через Telegram Bot API.

### Три параллельных цикла

**1. Process loop** — обработка и отправка:
- Получает ID напоминаний от scheduler
- Semaphore ограничивает параллелизм (`WORKER_CONCURRENCY`)
- Загружает напоминание + задачу + вложения из БД (с блокировкой `FOR UPDATE SKIP LOCKED`)
- Отправляет через aiogram (фото, документы, медиа-группы)
- Помечает как `sent` в БД
- При ошибке — повтор через 60 секунд

**2. Listen loop** — подписка на новые напоминания:
- Raw asyncpg-соединение (не через ORM)
- `LISTEN reminder_new` — канал PostgreSQL
- При INSERT в таблицу reminders триггер отправляет NOTIFY с `{id, remind_at}`
- Добавляет в scheduler мгновенно — zero-latency обнаружение
- Автореконнект с backoff при обрыве

**3. Fallback sync loop** — страховка:
- Периодический опрос БД (по умолчанию каждые 60 сек)
- Загружает pending-напоминания в горизонте 24 часа
- Гарантирует, что ни одно напоминание не потеряется, даже если LISTEN-соединение упадёт

### Scheduler (`scheduler.py`)

Min-heap (приоритетная очередь) в памяти:
- `_heap` — кортежи `(remind_at, reminder_id)`, ближайшее наверху
- `_known_ids` — множество для дедупликации
- `_wake_event` — мгновенное пробуждение при NOTIFY
- `wait_for_next()` — спит до момента ближайшего напоминания, возвращает batch ID
- `retry_one()` — перепланирование с задержкой при ошибке

### Обработка вложений

При отправке напоминания воркер проверяет вложения задачи:
- Одно изображение → `sendPhoto`
- Один документ → `sendDocument`
- Несколько файлов → `sendMediaGroup`
- Отсутствие файла на диске обрабатывается gracefully

### Метрики (`metrics.py`)

Prometheus-счётчики и гистограммы:
- `reminders_sent_total` — успешные отправки
- `reminders_failed_total[reason]` — ошибки по типам
- `reminder_latency_seconds` — задержка от `remind_at` до фактической отправки

---

## База данных

### Таблицы

```
tasks
├── id (PK)
├── user_id (BigInteger, indexed)
├── text (String 2000)
├── deadline (DateTime TZ)
├── is_completed (Boolean)
└── created_at (DateTime TZ, server_default=now())

reminders
├── id (PK)
├── task_id (FK → tasks.id, CASCADE, indexed)
├── remind_at (DateTime TZ)
└── status (String 20: 'pending' | 'sent')
    └── composite index: (status, remind_at)

attachments
├── id (PK)
├── task_id (FK → tasks.id, CASCADE, indexed)
├── filename (String 500)
├── stored_path (String 500)
├── mime_type (String 200)
└── size (Integer)
```

### Миграции (Alembic)

1. `bbe85adaaa86` — начальные таблицы (tasks, reminders)
2. `a1b2c3d4e5f6` — таблица attachments
3. `c3d4e5f6g7h8` — триггер LISTEN/NOTIFY для reminders
4. `d4e5f6g7h8i9` — поле `created_at` в tasks
5. `e5f6g7h8i9j0` — составные и FK-индексы
6. `f6g7h8i9j0k1` — миграция `is_sent` boolean → `status` enum

Все даты хранятся в UTC с timezone-aware типами.

---

## Безопасность

- **Аутентификация** — HMAC-SHA256 подпись Telegram initData на каждом запросе
- **Авторизация** — проверка `user_id` владельца задачи при любой мутации
- **CORS** — явный origin, без wildcard по умолчанию
- **Файлы** — whitelist расширений и MIME-типов, защита от path traversal
- **Rate limiting** — per-IP лимиты на каждый эндпоинт
- **Security headers** — HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, CSP
- **Секреты** — `.env` вне репозитория, `:?` в docker-compose для fail-fast при отсутствии переменных
- **Аудит** — `pip-audit` в CI на каждый коммит

---

## Мониторинг

```
┌──────────┐     ┌────────────┐     ┌─────────┐
│ Promtail │────→│    Loki    │────→│         │
│ (логи)   │     │ (хранение) │     │ Grafana │
└──────────┘     └────────────┘     │         │
                                    │         │
┌──────────┐     ┌────────────┐     │         │
│   API    │────→│ Prometheus │────→│         │
│  Worker  │     │ (метрики)  │     │         │
└──────────┘     └────────────┘     └─────────┘
```

- **Prometheus** — скрейпит `/metrics` с API (порт 8000) и Worker (порт 9091), ретеншн 30 дней
- **Loki** — агрегация логов контейнеров через Promtail
- **Grafana** — предустановленные дашборды и datasources, доступна по `/grafana`
- **Логи** — JSON-формат (timestamp, level, logger, message) → stdout → Promtail → Loki

---

## Деплой

```
Push в main/dev → GitHub Actions → SSH на VPS:
  1. git pull
  2. docker compose build
  3. docker compose run --rm migrate
  4. docker compose up -d
  5. curl health check
```

Staging-окружение разворачивается при push в `dev` с отдельным `docker-compose.stage.yml`.

Caddy автоматически получает TLS-сертификаты через Let's Encrypt и проксирует:
- `/api/*` → контейнер api
- `/*` → контейнер frontend
- `/grafana/*` → контейнер grafana
