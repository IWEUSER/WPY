const listEl = document.getElementById("todo-list");
const emptyEl = document.getElementById("empty-state");
const formEl = document.getElementById("new-todo-form");
const inputEl = document.getElementById("new-todo-input");

async function api(path, options) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok && res.status !== 204) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.status === 204 ? null : res.json();
}

function render(todos) {
  listEl.innerHTML = "";
  emptyEl.hidden = todos.length > 0;

  for (const todo of todos) {
    const li = document.createElement("li");
    li.className = "todo" + (todo.done ? " todo--done" : "");
    li.dataset.id = todo.id;

    const check = document.createElement("input");
    check.type = "checkbox";
    check.className = "todo__check";
    check.checked = todo.done;
    check.addEventListener("change", () => toggleTodo(todo.id, check.checked));

    const title = document.createElement("span");
    title.className = "todo__title";
    title.textContent = todo.title;

    const del = document.createElement("button");
    del.className = "todo__delete";
    del.type = "button";
    del.setAttribute("aria-label", "Delete todo");
    del.textContent = "\u00d7";
    del.addEventListener("click", () => deleteTodo(todo.id));

    li.append(check, title, del);
    listEl.appendChild(li);
  }
}

async function loadTodos() {
  render(await api("/api/todos"));
}

async function addTodo(title) {
  await api("/api/todos", {
    method: "POST",
    body: JSON.stringify({ title }),
  });
  await loadTodos();
}

async function toggleTodo(id, done) {
  await api(`/api/todos/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ done }),
  });
  await loadTodos();
}

async function deleteTodo(id) {
  await api(`/api/todos/${id}`, { method: "DELETE" });
  await loadTodos();
}

formEl.addEventListener("submit", async (event) => {
  event.preventDefault();
  const title = inputEl.value.trim();
  if (!title) return;
  inputEl.value = "";
  await addTodo(title);
  inputEl.focus();
});

loadTodos();
