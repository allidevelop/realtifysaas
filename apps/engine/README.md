# engine

Python-сервис (ТЗ §10): движок оценки, гео-API, публичный API, ETL, Telegram-бот.

## Запуск (локально)

```bash
uv sync
uv run uvicorn app.main:app --reload   # http://localhost:8000
```

- `GET /health` — healthcheck.
- Линт/типы: `uv run ruff check`, `uv run mypy`
- Тесты: `uv run pytest`

Этап 0: только каркас FastAPI и `/health`. Эндпоинты оценки/гео/ETL/бота
добавляются на этапах 2–5.
