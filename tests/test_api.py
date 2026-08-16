"""End-to-end API tests for WPY using FastAPI's TestClient."""

from __future__ import annotations

import importlib

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client(tmp_path, monkeypatch):
    # Point the app at an isolated database file per test.
    monkeypatch.setenv("WPY_DB_PATH", str(tmp_path / "test.db"))

    import app.db as db
    import app.main as main

    importlib.reload(db)
    importlib.reload(main)

    with TestClient(main.app) as c:
        yield c


def test_health(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_task_lifecycle(client):
    # Starts empty.
    assert client.get("/api/tasks").json() == []

    # Create.
    res = client.post("/api/tasks", json={"title": "Ship WPY"})
    assert res.status_code == 201
    task = res.json()
    assert task["title"] == "Ship WPY"
    assert task["done"] is False
    task_id = task["id"]

    # List reflects the new task.
    tasks = client.get("/api/tasks").json()
    assert len(tasks) == 1
    assert tasks[0]["id"] == task_id

    # Mark done.
    res = client.patch(f"/api/tasks/{task_id}", json={"done": True})
    assert res.status_code == 200
    assert res.json()["done"] is True

    # Delete.
    assert client.delete(f"/api/tasks/{task_id}").status_code == 204
    assert client.get("/api/tasks").json() == []


def test_validation_rejects_empty_title(client):
    res = client.post("/api/tasks", json={"title": ""})
    assert res.status_code == 422


def test_update_missing_task_returns_404(client):
    res = client.patch("/api/tasks/999", json={"done": True})
    assert res.status_code == 404


def test_index_served(client):
    res = client.get("/")
    assert res.status_code == 200
    assert "WPY" in res.text
