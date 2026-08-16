"""WPY application entrypoint.

A small but complete FastAPI service that exposes a JSON task API and serves
a single-page frontend. Run locally with::

    uvicorn app.main:app --reload
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Response
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import __version__
from .db import get_connection, init_db

STATIC_DIR = Path(__file__).resolve().parent / "static"


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(title="WPY", version=__version__, lifespan=lifespan)


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)


class TaskUpdate(BaseModel):
    done: bool


class Task(BaseModel):
    id: int
    title: str
    done: bool
    created_at: str


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "version": __version__}


@app.get("/api/tasks", response_model=list[Task])
def list_tasks() -> list[Task]:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT id, title, done, created_at FROM tasks ORDER BY id DESC"
        ).fetchall()
    return [
        Task(id=r["id"], title=r["title"], done=bool(r["done"]), created_at=r["created_at"])
        for r in rows
    ]


@app.post("/api/tasks", response_model=Task, status_code=201)
def create_task(payload: TaskCreate) -> Task:
    with get_connection() as conn:
        cur = conn.execute("INSERT INTO tasks (title) VALUES (?)", (payload.title,))
        row = conn.execute(
            "SELECT id, title, done, created_at FROM tasks WHERE id = ?",
            (cur.lastrowid,),
        ).fetchone()
    return Task(id=row["id"], title=row["title"], done=bool(row["done"]), created_at=row["created_at"])


@app.patch("/api/tasks/{task_id}", response_model=Task)
def update_task(task_id: int, payload: TaskUpdate) -> Task:
    with get_connection() as conn:
        cur = conn.execute(
            "UPDATE tasks SET done = ? WHERE id = ?", (int(payload.done), task_id)
        )
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Task not found")
        row = conn.execute(
            "SELECT id, title, done, created_at FROM tasks WHERE id = ?", (task_id,)
        ).fetchone()
    return Task(id=row["id"], title=row["title"], done=bool(row["done"]), created_at=row["created_at"])


@app.delete("/api/tasks/{task_id}", status_code=204, response_class=Response)
def delete_task(task_id: int) -> Response:
    with get_connection() as conn:
        cur = conn.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Task not found")
    return Response(status_code=204)


@app.get("/")
def index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
