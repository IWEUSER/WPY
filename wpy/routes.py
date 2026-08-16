"""HTTP routes: an HTML page plus a small JSON REST API for todos."""

from __future__ import annotations

from flask import Blueprint, abort, jsonify, render_template, request

from .db import get_db

bp = Blueprint("main", __name__)


def _todo_to_dict(row) -> dict:
    return {
        "id": row["id"],
        "title": row["title"],
        "done": bool(row["done"]),
        "created_at": row["created_at"],
    }


@bp.get("/")
def index():
    return render_template("index.html")


@bp.get("/health")
def health():
    return jsonify(status="ok"), 200


@bp.get("/api/todos")
def list_todos():
    db = get_db()
    rows = db.execute("SELECT * FROM todos ORDER BY id DESC").fetchall()
    return jsonify([_todo_to_dict(r) for r in rows])


@bp.post("/api/todos")
def create_todo():
    data = request.get_json(silent=True) or {}
    title = (data.get("title") or "").strip()
    if not title:
        abort(400, description="title is required")

    db = get_db()
    cur = db.execute("INSERT INTO todos (title) VALUES (?)", (title,))
    db.commit()
    row = db.execute("SELECT * FROM todos WHERE id = ?", (cur.lastrowid,)).fetchone()
    return jsonify(_todo_to_dict(row)), 201


@bp.patch("/api/todos/<int:todo_id>")
def toggle_todo(todo_id: int):
    data = request.get_json(silent=True) or {}
    db = get_db()
    row = db.execute("SELECT * FROM todos WHERE id = ?", (todo_id,)).fetchone()
    if row is None:
        abort(404, description="todo not found")

    done = int(bool(data.get("done", not row["done"])))
    db.execute("UPDATE todos SET done = ? WHERE id = ?", (done, todo_id))
    db.commit()
    row = db.execute("SELECT * FROM todos WHERE id = ?", (todo_id,)).fetchone()
    return jsonify(_todo_to_dict(row))


@bp.delete("/api/todos/<int:todo_id>")
def delete_todo(todo_id: int):
    db = get_db()
    row = db.execute("SELECT * FROM todos WHERE id = ?", (todo_id,)).fetchone()
    if row is None:
        abort(404, description="todo not found")
    db.execute("DELETE FROM todos WHERE id = ?", (todo_id,))
    db.commit()
    return "", 204


@bp.errorhandler(400)
@bp.errorhandler(404)
def handle_error(err):
    return jsonify(error=err.description), err.code
