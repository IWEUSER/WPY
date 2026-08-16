# WPY

A tiny **W**eb app in **PY**thon: a Flask-based todo list with a JSON REST API,
SQLite persistence (standard library only), and a small modern front end.

## Stack

- Python 3.12 + [Flask](https://flask.palletsprojects.com/) 3
- SQLite via the standard-library `sqlite3` module
- Vanilla HTML/CSS/JS front end (no build step)
- `pytest` for tests

## Quick start

```bash
# Create a virtualenv and install dependencies
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

# Run the development server (http://localhost:5000)
.venv/bin/python run.py
```

On Ubuntu you may first need the venv module: `sudo apt-get install -y python3-venv`.

## Tests

```bash
.venv/bin/python -m pytest -q
```

## HTTP API

| Method   | Path              | Description                       |
| -------- | ----------------- | --------------------------------- |
| `GET`    | `/`               | Todo web UI                       |
| `GET`    | `/health`         | Health check (`{"status":"ok"}`)  |
| `GET`    | `/api/todos`      | List todos                        |
| `POST`   | `/api/todos`      | Create a todo (`{"title": "..."}`)|
| `PATCH`  | `/api/todos/<id>` | Toggle/update `done`              |
| `DELETE` | `/api/todos/<id>` | Delete a todo                     |

Example:

```bash
curl -s localhost:5000/api/todos -H 'Content-Type: application/json' \
  -d '{"title": "buy milk"}'
```

## Cloud Agent environment

`.cursor/environment.json` configures the Cursor Cloud Agent environment:

- `install` runs `.cursor/install.sh`, which ensures `python3-venv`, creates
  `.venv`, and installs dependencies (idempotent).
- A `web` terminal runs the dev server on port `5000`.
