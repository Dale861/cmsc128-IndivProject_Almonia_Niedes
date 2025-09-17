document.addEventListener('DOMContentLoaded', function () {
  // ---------- CALENDAR SETUP ---------- //
  const calendarEl = document.getElementById('calendar');
  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: '' // no week/month switcher
    },
    nowIndicator: true,
  });
  calendar.render();

  // ---------- COLORS BY PRIORITY (for calendar events) ---------- //
  const PRIORITY_COLORS = {
    High: '#e53935',  // red
    Mid:  '#fdd835',  // yellow
    Low:  '#43a047',  // green
  };
  const priorityOrder = { High: 0, Mid: 1, Low: 2 };

  // ---------- PERSISTENCE ---------- //
  const LS_KEY = 'todos-v2';
  function loadTodos() {
    try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; }
    catch { return []; }
  }
  function saveTodos() {
    localStorage.setItem(LS_KEY, JSON.stringify(todos));
  }

  // ---------- DATA ---------- //
  let todos = loadTodos(); // [{ text, date?, checked, priority, createdAt }]

  function rebuildCalendarFromTodos() {
    calendar.getEvents().forEach(e => e.remove());
    todos.forEach(t => {
      if (t.date && !t.checked) {
        calendar.addEvent({
          title: t.text,
          start: t.date,
          allDay: !(t.date.includes('T')),
          color: PRIORITY_COLORS[t.priority || 'Mid'], // color by priority
        });
      }
    });
  }
  rebuildCalendarFromTodos();

  // ---------- DOM ELEMENTS ---------- //
  const addBtn = document.getElementById('add-task-btn');
  const confirmBtn = document.getElementById('add-task-confirm');
  const modal = document.getElementById('addModal');
  const nameInput = document.getElementById('task-name');
  const dateInput = document.getElementById('task-date');
  const timeInput = document.getElementById('task-time');
  const priorityInput = document.getElementById('task-priority');

  const listWeek = document.getElementById('list-week');
  const listMonth = document.getElementById('list-month');
  const listPersonal = document.getElementById('list-personal');
  const listDone = document.getElementById('list-done');
  const sortSelect = document.getElementById('sort-select');

  // Rename modal elements
  const renameModal = document.getElementById('renameModal');
  const renameNameInput = document.getElementById('rename-task-name');
  const renameDateInput = document.getElementById('rename-task-date');
  const renameTimeInput = document.getElementById('rename-task-time');
  const renamePriorityInput = document.getElementById('rename-task-priority');
  const renameConfirmBtn = document.getElementById('rename-task-confirm');
  let renameIndex = null;

  // Delete modal
  const deleteModal = document.getElementById('deleteModal');
  const deleteConfirmBtn = document.getElementById('delete-task-confirm');
  let deleteIndex = null;

  // Done modal
  const doneModal = document.getElementById('doneModal');
  const doneConfirmBtn = document.getElementById('done-task-confirm');
  let doneIndex = null;

  // Toast (Undo Delete)
  const toast = document.getElementById('toast');
  const toastUndoBtn = document.getElementById('toast-undo');
  const toastMessage = document.getElementById('toast-message');
  let toastTimer = null;
  let lastDeleted = null; // {task, index}

  // ---------- HELPERS ---------- //
  function getPriorityClass(p) {
    if (p === 'High') return 'high-priority';
    if (p === 'Low')  return 'low-priority';
    return 'mid-priority';
  }

  function showToast(message = 'Task deleted', ms = 4000) {
    toastMessage.textContent = message;
    toast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
      lastDeleted = null;
    }, ms);
  }

  function closeAddModal() {
    modal.style.display = 'none';
    nameInput.value = '';
    dateInput.value = '';
    timeInput.value = '';
    priorityInput.value = 'Mid';
  }
  window.closeAddModal = closeAddModal;

  function openAddModal() {
    modal.style.display = 'flex';
  }

  function openRenameModal(index) {
    renameIndex = index;
    const t = todos[index];
    renameNameInput.value = t.text;
    renamePriorityInput.value = t.priority || 'Mid';

    if (t.date && t.date.includes('T')) {
      const [d, tm] = t.date.split('T');
      renameDateInput.value = d;
      renameTimeInput.value = tm;
    } else {
      renameDateInput.value = t.date || '';
      renameTimeInput.value = '';
    }
    renameModal.style.display = 'flex';
  }
  function closeRenameModal() {
    renameModal.style.display = 'none';
    renameNameInput.value = '';
    renameDateInput.value = '';
    renameTimeInput.value = '';
    renamePriorityInput.value = 'Mid';
    renameIndex = null;
  }
  window.closeRenameModal = closeRenameModal;

  function openDeleteModal(index) {
    deleteIndex = index;
    deleteModal.style.display = 'flex';
  }
  function closeDeleteModal() {
    deleteModal.style.display = 'none';
    deleteIndex = null;
  }
  window.closeDeleteModal = closeDeleteModal;

  function openDoneModal(index) {
    doneIndex = index;
    doneModal.style.display = 'flex';
  }
  function closeDoneModal() {
    doneModal.style.display = 'none';
    doneIndex = null;
    renderTodos();
  }
  window.closeDoneModal = closeDoneModal;

  // Close on overlay click
  window.addEventListener('click', (e) => {
    if (e.target === modal) closeAddModal();
    if (e.target === renameModal) closeRenameModal();
    if (e.target === deleteModal) closeDeleteModal();
    if (e.target === doneModal) closeDoneModal();
  });
  // Close with ESC
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAddModal(); closeRenameModal(); closeDeleteModal(); closeDoneModal();
    }
  });

  // ---------- SORTING ---------- //
  function compareTasks(a, b) {
    const mode = sortSelect.value;
    if (mode === 'dateAdded') {
      return (a.createdAt || 0) - (b.createdAt || 0);
    } else if (mode === 'dueDate') {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(a.date) - new Date(b.date);
    } else if (mode === 'priority') {
      return (priorityOrder[a.priority || 'Mid']) - (priorityOrder[b.priority || 'Mid']);
    }
    return 0;
  }

  // ---------- RENDER LISTS (with THIS WEEK precedence) ---------- //
  function renderTodos() {
    listWeek.innerHTML = '';
    listMonth.innerHTML = '';
    listPersonal.innerHTML = '';
    listDone.innerHTML = '';

    const now = new Date();

    // Week boundaries (Sun 00:00:00.000 → Sat 23:59:59.999)
    const startOfWeek = new Date(now);
    startOfWeek.setHours(0, 0, 0, 0);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999); // Saturday end

    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();

    const sorted = todos.slice().sort(compareTasks);

    sorted.forEach((t) => {
      const index = todos.indexOf(t);
      const li = document.createElement('li');
      li.classList.add('task-item', getPriorityClass(t.priority || 'Mid'));

      // time text
      let timeDisplay = '';
      if (t.date && t.date.includes('T')) {
        const dt = new Date(t.date);
        timeDisplay = ` (${dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`;
      }

      if (t.checked) {
        // Done → checkbox only
        li.innerHTML = `
          <label>
            <input type="checkbox" checked onchange="toggleCheck(${index})">
            <span class="task-text">${t.text}${timeDisplay}</span>
          </label>
        `;
        listDone.appendChild(li);
      } else {
        li.innerHTML = `
          <label>
            <input type="checkbox" onchange="toggleCheck(${index})">
            <span class="task-text">${t.text}${timeDisplay}</span>
          </label>
          <span class="task-actions">
            <button title="Edit" onclick="renameTask(${index})">✏️</button>
            <button title="Delete" onclick="deleteTask(${index})">🗑️</button>
          </span>
        `;

        if (t.date) {
          const d = new Date(t.date);

          // Put in THIS WEEK first if within the current week
          if (d >= startOfWeek && d <= endOfWeek) {
            listWeek.appendChild(li);
          } else if (d.getMonth() === thisMonth && d.getFullYear() === thisYear) {
            // Otherwise, if in this month → This Month
            listMonth.appendChild(li);
          } else {
            // Otherwise → Personal
            listPersonal.appendChild(li);
          }
        } else {
          listPersonal.appendChild(li);
        }
      }
    });
    saveTodos();
  }

  // ---------- DONE FLOW ---------- //
  doneConfirmBtn.addEventListener('click', () => {
    if (doneIndex !== null) {
      todos[doneIndex].checked = true;

      // remove from calendar if it had an event
      if (todos[doneIndex].date) {
        const events = calendar.getEvents();
        const event = events.find(
          e => e.title === todos[doneIndex].text && e.startStr.startsWith(todos[doneIndex].date)
        );
        if (event) event.remove();
      }

      saveTodos();
      renderTodos();
    }
    closeDoneModal();
  });

  window.toggleCheck = function (index) {
    if (!todos[index].checked) {
      openDoneModal(index); // confirm before marking done
    } else {
      // Uncheck (undo done)
      todos[index].checked = false;
      if (todos[index].date) {
        calendar.addEvent({
          title: todos[index].text,
          start: todos[index].date,
          allDay: todos[index].date.indexOf('T') === -1,
          color: PRIORITY_COLORS[todos[index].priority || 'Mid'],
        });
      }
      saveTodos();
      renderTodos();
    }
  };

  // ---------- ADD TASK ---------- //
  addBtn.addEventListener('click', openAddModal);

  confirmBtn.addEventListener('click', () => {
    const text = nameInput.value.trim();
    const date = dateInput.value.trim();
    const time = timeInput.value.trim();
    const priority = priorityInput.value || 'Mid';

    if (!text) {
      alert('Please enter a task name.');
      return;
    }

    const task = {
      text,
      checked: false,
      priority,
      createdAt: Date.now()
    };

    if (date) {
      let dateTime = date;
      if (time) dateTime = `${date}T${time}`;
      task.date = dateTime;

      calendar.addEvent({
        title: text,
        start: dateTime,
        allDay: !time,
        color: PRIORITY_COLORS[priority],
      });
    }

    todos.push(task);
    saveTodos();
    closeAddModal();
    renderTodos();
  });

  // ---------- RENAME ---------- //
  renameConfirmBtn.addEventListener('click', () => {
    if (renameIndex !== null) {
      const newText = renameNameInput.value.trim();
      const newPriority = renamePriorityInput.value || 'Mid';
      const newDate = renameDateInput.value.trim();
      const newTime = renameTimeInput.value.trim();

      if (newText) {
        // Remove old event if exists and task is not done
        if (todos[renameIndex].date && !todos[renameIndex].checked) {
          const events = calendar.getEvents();
          const event = events.find(
            e => e.title === todos[renameIndex].text && e.startStr.startsWith(todos[renameIndex].date)
          );
          if (event) event.remove();
        }

        // Build new datetime
        let newDateTime = '';
        if (newDate) {
          newDateTime = newDate;
          if (newTime) newDateTime = `${newDate}T${newTime}`;
        }

        todos[renameIndex].text = newText;
        todos[renameIndex].priority = newPriority;
        todos[renameIndex].date = newDateTime || '';

        // Add updated event back to calendar if active
        if (newDateTime && !todos[renameIndex].checked) {
          calendar.addEvent({
            title: newText,
            start: newDateTime,
            allDay: !newTime,
            color: PRIORITY_COLORS[newPriority],
          });
        }

        saveTodos();
        renderTodos();
      }
    }
    closeRenameModal();
  });

  window.renameTask = function (index) {
    // Prevent editing done tasks; remove this check if you want to allow
    if (todos[index].checked) return;
    openRenameModal(index);
  };

  // ---------- DELETE ---------- //
  deleteConfirmBtn.addEventListener('click', () => {
    if (deleteIndex !== null) {
      const task = todos[deleteIndex];

      // Remove calendar event too if exists and not done
      if (task.date && !task.checked) {
        const events = calendar.getEvents();
        const event = events.find(
          e => e.title === task.text && e.startStr.startsWith(task.date)
        );
        if (event) event.remove();
      }

      // For undo
      lastDeleted = { task: { ...task }, index: deleteIndex };

      todos.splice(deleteIndex, 1);
      saveTodos();
      renderTodos();
      closeDeleteModal();

      showToast('Task deleted', 5000);
    }
  });

  toastUndoBtn.addEventListener('click', () => {
    if (lastDeleted) {
      const { task, index } = lastDeleted;
      const pos = Math.min(index, todos.length);
      todos.splice(pos, 0, task);

      if (task.date && !task.checked) {
        calendar.addEvent({
          title: task.text,
          start: task.date,
          allDay: task.date.indexOf('T') === -1,
          color: PRIORITY_COLORS[task.priority || 'Mid'],
        });
      }

      saveTodos();
      renderTodos();
      lastDeleted = null;
      toast.classList.remove('show');
      if (toastTimer) clearTimeout(toastTimer);
    }
  });

  window.deleteTask = function (index) {
    openDeleteModal(index);
  };

  // ---------- SORT CHANGE ---------- //
  sortSelect.addEventListener('change', renderTodos);

  // ---------- INITIAL RENDER ---------- //
  renderTodos();
});
