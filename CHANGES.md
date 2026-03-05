# Отчёт по аудиту и исправлениям проекта Glinka

## Контекст

Проведён полный аудит проекта Glinka (Telegram Mini App для отслеживания домашних заданий). По результатам code review внесены исправления по безопасности, производительности, качеству кода, инфраструктуре и тестам.

---

## 1. Критические исправления безопасности (P0)

### 1.1 Создан `.env.example` с плейсхолдерами

**Файл:** `.env.example` (новый)

**Проблема:** Реальный Telegram BOT_TOKEN и другие секреты могли попасть в репозиторий через `.env`. Разработчики без документации не знали, какие переменные окружения нужны.

**Решение:** Создан файл-шаблон `.env.example` со всеми необходимыми переменными и безопасными плейсхолдерами:

```
BOT_TOKEN=your-telegram-bot-token
DEBUG=False
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/homework_db
ALLOWED_ORIGIN=https://your-domain.com
POSTGRES_USER=your_db_user
POSTGRES_PASSWORD=your_strong_password
```

Файл `.env` уже был в `.gitignore`, поэтому новые разработчики копируют `.env.example` → `.env` и заполняют реальными значениями.

---

### 1.2 Убраны слабые дефолтные креды PostgreSQL

**Файл:** `docker-compose.yml`

**Проблема:** Переменные `POSTGRES_USER` и `POSTGRES_PASSWORD` имели фолбэк на слабые значения `user` и `pass` через синтаксис `${VAR:-default}`. Если `.env` не настроен, контейнер запускался с предсказуемыми учётными данными.

**Было:**
```yaml
POSTGRES_USER: ${POSTGRES_USER:-user}
POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-pass}
```

**Стало:**
```yaml
POSTGRES_USER: ${POSTGRES_USER:?Set POSTGRES_USER in .env}
POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD in .env}
```

Оператор `:?` вызывает ошибку при запуске, если переменная не задана — fail-fast вместо тихой работы со слабыми паролями. Аналогично обновлены все строки `DATABASE_URL` в секциях `migrate`, `api` и `worker`.

---

### 1.3 Валидация MIME-типов при загрузке файлов

**Файл:** `app/infrastructure/file_storage.py`

**Проблема:** Принимался любой тип файла — `.exe`, `.sh`, `.html`, `.php`. Злоумышленник мог загрузить исполняемый файл или HTML со встроенным JavaScript.

**Решение:** Добавлен whitelist допустимых расширений и MIME-типов:

```python
ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp',
                      '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
                      '.txt', '.zip', '.rar', '.7z'}

ALLOWED_MIMES = {
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp',
    'application/pdf',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    # ... и другие офисные/архивные форматы
}
```

Метод `_validate_file_type()` проверяет и расширение, и MIME-тип. Вызывается в начале `save()` до записи файла на диск. При несоответствии — HTTP 400 с информативным сообщением.

---

### 1.4 CORS — убран wildcard по умолчанию

**Файл:** `app/core/config.py`

**Проблема:** `ALLOWED_ORIGIN: str = "*"` — дефолтное значение разрешало кросс-доменные запросы с любого сайта. Это открывало возможность CSRF-атак.

**Было:**
```python
ALLOWED_ORIGIN: str = "*"
```

**Стало:**
```python
ALLOWED_ORIGIN: str = ""
```

Теперь CORS origin нужно явно задать в `.env`. В `docker-compose.yml` уже есть фолбэк `ALLOWED_ORIGIN:-https://glinka-ht.ru` для продакшен-домена.

---

## 2. Исправления безопасности высокого приоритета (P1)

### 2.1 Защита от path traversal

**Файл:** `app/infrastructure/file_storage.py`

**Проблема:** Метод `get_full_path()` использовал `os.path.join(self.storage_dir, stored_path)` без нормализации. Путь вида `../../etc/passwd` позволял выйти за пределы хранилища.

**Решение:** Добавлен приватный метод `_safe_path()`:

```python
def _safe_path(self, stored_path: str) -> str:
    full = os.path.normpath(os.path.join(self.storage_dir, stored_path))
    if not full.startswith(self.storage_dir + os.sep) and full != self.storage_dir:
        raise ValueError("Invalid file path")
    return full
```

Все методы класса (`save`, `get_full_path`, `delete`) теперь используют `_safe_path()`. В методе `delete` попытка path traversal ловится и логируется без выброса исключения наружу.

---

### 2.2 HSTS и security-заголовки

**Файлы:** `Caddyfile`, `main_api.py`

**Проблема:**
- Отсутствовал заголовок `Strict-Transport-Security` — браузер мог загрузить страницу по HTTP
- Отсутствовали `X-Frame-Options` и другие security-заголовки на API-ответах

**Решение в Caddyfile:**
```
Strict-Transport-Security "max-age=31536000; includeSubDomains"
X-Frame-Options "SAMEORIGIN"
```

**Решение в main_api.py** — добавлен `SecurityHeadersMiddleware`:
```python
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response
```

Двойная защита: Caddy ставит заголовки на всех маршрутах, middleware — дополнительно на API, даже при прямом доступе.

---

### 2.3 Сужение CSP

**Файл:** `Caddyfile`

**Проблема:** `Content-Security-Policy` содержал `https://*.telegram.org` — слишком широкий паттерн.

**Было:**
```
Content-Security-Policy "frame-ancestors 'self' https://web.telegram.org https://*.telegram.org"
```

**Стало:**
```
Content-Security-Policy "frame-ancestors 'self' https://web.telegram.org"
```

---

## 3. Оптимизация производительности (P1–P2)

### 3.1 Составной индекс на reminders

**Файлы:** `app/infrastructure/models.py`, `alembic/versions/e5f6g7h8i9j0_add_composite_and_fk_indexes.py` (новый)

**Проблема:** Worker-запрос `get_pending_and_lock()` фильтрует по `is_sent=False AND remind_at <= now()`. Два отдельных индекса неэффективны — PostgreSQL выбирает один из них, а по второму условию делает фильтрацию.

**Решение:** Добавлен составной индекс:

```python
class ReminderModel(Base):
    __table_args__ = (Index('ix_reminders_pending', 'is_sent', 'remind_at'),)
```

Создана Alembic-миграция `e5f6g7h8i9j0`, которая создаёт этот индекс.

---

### 3.2 Индексы на FK-колонках

**Файлы:** `app/infrastructure/models.py`, миграция `e5f6g7h8i9j0`

**Проблема:** `ReminderModel.task_id` и `AttachmentModel.task_id` не имели индексов. При CASCADE DELETE задачи PostgreSQL выполнял sequential scan по таблицам reminders и attachments.

**Решение:** Добавлено `index=True` на обе колонки:

```python
task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"), index=True)
```

Миграция создаёт индексы `ix_reminders_task_id` и `ix_attachments_task_id`.

---

### 3.3 Пагинация GET /tasks

**Файлы:** `app/presentation/api.py`, `app/application/task_services.py`, `app/infrastructure/repositories.py`, `app/domain/interfaces.py`

**Проблема:** Эндпоинт `GET /api/tasks` возвращал ВСЕ задачи пользователя без ограничения. Пользователь с 10 000 задач мог вызвать OOM или таймаут.

**Решение:** Добавлены параметры `limit` и `offset` по всей цепочке:

```python
# api.py
@router.get("", response_model=list[TaskResponse])
async def get_tasks(
    ...
    limit: int = 50,
    offset: int = 0,
):
    if limit < 1 or limit > 200:
        raise HTTPException(status_code=400, detail="limit must be between 1 and 200")
    if offset < 0:
        raise HTTPException(status_code=400, detail="offset must be non-negative")
    return await service.get_user_tasks(user_id, limit=limit, offset=offset)
```

Изменения пробрасываются через `TaskService` → `TaskRepository` → SQL-запрос с `.limit(limit).offset(offset)`.

Дефолт: 50 задач, максимум: 200.

---

### 3.4 pool_pre_ping и pool_recycle

**Файл:** `app/infrastructure/database.py`

**Проблема:** Отсутствовала валидация соединений перед использованием и рециклинг. При перезапуске БД или разрыве сети пул мог содержать «мёртвые» соединения, вызывающие ошибки `InterfaceError`.

**Решение:**
```python
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    pool_size=20,
    max_overflow=10,
    pool_pre_ping=True,    # проверяет соединение перед использованием
    pool_recycle=3600,      # пересоздаёт соединения старше 1 часа
)
```

---

### 3.5 Исправлен блокирующий I/O в worker

**Файл:** `app/worker/main.py`

**Проблема:** `os.path.exists()` — синхронный системный вызов, который блокирует event loop в async-контексте.

**Было:**
```python
if os.path.exists(full_path):
```

**Стало:**
```python
if await asyncio.to_thread(os.path.exists, full_path):
```

---

## 4. Исправления логики и целостности данных (P2)

### 4.1 Устранение race condition в update/delete/toggle

**Файлы:** `app/application/task_services.py`, `app/infrastructure/repositories.py`, `app/domain/interfaces.py`

**Проблема:** Паттерн Check-Then-Act — `get_by_id()` + `update()` не атомарен. Задача могла быть удалена другим запросом между проверкой существования и обновлением.

**Решение:** Добавлен параметр `for_update` в `get_by_id()`:

```python
# interfaces.py
async def get_by_id(self, task_id: int, for_update: bool = False) -> dict[str, Any] | None: ...

# repositories.py
if for_update:
    stmt = stmt.with_for_update()
```

Все мутирующие операции (`update_task`, `delete_task`, `toggle_complete`) теперь вызывают:
```python
task = await self.task_repo.get_by_id(task_id, for_update=True)
```

`SELECT ... FOR UPDATE` блокирует строку до конца транзакции, предотвращая гонки.

---

### 4.2 Устранение дублирования логики напоминаний

**Файл:** `app/application/task_services.py`

**Проблема:** Расчёт `remind_times` дублировался в `create_task_with_reminder()` и `update_task()` — 12 одинаковых строк кода.

**Решение:** Вынесено в функцию `_calculate_remind_times()`:

```python
REMIND_DAYS_BEFORE = [2, 1]
REMIND_HOUR = 15

def _calculate_remind_times(deadline: datetime) -> list[datetime]:
    now = datetime.now(timezone.utc)
    remind_times = []
    for days_before in REMIND_DAYS_BEFORE:
        remind_date = deadline - timedelta(days=days_before)
        remind_dt = remind_date.replace(hour=REMIND_HOUR, minute=0, second=0, microsecond=0)
        if remind_dt.tzinfo is None:
            remind_dt = remind_dt.replace(tzinfo=timezone.utc)
        if remind_dt > now:
            remind_times.append(remind_dt)
    if not remind_times:
        remind_times.append(now + timedelta(minutes=5))
    return remind_times
```

Константы `REMIND_DAYS_BEFORE` и `REMIND_HOUR` вынесены на уровень модуля для удобства будущей настройки.

---

### 4.3 Валидация в доменных сущностях

**Файл:** `app/domain/entities.py`

**Проблема:** Сущность `Attachment` не имела ограничений на поля — можно было создать вложение с пустым именем, отрицательным размером или MIME-типом длиной 10 000 символов.

**Решение:** Добавлены Pydantic-валидаторы:

```python
class Task(BaseModel):
    text: str = Field(min_length=1, max_length=2000)

class Attachment(BaseModel):
    filename: str = Field(min_length=1, max_length=500)
    stored_path: str = Field(min_length=1, max_length=500)
    mime_type: str = Field(min_length=1, max_length=200)
    size: int = Field(gt=0, le=10_485_760)  # макс. 10 МБ
```

---

## 5. Исправления фронтенда (P3)

### 5.1 Санитизация console.error

**Файлы:** `frontend/src/pages/TaskList.tsx`, `frontend/src/pages/AddTask.tsx`

**Проблема:** `console.error(error)` выводил полные объекты ошибок в DevTools, включая внутренние детали API (URL, заголовки, тела ответов).

**Было:**
```typescript
console.error(error);
console.error('Delete failed:', error);
console.error('Toggle failed:', error);
console.error('Task save failed:', error);
```

**Стало:**
```typescript
console.error('Failed to load tasks:', error instanceof Error ? error.message : 'Unknown error');
console.error('Delete failed:', error instanceof Error ? error.message : 'Unknown error');
console.error('Toggle failed:', error instanceof Error ? error.message : 'Unknown error');
console.error('Task save failed:', error instanceof Error ? error.message : 'Unknown error');
```

---

### 5.2 Утечка памяти URL.createObjectURL

**Файл:** `frontend/src/pages/AddTask.tsx`

**Проблема:** `URL.createObjectURL(file)` вызывался при каждом рендере для превью изображений, но `URL.revokeObjectURL()` никогда не вызывался. Blob URL оставались в памяти.

**Решение:** Blob URL управляются через `useMemo` + `useEffect` cleanup:

```typescript
const previewUrls = useMemo(
  () => files.filter(isImage).map(f => ({ file: f, url: URL.createObjectURL(f) })),
  [files]
);

useEffect(() => {
  return () => { previewUrls.forEach(p => URL.revokeObjectURL(p.url)); };
}, [previewUrls]);

const getPreviewUrl = (file: File) => previewUrls.find(p => p.file === file)?.url;
```

Теперь URL создаются один раз при изменении списка файлов и освобождаются при размонтировании или обновлении.

---

## 6. Инфраструктура и CI/CD (P3)

### 6.1 Resource limits в Docker

**Файл:** `docker-compose.yml`

**Проблема:** Контейнеры могли потребить все ресурсы хоста при пиковых нагрузках или утечках памяти.

**Решение:** Добавлены лимиты `deploy.resources.limits`:

| Контейнер | CPU | Memory |
|-----------|-----|--------|
| db        | 1.0 | 512M   |
| api       | 1.0 | 512M   |
| worker    | 0.5 | 256M   |
| frontend  | 0.5 | 128M   |
| caddy     | 0.5 | 128M   |

---

### 6.2 Healthcheck для frontend-контейнера

**Файл:** `docker-compose.yml`

**Проблема:** У frontend-контейнера (nginx) не было healthcheck — Docker и Caddy не могли определить, отвечает ли он.

**Решение:**
```yaml
frontend:
  healthcheck:
    test: ["CMD-SHELL", "curl -f http://localhost:80/ || exit 1"]
    interval: 30s
    timeout: 5s
    retries: 3
```

---

### 6.3 Аудит зависимостей в CI

**Файлы:** `.github/workflows/ci.yml`, `pyproject.toml`

**Проблема:** В CI-пайплайне не проверялись зависимости на известные уязвимости.

**Решение:**
- Добавлен `pip-audit>=2.7` в dev-зависимости (`pyproject.toml`)
- Добавлен шаг в CI:
```yaml
- name: Audit dependencies
  run: uv run pip-audit
```

Шаг выполняется перед type check и тестами — уязвимая зависимость блокирует пайплайн.

---

## 7. Новые тесты

**Файл:** `tests/test_file_storage.py` (новый)

Добавлено 12 новых тестов, покрывающих ранее непротестированные сценарии:

### TestFileTypeValidation (7 тестов)
| Тест | Проверяет |
|------|-----------|
| `test_reject_exe_extension` | Блокировка `.exe` файлов |
| `test_reject_sh_extension` | Блокировка `.sh` скриптов |
| `test_reject_html_extension` | Блокировка `.html` файлов |
| `test_accept_jpg` | Пропуск валидного `.jpg` |
| `test_accept_pdf` | Пропуск валидного `.pdf` |
| `test_reject_bad_mime_with_valid_ext` | Блокировка при несоответствии расширения и MIME |
| `test_accept_none_mime` | Корректная работа при `content_type=None` |

### TestPathTraversal (4 теста)
| Тест | Проверяет |
|------|-----------|
| `test_reject_parent_traversal` | Блокировка `../../etc/passwd` |
| `test_reject_absolute_path` | Блокировка `/etc/passwd` |
| `test_accept_normal_filename` | Пропуск обычного `abc123.jpg` |
| `test_reject_dot_dot_in_middle` | Блокировка `subdir/../../../etc/shadow` |

### TestPaginationParams (5 тестов)
| Тест | Проверяет |
|------|-----------|
| `test_default_pagination` | GET /tasks без параметров → 200 |
| `test_custom_pagination` | `?limit=10&offset=0` → 200 |
| `test_invalid_limit_too_high` | `?limit=500` → 400 |
| `test_invalid_limit_zero` | `?limit=0` → 400 |
| `test_negative_offset` | `?offset=-1` → 400 |

**Итого:** 44 теста, все проходят.

---

## 8. Полный список изменённых файлов

| Файл | Действие |
|------|----------|
| `.env.example` | Создан |
| `docker-compose.yml` | Изменён |
| `app/infrastructure/file_storage.py` | Переписан |
| `app/core/config.py` | Изменён |
| `app/infrastructure/models.py` | Изменён |
| `app/infrastructure/database.py` | Изменён |
| `app/infrastructure/repositories.py` | Изменён |
| `app/domain/interfaces.py` | Изменён |
| `app/domain/entities.py` | Изменён |
| `app/application/task_services.py` | Переписан |
| `app/presentation/api.py` | Изменён |
| `app/worker/main.py` | Изменён |
| `main_api.py` | Изменён |
| `Caddyfile` | Изменён |
| `.github/workflows/ci.yml` | Изменён |
| `pyproject.toml` | Изменён |
| `alembic/versions/e5f6g7h8i9j0_...py` | Создан |
| `tests/test_file_storage.py` | Создан |
| `frontend/src/pages/TaskList.tsx` | Изменён |
| `frontend/src/pages/AddTask.tsx` | Изменён |

---

## 9. Оставшиеся рекомендации (не реализовано)

Следующие пункты из аудита требуют ручных действий или отдельного решения:

1. **Отзыв BOT_TOKEN** — необходимо вручную через @BotFather в Telegram
2. **Удаление `.env` из git-истории** — требует `git filter-branch` или `bfg`, затрагивает историю для всех разработчиков
3. **Telegram SDK fallback** — замена `window.alert()`/`window.confirm()` на React-модалки требует создания UI-компонентов
4. **npm audit в CI** — требует настройки frontend CI-шага
5. **Тесты concurrent access** — требуют реальной PostgreSQL (не SQLite)
6. **Тесты rate limiting** — зависят от настроек SlowAPI в тестовом окружении
