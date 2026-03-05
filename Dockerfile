FROM python:3.14-slim

# Устанавливаем системные зависимости (нужны для сборки некоторых python-пакетов и asyncpg)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Настраиваем рабочую директорию
WORKDIR /app
ENV UV_PROJECT_ENVIRONMENT=/usr/local

# Устанавливаем uv и зависимости проекта из lock-файла
RUN pip install --no-cache-dir uv
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen

# Копируем весь код проекта
COPY . .

# Создаём директорию для загрузок и non-root пользователя
RUN useradd --create-home --shell /bin/bash appuser \
    && mkdir -p /app/uploads \
    && chown -R appuser:appuser /app
USER appuser

# Команда по умолчанию (будет переопределена в docker-compose.yml)
CMD ["uv", "run", "python", "main_api.py"]
