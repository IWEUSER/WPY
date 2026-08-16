import tempfile

import pytest

from wpy import create_app


@pytest.fixture()
def app():
    with tempfile.NamedTemporaryFile(suffix=".sqlite") as tmp:
        app = create_app({"TESTING": True, "DATABASE": tmp.name})
        yield app


@pytest.fixture()
def client(app):
    return app.test_client()


def test_health(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.get_json() == {"status": "ok"}


def test_index_renders(client):
    resp = client.get("/")
    assert resp.status_code == 200
    assert b"WPY" in resp.data


def test_todos_empty_by_default(client):
    resp = client.get("/api/todos")
    assert resp.status_code == 200
    assert resp.get_json() == []


def test_create_and_list_todo(client):
    resp = client.post("/api/todos", json={"title": "buy milk"})
    assert resp.status_code == 201
    created = resp.get_json()
    assert created["title"] == "buy milk"
    assert created["done"] is False
    assert isinstance(created["id"], int)

    resp = client.get("/api/todos")
    todos = resp.get_json()
    assert len(todos) == 1
    assert todos[0]["title"] == "buy milk"


def test_create_requires_title(client):
    resp = client.post("/api/todos", json={"title": "   "})
    assert resp.status_code == 400
    assert "error" in resp.get_json()


def test_toggle_todo(client):
    todo = client.post("/api/todos", json={"title": "task"}).get_json()
    resp = client.patch(f"/api/todos/{todo['id']}", json={"done": True})
    assert resp.status_code == 200
    assert resp.get_json()["done"] is True

    resp = client.patch(f"/api/todos/{todo['id']}", json={"done": False})
    assert resp.get_json()["done"] is False


def test_toggle_missing_todo(client):
    resp = client.patch("/api/todos/9999", json={"done": True})
    assert resp.status_code == 404


def test_delete_todo(client):
    todo = client.post("/api/todos", json={"title": "temp"}).get_json()
    resp = client.delete(f"/api/todos/{todo['id']}")
    assert resp.status_code == 204

    resp = client.get("/api/todos")
    assert resp.get_json() == []


def test_delete_missing_todo(client):
    resp = client.delete("/api/todos/4242")
    assert resp.status_code == 404
