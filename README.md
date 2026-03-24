# Glinka — трекер домашних заданий

Telegram Mini App для студентов: создавай задачи с дедлайнами, прикрепляй файлы и получай напоминания прямо в Telegram.

## Возможности

- **Задачи с дедлайнами** — создание, редактирование, отметка выполнения
- **Напоминания** — автоматические (за 2 дня и за 1 день) или пользовательские, приходят в Telegram
- **Файлы** — до 5 вложений на задачу (фото, PDF, документы, архивы)
- **Календарь** — визуализация дедлайнов по дням с цветовой индикацией
- **Мгновенная доставка** — PostgreSQL LISTEN/NOTIFY для push-уведомлений с минимальной задержкой
- **Мониторинг** — Prometheus + Grafana + Loki из коробки

## Стек технологий

| Слой | Технологии |
|------|-----------|
| Backend | Python 3.14, FastAPI, SQLAlchemy 2.0, asyncpg, aiogram |
| Frontend | React 19, TypeScript 5.9, Vite 8, Tailwind CSS 4, Framer Motion |
| БД | PostgreSQL 16, Alembic (миграции) |
| Сервер | Granian (ASGI), Caddy (reverse proxy + TLS) |
| Мониторинг | Prometheus, Grafana, Loki, Promtail |
| CI/CD | GitHub Actions, Docker Compose |
| Пакетные менеджеры | uv (backend), npm (frontend) |

## Быстрый старт

### Docker (рекомендуется)

```bash
# 1. Клонировать репозиторий
git clone https://github.com/your-username/glinka.git
cd glinka

# 2. Настроить переменные окружения
cp .env.example .env
# Заполнить .env: BOT_TOKEN, POSTGRES_USER, POSTGRES_PASSWORD и т.д.

# 3. Создать внешнюю сеть (если ещё нет)
docker network create web

# 4. Собрать и запустить
docker compose build
docker compose run --rm migrate
docker compose up -d
```

Приложение будет доступно на портах 80/443 через Caddy.

### Локальная разработка (без Docker)

Потребуется: Python >= 3.13, Node.js >= 20, PostgreSQL 16.

```bash
# Backend
uv sync --group dev
cp .env.example .env  # заполнить переменные
uv run alembic upgrade head
uv run python main_api.py

# Frontend (в отдельном терминале)
cd frontend
npm install
npm run dev
```

Backend запустится на `http://localhost:8000`, frontend — на `http://localhost:5173`.

## Разработка

### Backend

```bash
uv sync --group dev              # установить зависимости
uv run python main_api.py        # запустить API-сервер
uv run python -m app.worker.main # запустить воркер уведомлений
uv run ty check app/             # проверка типов
```

### Frontend

```bash
cd frontend
npm install       # установить зависимости
npm run dev       # dev-сервер с HMR
npm run build     # production-сборка
npm run lint      # линтинг
```

### Миграции БД

```bash
uv run alembic upgrade head          # применить все миграции
uv run alembic revision --autogenerate -m "описание"  # создать миграцию
```

## Тестирование

```bash
uv run pytest -v --cov=app                  # все тесты с покрытием
uv run pytest tests/test_api.py             # тесты API
uv run pytest tests/test_task_service.py    # тесты бизнес-логики
uv run pytest -k "test_name"               # конкретный тест
```

Тесты используют in-memory SQLite через `aiosqlite` — PostgreSQL для запуска не нужен.

## CI/CD

GitHub Actions запускается на push в `main`/`dev` и на pull request:

1. **Аудит зависимостей** — `pip-audit` на известные уязвимости
2. **Проверка типов** — `ty check app/`
3. **Миграции** — `alembic upgrade head` на тестовой БД
4. **Тесты** — `pytest` с отчётом о покрытии

При push в `main` — автодеплой на VPS (build → migrate → up).
При push в `dev` — деплой на staging-окружение.

## Структура проекта

```
glinka/
├── app/
│   ├── domain/           # Сущности и интерфейсы (без внешних зависимостей)
│   ├── application/      # Бизнес-логика (TaskService)
│   ├── infrastructure/   # БД, репозитории, файловое хранилище
│   ├── presentation/     # FastAPI-маршруты, DI, middleware
│   ├── core/             # Конфигурация, безопасность, утилиты
│   └── worker/           # Воркер уведомлений + scheduler
├── alembic/              # Миграции БД
├── tests/                # Тесты (pytest + asyncio)
├── frontend/             # React-приложение
├── monitoring/           # Конфиги Prometheus, Grafana, Loki
├── docker-compose.yml    # Продакшен-конфигурация (9 сервисов)
├── Dockerfile            # Multi-stage сборка backend
├── Caddyfile             # Reverse proxy + TLS
└── main_api.py           # Точка входа
```

Подробнее об архитектуре — в [ARCHITECTURE.md](ARCHITECTURE.md).
Планы развития — в [ROADMAP.md](ROADMAP.md).
