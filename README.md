# WPY

A tiny **W**eb-**PY**thon task board: a [FastAPI](https://fastapi.tiangolo.com/)
backend with a modern single-page frontend and a zero-dependency SQLite store.

It ships with a JSON API (`/api/tasks`) and a served UI at `/`, so it works as a
minimal but complete end-to-end web application.

## Stack

- Python 3.12, FastAPI + Uvicorn
- SQLite via the standard-library `sqlite3` module (no external DB)
- Vanilla HTML/CSS/JS frontend
- `pytest` for the test suite

## Quick start

```bash
# 1. Install dependencies into a local virtualenv
bash scripts/install.sh

# 2. Run the dev server (autoreload)
bash scripts/dev.sh
# → http://localhost:8000
```

The dev server serves the UI at `/` and the API under `/api`.

## API

| Method   | Path               | Description              |
| -------- | ------------------ | ------------------------ |
| `GET`    | `/api/health`      | Service health + version |
| `GET`    | `/api/tasks`       | List tasks               |
| `POST`   | `/api/tasks`       | Create a task            |
| `PATCH`  | `/api/tasks/{id}`  | Toggle `done`            |
| `DELETE` | `/api/tasks/{id}`  | Delete a task            |

Example:

```bash
curl -X POST http://localhost:8000/api/tasks \
  -H 'Content-Type: application/json' \
  -d '{"title": "Ship WPY"}'
```

## Tests

```bash
source .venv/bin/activate
python -m pytest -q
```

## Configuration

- `WPY_DB_PATH` — override the SQLite database file location (defaults to
  `data/wpy.db`). The test-suite uses this to run against a temp database.

## Cloud Agent environment

The Cursor Cloud Agent environment is defined in
[`.cursor/environment.json`](.cursor/environment.json):

- **install** — `scripts/install.sh` creates `.venv` and installs pinned deps.
- **terminals** — `scripts/dev.sh` runs the Uvicorn dev server on port `8000`.
