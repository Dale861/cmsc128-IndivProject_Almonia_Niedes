// ============================================================================
// main.js - Full version (with Toast Undo + Sorting Dropdown)
// ============================================================================

const PRIORITY_COLORS = { High: "red", Mid: "orange", Low: "green" };
let todos = [];
let calendar;

// ============================================================================
// DOM ELEMENTS
// ============================================================================
const addTaskBtn = document.getElementById("add-task-btn");
const addTaskConfirmBtn = document.getElementById("add-task-confirm");
const taskNameInput = document.getElementById("task-name");
const taskPriorityInput = document.getElementById("task-priority");
const taskDateInput = document.getElementById("task-date");
const taskTimeInput = document.getElementById("task-time");

const renameTaskConfirmBtn = document.getElementById("rename-task-confirm");
const renameTaskNameInput = document.getElementById("rename-task-name");
const renameTaskPriorityInput = document.getElementById("rename-task-priority");
const renameTaskDateInput = document.getElementById("rename-task-date");
const renameTaskTimeInput = document.getElementById("rename-task-time");

const deleteTaskConfirmBtn = document.getElementById("delete-task-confirm");
const doneTaskConfirmBtn = document.getElementById("done-task-confirm");

const listWeek = document.getElementById("list-week");
const listMonth = document.getElementById("list-month");
const listPersonal = document.getElementById("list-personal");
const listDone = document.getElementById("list-done");

// Modals
const addModal = document.getElementById("addModal");
const renameModal = document.getElementById("renameModal");
const deleteModal = document.getElementById("deleteModal");
const doneModal = document.getElementById("doneModal");

// Sorting + Toast
const sortSelect = document.getElementById("sort-select");
const toast = document.getElementById("toast");
const toastMsg = document.getElementById("toast-message");
const toastUndoBtn = document.getElementById("toast-undo");

let renameIndex = null;
let deleteIndex = null;
let doneIndex = null;
let lastDeleted = null; // for undo

// ============================================================================
// API HELPERS
// ============================================================================
async function apiList() {
  const r = await fetch("/api/tasks");
  return r.json();
}
async function apiCreate(task) {
  const r = await fetch("/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(task),
  });
  return r.json();
}
async function apiUpdate(id, patch) {
  const r = await fetch(`/api/tasks/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return r.json();
}
async function apiDelete(id) {
  await fetch(`/api/tasks/${id}`, { method: "DELETE" });
}
async function apiToggle(id) {
  const r = await fetch(`/api/tasks/${id}/toggle`, { method: "PATCH" });
  return r.json();
}

// ============================================================================
// INITIALIZATION
// ============================================================================
document.addEventListener("DOMContentLoaded", async () => {
  // Calendar init
  const calendarEl = document.getElementById("calendar");
  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    height: "100%",
    events: [],
  });
  calendar.render();

  // Load tasks
  todos = await apiList();
  rebuildCalendarFromTodos();
  renderTodos();

  // Sorting handler
  if (sortSelect) {
    sortSelect.addEventListener("change", () => {
      renderTodos();
    });
  }

  // Undo handler
  if (toastUndoBtn) {
    toastUndoBtn.addEventListener("click", async () => {
      if (lastDeleted) {
        const restored = await apiCreate(lastDeleted);
        todos.push(restored);
        rebuildCalendarFromTodos();
        renderTodos();
        hideToast();
        lastDeleted = null;
      }
    });
  }
});

// ============================================================================
// RENDERING
// ============================================================================
function renderTodos() {
  listWeek.innerHTML = "";
  listMonth.innerHTML = "";
  listPersonal.innerHTML = "";
  listDone.innerHTML = "";

  // Sort before rendering
  const sortedTodos = [...todos];
  if (sortSelect) {
    const criteria = sortSelect.value;
    if (criteria === "dateAdded") {
      sortedTodos.sort((a, b) => a.createdAt - b.createdAt);
    } else if (criteria === "dueDate") {
      sortedTodos.sort((a, b) => {
        if (!a.date) return 1;
        if (!b.date) return -1;
        return new Date(a.date) - new Date(b.date);
      });
    } else if (criteria === "priority") {
      const order = { High: 1, Mid: 2, Low: 3 };
      sortedTodos.sort((a, b) => (order[a.priority] || 99) - (order[b.priority] || 99));
    }
  }

  const now = new Date();
  const weekFromNow = new Date();
  weekFromNow.setDate(now.getDate() + 7);
  const monthFromNow = new Date();
  monthFromNow.setMonth(now.getMonth() + 1);

  sortedTodos.forEach((task, index) => {
    const item = document.createElement("li");
    item.className = task.checked ? "checked" : "";
    item.style.color = PRIORITY_COLORS[task.priority || "Mid"];
    item.textContent = task.text;

    const btns = document.createElement("div");
    btns.className = "actions";

    // Done/Undo
    const toggleBtn = document.createElement("button");
    toggleBtn.textContent = task.checked ? "Undo" : "Done";
    toggleBtn.addEventListener("click", () => toggleTask(todos.indexOf(task)));
    btns.appendChild(toggleBtn);

    // Rename
    const renameBtn = document.createElement("button");
    renameBtn.textContent = "Edit";
    renameBtn.addEventListener("click", () => openRenameModal(todos.indexOf(task)));
    btns.appendChild(renameBtn);

    // Delete
    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", () => openDeleteModal(todos.indexOf(task)));
    btns.appendChild(deleteBtn);

    item.appendChild(btns);

    if (task.checked) {
      listDone.appendChild(item);
    } else {
      const dueDate = task.date ? new Date(task.date) : null;
      if (dueDate) {
        if (dueDate <= weekFromNow) {
          listWeek.appendChild(item);
        } else if (dueDate <= monthFromNow) {
          listMonth.appendChild(item);
        } else {
          listPersonal.appendChild(item);
        }
      } else {
        listPersonal.appendChild(item);
      }
    }
  });
}

function rebuildCalendarFromTodos() {
  if (!calendar) return;
  calendar.removeAllEvents();
  todos.forEach((t) => {
    if (t.date && !t.checked) {
      calendar.addEvent({
        title: t.text,
        start: t.date,
        allDay: t.date.indexOf("T") === -1,
        color: PRIORITY_COLORS[t.priority || "Mid"],
      });
    }
  });
}

// ============================================================================
// ADD TASK
// ============================================================================
addTaskBtn.addEventListener("click", () => {
  addModal.style.display = "block";
});

addTaskConfirmBtn.addEventListener("click", async () => {
  const text = taskNameInput.value.trim();
  const priority = taskPriorityInput.value || "Mid";
  const date = taskDateInput.value.trim();
  const time = taskTimeInput.value.trim();

  if (!text) {
    alert("Please enter a task name.");
    return;
  }

  let dateTime = "";
  if (date) dateTime = time ? `${date}T${time}` : date;

  const created = await apiCreate({
    text,
    date: dateTime,
    checked: false,
    priority,
  });

  todos.push(created);
  rebuildCalendarFromTodos();
  closeAddModal();
  renderTodos();
});

// ============================================================================
// RENAME TASK
// ============================================================================
function openRenameModal(index) {
  renameIndex = index;
  const task = todos[index];
  renameTaskNameInput.value = task.text;
  renameTaskPriorityInput.value = task.priority || "Mid";
  if (task.date) {
    const [d, t] = task.date.split("T");
    renameTaskDateInput.value = d || "";
    renameTaskTimeInput.value = t || "";
  }
  renameModal.style.display = "block";
}

renameTaskConfirmBtn.addEventListener("click", async () => {
  const newText = renameTaskNameInput.value.trim();
  const newPriority = renameTaskPriorityInput.value || "Mid";
  const newDate = renameTaskDateInput.value.trim();
  const newTime = renameTaskTimeInput.value.trim();

  if (!newText) {
    alert("Task cannot be empty.");
    return;
  }

  let newDateTime = "";
  if (newDate) newDateTime = newTime ? `${newDate}T${newTime}` : newDate;

  const id = todos[renameIndex].id;
  const updated = await apiUpdate(id, {
    text: newText,
    priority: newPriority,
    date: newDateTime || "",
  });

  todos[renameIndex] = updated;
  rebuildCalendarFromTodos();
  closeRenameModal();
  renderTodos();
});

// ============================================================================
// TOGGLE TASK
// ============================================================================
function toggleTask(index) {
  const id = todos[index].id;
  apiToggle(id).then((updated) => {
    todos[index] = updated;
    rebuildCalendarFromTodos();
    renderTodos();
  });
}

// ============================================================================
// DELETE TASK (with Toast + Undo)
// ============================================================================
function openDeleteModal(index) {
  deleteIndex = index;
  deleteModal.style.display = "block";
}

deleteTaskConfirmBtn.addEventListener("click", async () => {
  const task = todos[deleteIndex];
  lastDeleted = { ...task }; // keep a copy for undo
  const id = task.id;
  await apiDelete(id);
  todos.splice(deleteIndex, 1);
  rebuildCalendarFromTodos();
  closeDeleteModal();
  renderTodos();
  showToast(`Task "${task.text}" deleted.`);
});

// ============================================================================
// TOAST HELPERS (patched for CSS .show)
// ============================================================================
function showToast(msg) {
  if (!toast) return;
  toastMsg.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => {
    hideToast();
  }, 5000); // auto-hide after 5s
}
function hideToast() {
  if (toast) {
    toast.classList.remove("show");
  }
}

// ============================================================================
// MODAL HELPERS
// ============================================================================
function closeAddModal() {
  addModal.style.display = "none";
}
function closeRenameModal() {
  renameModal.style.display = "none";
}
function closeDeleteModal() {
  deleteModal.style.display = "none";
}
function closeDoneModal() {
  doneModal.style.display = "none";
}
