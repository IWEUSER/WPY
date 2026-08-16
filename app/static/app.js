const listEl = document.getElementById("task-list");
const formEl = document.getElementById("task-form");
const inputEl = document.getElementById("task-input");
const countEl = document.getElementById("count");
const emptyEl = document.getElementById("empty");
const statusEl = document.getElementById("status");

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(`Request failed: ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

function render(tasks) {
  listEl.innerHTML = "";
  for (const task of tasks) {
    const li = document.createElement("li");
    li.className = `task${task.done ? " done" : ""}`;
    li.dataset.id = task.id;

    const check = document.createElement("input");
    check.type = "checkbox";
    check.className = "task__check";
    check.checked = task.done;
    check.addEventListener("change", () => toggleTask(task.id, check.checked));

    const title = document.createElement("span");
    title.className = "task__title";
    title.textContent = task.title;

    const del = document.createElement("button");
    del.className = "task__delete";
    del.type = "button";
    del.setAttribute("aria-label", "Delete task");
    del.textContent = "×";
    del.addEventListener("click", () => deleteTask(task.id));

    li.append(check, title, del);
    listEl.appendChild(li);
  }

  const n = tasks.length;
  countEl.textContent = `${n} task${n === 1 ? "" : "s"}`;
  emptyEl.hidden = n !== 0;
}

async function refresh() {
  const tasks = await api("/api/tasks");
  render(tasks);
}

async function toggleTask(id, done) {
  await api(`/api/tasks/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ done }),
  });
  await refresh();
}

async function deleteTask(id) {
  await api(`/api/tasks/${id}`, { method: "DELETE" });
  await refresh();
}

formEl.addEventListener("submit", async (event) => {
  event.preventDefault();
  const title = inputEl.value.trim();
  if (!title) return;
  await api("/api/tasks", {
    method: "POST",
    body: JSON.stringify({ title }),
  });
  inputEl.value = "";
  inputEl.focus();
  await refresh();
});

async function checkHealth() {
  try {
    const health = await api("/api/health");
    statusEl.textContent = `API ${health.version}`;
    statusEl.classList.add("ok");
  } catch (err) {
    statusEl.textContent = "offline";
    statusEl.classList.add("down");
  }
}

checkHealth();
refresh();
