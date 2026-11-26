/**
 * ScholarFlow - Student Task Manager Client
 * Interactive Features: Dashboard, Kanban, Calendar, Pomodoro Timer, Analytics
 */

// Application State
const state = {
    currentUser: null,
    tasks: [],
    allTasks: [],
    courses: [],
    studySessions: [],
    analytics: null,
    currentTab: 'dashboard',
    activeCourseFilter: 'all',
    activePriorityFilter: 'all',
    activeStatusFilter: 'all',
    activeOverdueFilter: false,
    searchQuery: '',
    sortBy: 'due_date',
    calendarDate: new Date(),
    calendarView: 'month', // 'month', 'week', 'day'
    calendarFilter: 'all', // 'all', 'Assignment', 'Exam', 'Project', 'StudySession'
    calShowCompleted: true,
    pomodoro: {
        timer: null,
        mode: 'pomodoro', // pomodoro, shortBreak, longBreak
        totalSeconds: 25 * 60,
        remainingSeconds: 25 * 60,
        isRunning: false,
        soundEnabled: true,
        selectedTaskId: null
    },
    modalSubtasks: [],
    notifications: [],
    unreadNotificationCount: 0,
    notificationPollingInterval: null
};
window.state = state;

// ==========================================================================
// Initialization
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    setupNavigation();
    setupEventListeners();
    setupAuthListeners();
    setupNotificationListeners();
    setupPomodoroTimer();
    setupDragAndDrop();
    checkAuthAndInit();
});

// ==========================================================================
// Theme Management (Per-Student Theme Support)
// ==========================================================================
function getActiveTheme() {
    if (state.currentUser && state.currentUser.id) {
        const userSaved = localStorage.getItem(`scholarflow_theme_${state.currentUser.id}`);
        if (userSaved) return userSaved;
    }
    return localStorage.getItem('scholarflow_theme') || 'dark';
}

function applyCurrentStudentTheme() {
    const theme = getActiveTheme();
    document.documentElement.setAttribute('data-theme', theme);
    updateThemeButtonUI(theme);
}

function initTheme() {
    const savedTheme = getActiveTheme();
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeButtonUI(savedTheme);

    const toggleBtn = document.getElementById('themeToggleBtn');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-theme');
            const next = current === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', next);
            if (state.currentUser && state.currentUser.id) {
                localStorage.setItem(`scholarflow_theme_${state.currentUser.id}`, next);
            }
            localStorage.setItem('scholarflow_theme', next);
            updateThemeButtonUI(next);
            showToast(`Switched to ${next === 'dark' ? 'Dark' : 'Light'} theme`, 'info');
        });
    }
}

function updateThemeButtonUI(theme) {
    const label = document.getElementById('themeLabelText');
    if (label) {
        label.textContent = theme === 'dark' ? 'Dark Mode' : 'Light Mode';
    }
}

// ==========================================================================
// Navigation & Views (Responsive Sidebar Drawer)
// ==========================================================================
function setupNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;
            switchTab(tabName);
            closeMobileSidebar();
        });
    });

    // Mobile menu toggle & backdrop
    const mobileBtn = document.getElementById('mobileMenuBtn');
    const closeBtn = document.getElementById('mobileSidebarCloseBtn');
    const backdrop = document.getElementById('sidebarBackdrop');

    if (mobileBtn) {
        mobileBtn.addEventListener('click', toggleMobileSidebar);
    }
    if (closeBtn) {
        closeBtn.addEventListener('click', closeMobileSidebar);
    }
    if (backdrop) {
        backdrop.addEventListener('click', closeMobileSidebar);
    }
}

function toggleMobileSidebar() {
    const sidebar = document.getElementById('mainSidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    if (sidebar) sidebar.classList.toggle('open');
    if (backdrop) backdrop.classList.toggle('active');
}

function closeMobileSidebar() {
    const sidebar = document.getElementById('mainSidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    if (sidebar) sidebar.classList.remove('open');
    if (backdrop) backdrop.classList.remove('active');
}

function switchTab(tabName) {
    state.currentTab = tabName;

    // Update nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Update tab panes
    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.toggle('active', pane.id === `tab-${tabName}`);
    });

    // Update topbar title
    const titles = {
        dashboard: { title: 'Academic Dashboard', sub: 'Stay organized, beat deadlines, and master your semester' },
        kanban: { title: 'Workflow Kanban Board', sub: 'Drag and track tasks from concept to completion' },
        calendar: { title: 'Deadlines & Exam Schedule', sub: 'Monthly overview of assignments, quizzes, and milestones' },
        pomodoro: { title: 'Focus & Study Room', sub: 'Deep work sessions powered by the Pomodoro technique' },
        analytics: { title: 'Academic Analytics', sub: 'Performance breakdown, time allocation, and workload statistics' }
    };

    if (titles[tabName]) {
        document.getElementById('pageTitle').textContent = titles[tabName].title;
        document.getElementById('pageSubtitle').textContent = titles[tabName].sub;
    }

    // Refresh specific tab contents
    if (tabName === 'kanban') {
        renderKanban();
    } else if (tabName === 'calendar') {
        Promise.all([loadAllTasks(), loadStudySessions()]).then(() => renderCalendar());
    } else if (tabName === 'analytics') {
        loadAnalytics();
    } else if (tabName === 'pomodoro') {
        populatePomodoroTaskSelect();
        loadRecentStudySessions();
    }

    // Close mobile menu if open
    const sidebar = document.getElementById('mainSidebar');
    if (sidebar && sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
    }
}

// ==========================================================================
// Authenticated API Fetch Wrapper
// ==========================================================================
async function authFetch(url, options = {}) {
    try {
        const res = await fetch(url, options);
        if (res.status === 401 && !url.includes('/api/auth/')) {
            handleUnauthorizedSession();
        }
        return res;
    } catch (err) {
        throw err;
    }
}

// ==========================================================================
// API Calls & Data Loading
// ==========================================================================
async function loadCourses() {
    try {
        const res = await authFetch('/api/courses');
        if (res.status === 401) return;
        const data = await res.json();
        if (data.success) {
            state.courses = data.courses;
            renderSidebarCourses();
            populateCourseSelects();
        }
    } catch (err) {
        console.error('Failed to load courses', err);
    }
}

async function loadTasks() {
    try {
        const queryObj = {
            course_id: state.activeCourseFilter,
            priority: state.activePriorityFilter,
            status: state.activeStatusFilter,
            search: state.searchQuery,
            sort_by: state.sortBy
        };
        if (state.activeOverdueFilter || state.activeStatusFilter === 'overdue') {
            queryObj.overdue = 'true';
        }

        const params = new URLSearchParams(queryObj);

        const res = await authFetch(`/api/tasks?${params.toString()}`);
        if (res.status === 401) return;
        const data = await res.json();
        if (data.success) {
            state.tasks = data.tasks;
            // When unfiltered, also populate allTasks pool
            if (state.activeCourseFilter === 'all' && state.activePriorityFilter === 'all' && 
                state.activeStatusFilter === 'all' && !state.activeOverdueFilter && !state.searchQuery) {
                state.allTasks = data.tasks;
            }
            renderTasksList();
            renderKanban();
            if (state.currentTab === 'calendar') {
                renderCalendar();
            }
            updateMetricsFromTasks();
            loadNotifications();
        }
    } catch (err) {
        console.error('Failed to load tasks', err);
        if (state.currentUser) {
            showToast('Failed to load tasks', 'error');
        }
    }
}

async function loadAllTasks() {
    try {
        const res = await authFetch('/api/tasks?sort_by=due_date');
        if (res.status === 401) return;
        const data = await res.json();
        if (data.success) {
            state.allTasks = data.tasks;
        }
    } catch (err) {
        console.error('Failed to load all tasks', err);
    }
}

async function loadAnalytics() {
    try {
        const res = await authFetch('/api/analytics');
        if (res.status === 401) return;
        const data = await res.json();
        if (data.success) {
            state.analytics = data;
            renderAnalytics(data);
        }
    } catch (err) {
        console.error('Failed to load analytics', err);
    }
}

// ==========================================================================
// Render Dashboard & Task Cards
// ==========================================================================
function renderTasksList() {
    const container = document.getElementById('tasksListContainer');
    if (!container) return;

    if (state.tasks.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:12px;opacity:0.6;">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="m9 12 2 2 4-4"/>
                </svg>
                <h3>All Clear! No tasks match your criteria.</h3>
                <p>Enjoy your break or click "+ New Task" to schedule upcoming work.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = state.tasks.map(task => createTaskCardHTML(task)).join('');

    // Attach listeners to cards
    attachTaskCardListeners(container);
}

function formatTaskDueDate(dueStr) {
    if (!dueStr) return 'No due date';
    try {
        const d = new Date(dueStr);
        if (isNaN(d.getTime())) return dueStr;
        return d.toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch {
        return dueStr;
    }
}

function formatShortDate(dateStr) {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric'
        });
    } catch {
        return dateStr;
    }
}

function createTaskCardHTML(task) {
    const courseColor = task.course_color || '#6366f1';
    const courseCode = task.course_code || 'General';
    const isCompleted = task.status === 'completed';
    const isOverdue = !isCompleted && task.is_overdue;

    // Countdown calculation
    const deadlineInfo = formatDeadline(task.due_date, isCompleted);
    const formattedDue = formatTaskDueDate(task.due_date);
    const dateLabel = task.updated_at ? `Updated: ${formatShortDate(task.updated_at)}` : `Created: ${formatShortDate(task.created_at)}`;

    // Subtasks stats
    const totalSub = task.subtasks_total || 0;
    const compSub = task.subtasks_completed || 0;
    const subtaskPct = totalSub > 0 ? Math.round((compSub / totalSub) * 100) : 0;

    return `
        <div class="task-card ${isCompleted ? 'task-status-completed' : ''} ${isOverdue ? 'is-overdue' : ''}" data-task-id="${task.id}" style="--task-color: ${courseColor}">
            <div class="task-card-header">
                <div class="task-badges">
                    <span class="badge-course" style="background:${courseColor}">${escapeHtml(courseCode)}</span>
                    <span class="badge-category">${escapeHtml(task.category)}</span>
                    <span class="priority-tag priority-${task.priority.toLowerCase()}">${escapeHtml(task.priority)}</span>
                    ${isOverdue ? '<span class="priority-tag priority-urgent">⚠️ Overdue</span>' : ''}
                </div>
                <div class="task-card-actions">
                    <button class="card-action-btn btn-focus-timer" title="Focus on this task in Pomodoro room" data-id="${task.id}">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                        </svg>
                    </button>
                    <button class="card-action-btn btn-edit-task" title="Edit Task" data-id="${task.id}">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
                        </svg>
                    </button>
                    <button class="card-action-btn btn-delete btn-delete-task" title="Delete Task" data-id="${task.id}">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                    </button>
                </div>
            </div>

            <h3 class="task-title">${escapeHtml(task.title)}</h3>

            ${task.description ? `<p class="task-desc">${escapeHtml(task.description)}</p>` : ''}

            ${totalSub > 0 ? `
                <div class="task-subtasks-accordion">
                    <div class="subtasks-header" data-toggle-subtasks="${task.id}">
                        <span>Milestones: ${compSub}/${totalSub} (${subtaskPct}%)</span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="6 9 12 15 18 9"/>
                        </svg>
                    </div>
                    <div class="subtasks-progress-bar">
                        <div class="subtasks-progress-fill" style="width: ${subtaskPct}%"></div>
                    </div>
                    <ul class="subtasks-checklist" id="subtasks-list-${task.id}">
                        ${task.subtasks.map(st => `
                            <li class="checklist-item ${st.is_completed ? 'done' : ''}" data-subtask-id="${st.id}">
                                <input type="checkbox" class="checklist-checkbox" ${st.is_completed ? 'checked' : ''}>
                                <span>${escapeHtml(st.title)}</span>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            ` : ''}

            <div class="task-card-footer">
                <div class="task-due-details">
                    <span class="deadline-pill ${deadlineInfo.className}">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                        </svg>
                        ${deadlineInfo.text}
                    </span>
                    <span class="task-date-text">📅 ${escapeHtml(formattedDue)} &bull; ${escapeHtml(dateLabel)}</span>
                </div>

                <select class="status-dropdown-select" data-id="${task.id}" title="Update Status">
                    <option value="todo" ${task.status === 'todo' ? 'selected' : ''}>To Do</option>
                    <option value="in_progress" ${task.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
                    <option value="completed" ${task.status === 'completed' ? 'selected' : ''}>Completed</option>
                </select>
            </div>
        </div>
    `;
}

function attachTaskCardListeners(container) {
    // Status select change
    container.querySelectorAll('.status-dropdown-select').forEach(sel => {
        sel.addEventListener('change', async (e) => {
            const taskId = e.target.dataset.id;
            const newStatus = e.target.value;
            await updateTaskStatus(taskId, newStatus);
        });
    });

    // Subtask toggle checkbox
    container.querySelectorAll('.checklist-checkbox').forEach(box => {
        box.addEventListener('change', async (e) => {
            const li = e.target.closest('.checklist-item');
            const subtaskId = li.dataset.subtaskId;
            try {
                const res = await authFetch(`/api/subtasks/${subtaskId}/toggle`, { method: 'PATCH' });
                const data = await res.json();
                if (data.success) {
                    li.classList.toggle('done', data.is_completed === 1);
                    playSubtleClickSound();
                    loadTasks();
                }
            } catch (err) {
                console.error(err);
            }
        });
    });

    // Delete task with modern confirmation modal
    container.querySelectorAll('.btn-delete-task').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const taskId = btn.dataset.id;
            const confirmed = await showConfirmModal({
                title: 'Delete Task',
                message: 'Are you sure you want to delete this task? This action cannot be undone.',
                confirmText: 'Delete Task',
                isDanger: true
            });
            if (confirmed) {
                await deleteTask(taskId);
            }
        });
    });

    // Edit task
    container.querySelectorAll('.btn-edit-task').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            openEditTaskModal(btn.dataset.id);
        });
    });

    // Focus timer button
    container.querySelectorAll('.btn-focus-timer').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const taskId = btn.dataset.id;
            switchTab('pomodoro');
            const select = document.getElementById('timerTaskSelect');
            if (select) {
                select.value = taskId;
                state.pomodoro.selectedTaskId = taskId;
            }
        });
    });
}

function formatDeadline(dueStr, isCompleted) {
    if (isCompleted) {
        return { text: 'Completed', className: 'text-success' };
    }
    if (!dueStr) return { text: 'No due date', className: '' };

    try {
        const due = new Date(dueStr);
        const now = new Date();
        const diffMs = due - now;
        const diffHours = Math.round(diffMs / (1000 * 60 * 60));
        const diffDays = Math.round(diffHours / 24);

        if (diffMs < 0) {
            return { text: `Overdue by ${Math.abs(diffDays) > 0 ? Math.abs(diffDays) + 'd' : Math.abs(diffHours) + 'h'}`, className: 'urgent' };
        } else if (diffHours <= 24) {
            const timeStr = due.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return { text: `Today ${timeStr}`, className: 'due-today' };
        } else if (diffDays === 1) {
            return { text: 'Tomorrow', className: 'due-today' };
        } else {
            return { text: `Due in ${diffDays} days`, className: '' };
        }
    } catch {
        return { text: dueStr, className: '' };
    }
}

// ==========================================================================
// Kanban Board
// ==========================================================================
function renderKanban() {
    const colTodo = document.getElementById('kanbanDropTodo');
    const colProg = document.getElementById('kanbanDropProgress');
    const colDone = document.getElementById('kanbanDropDone');
    if (!colTodo || !colProg || !colDone) return;

    colTodo.innerHTML = '';
    colProg.innerHTML = '';
    colDone.innerHTML = '';

    let todoCount = 0;
    let progCount = 0;
    let doneCount = 0;

    state.tasks.forEach(task => {
        const card = createKanbanCardElement(task);
        if (task.status === 'todo') {
            colTodo.appendChild(card);
            todoCount++;
        } else if (task.status === 'in_progress') {
            colProg.appendChild(card);
            progCount++;
        } else if (task.status === 'completed') {
            colDone.appendChild(card);
            doneCount++;
        }
    });

    document.getElementById('kanbanBadgeTodo').textContent = todoCount;
    document.getElementById('kanbanBadgeProgress').textContent = progCount;
    document.getElementById('kanbanBadgeDone').textContent = doneCount;
    document.getElementById('kanbanCountBadge').textContent = todoCount + progCount;
}

function createKanbanCardElement(task) {
    const div = document.createElement('div');
    div.className = 'kanban-card';
    div.setAttribute('draggable', 'true');
    div.dataset.taskId = task.id;

    const courseColor = task.course_color || '#6366f1';
    const courseCode = task.course_code || 'General';

    div.innerHTML = `
        <div class="task-card-header" style="margin-bottom:6px;">
            <div class="task-badges">
                <span class="badge-course" style="background:${courseColor}">${escapeHtml(courseCode)}</span>
                <span class="priority-tag priority-${task.priority.toLowerCase()}">${escapeHtml(task.priority)}</span>
            </div>
            <button class="card-action-btn btn-edit-task" data-id="${task.id}" title="Edit">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
                </svg>
            </button>
        </div>
        <h4 class="kanban-card-title">${escapeHtml(task.title)}</h4>
        <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; color:var(--text-muted); margin-top:8px;">
            <span>⏱ ${task.estimated_hours}h est.</span>
            <span>${task.subtasks_total > 0 ? `✓ ${task.subtasks_completed}/${task.subtasks_total}` : ''}</span>
        </div>
    `;

    // Edit button inside kanban card
    div.querySelector('.btn-edit-task').addEventListener('click', (e) => {
        e.stopPropagation();
        openEditTaskModal(task.id);
    });

    return div;
}

function setupDragAndDrop() {
    let draggedTaskId = null;

    document.addEventListener('dragstart', (e) => {
        const card = e.target.closest('.kanban-card');
        if (card) {
            draggedTaskId = card.dataset.taskId;
            card.classList.add('dragging');
            e.dataTransfer.setData('text/plain', draggedTaskId);
        }
    });

    document.addEventListener('dragend', (e) => {
        const card = e.target.closest('.kanban-card');
        if (card) {
            card.classList.remove('dragging');
        }
        document.querySelectorAll('.kanban-dropzone').forEach(dz => dz.classList.remove('drag-over'));
    });

    const dropzones = document.querySelectorAll('.kanban-dropzone');
    dropzones.forEach(dz => {
        dz.addEventListener('dragover', (e) => {
            e.preventDefault();
            dz.classList.add('drag-over');
        });

        dz.addEventListener('dragleave', () => {
            dz.classList.remove('drag-over');
        });

        dz.addEventListener('drop', async (e) => {
            e.preventDefault();
            dz.classList.remove('drag-over');
            const col = dz.closest('.kanban-col');
            const targetStatus = col.dataset.status;

            if (draggedTaskId && targetStatus) {
                await updateTaskStatus(draggedTaskId, targetStatus);
            }
        });
    });
}

// ==========================================================================
// Academic Calendar & Study Planner (Phase 5)
// ==========================================================================

function formatLocalDateISO(d) {
    if (!d) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getCalendarEventsForDate(dateStr) {
    // 1. Tasks due on this date (uses allTasks pool to remain immune to dashboard search/status filters)
    const taskPool = (state.allTasks && state.allTasks.length > 0) ? state.allTasks : state.tasks;
    let dayTasks = taskPool.filter(t => t.due_date && t.due_date.startsWith(dateStr));

    // Completed filter
    if (!state.calShowCompleted) {
        dayTasks = dayTasks.filter(t => t.status !== 'completed');
    }

    // Category / Type filter
    if (state.calendarFilter === 'Assignment') {
        dayTasks = dayTasks.filter(t => t.category === 'Assignment' || t.category === 'Homework' || t.category === 'Reading' || t.category === 'Lab');
    } else if (state.calendarFilter === 'Exam' || state.calendarFilter === 'Project') {
        dayTasks = dayTasks.filter(t => t.category === state.calendarFilter);
    } else if (state.calendarFilter === 'StudySession') {
        dayTasks = [];
    }

    // 2. Study sessions scheduled for this date
    let daySessions = (state.studySessions || []).filter(s => s.session_date === dateStr);
    if (state.calendarFilter !== 'all' && state.calendarFilter !== 'StudySession') {
        daySessions = [];
    }

    return { dayTasks, daySessions };
}

function renderCalendar() {
    const monthTitle = document.getElementById('calendarMonthTitle');
    const monthContainer = document.getElementById('calendarMonthContainer');
    const weekContainer = document.getElementById('calendarWeekContainer');
    const dayContainer = document.getElementById('calendarDayContainer');
    if (!monthTitle) return;

    // Update view switcher buttons
    document.querySelectorAll('.cal-view-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === state.calendarView);
    });

    if (state.calendarView === 'month') {
        if (monthContainer) monthContainer.style.display = 'block';
        if (weekContainer) weekContainer.style.display = 'none';
        if (dayContainer) dayContainer.style.display = 'none';
        renderMonthView();
    } else if (state.calendarView === 'week') {
        if (monthContainer) monthContainer.style.display = 'none';
        if (weekContainer) weekContainer.style.display = 'block';
        if (dayContainer) dayContainer.style.display = 'none';
        renderWeekView();
    } else if (state.calendarView === 'day') {
        if (monthContainer) monthContainer.style.display = 'none';
        if (weekContainer) weekContainer.style.display = 'none';
        if (dayContainer) dayContainer.style.display = 'block';
        renderDayView();
    }
}

// 1. MONTH VIEW
function renderMonthView() {
    const monthTitle = document.getElementById('calendarMonthTitle');
    const daysGrid = document.getElementById('calendarDaysGrid');
    if (!monthTitle || !daysGrid) return;

    const currentYear = state.calendarDate.getFullYear();
    const currentMonth = state.calendarDate.getMonth();

    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    monthTitle.textContent = `${monthNames[currentMonth]} ${currentYear}`;

    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
    const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();
    const prevMonthDays = new Date(currentYear, currentMonth, 0).getDate();

    daysGrid.innerHTML = '';

    const todayStr = formatLocalDateISO(new Date());

    // Previous month padding days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
        const dayNum = prevMonthDays - i;
        const cell = document.createElement('div');
        cell.className = 'calendar-day-cell other-month';
        cell.innerHTML = `<span class="day-cell-number">${dayNum}</span>`;
        daysGrid.appendChild(cell);
    }

    // Days of current month
    for (let day = 1; day <= totalDays; day++) {
        const cellDate = new Date(currentYear, currentMonth, day);
        const dateStr = formatLocalDateISO(cellDate);
        const { dayTasks, daySessions } = getCalendarEventsForDate(dateStr);

        const cell = document.createElement('div');
        cell.className = 'calendar-day-cell';
        if (dateStr === todayStr) {
            cell.classList.add('is-today');
        }

        const dayNumSpan = document.createElement('span');
        dayNumSpan.className = 'day-cell-number';
        dayNumSpan.textContent = day;
        cell.appendChild(dayNumSpan);

        const allItems = [
            ...dayTasks.map(t => ({ type: 'task', data: t })),
            ...daySessions.map(s => ({ type: 'session', data: s }))
        ];

        const visibleItems = allItems.slice(0, 3);
        visibleItems.forEach(item => {
            if (item.type === 'task') {
                const task = item.data;
                const isCompleted = task.status === 'completed';
                const isOverdue = !isCompleted && task.is_overdue;
                let bg = task.course_color || '#6366f1';
                if (task.category === 'Exam') {
                    bg = '#ec4899';
                } else if (task.category === 'Project') {
                    bg = task.course_color || '#8b5cf6';
                }

                const pill = document.createElement('div');
                pill.className = `day-event-pill ${isCompleted ? 'is-completed' : ''} ${isOverdue ? 'is-overdue' : ''}`;
                pill.style.background = bg;
                pill.title = `${task.title} [${task.priority}] · ${task.category}${isOverdue ? ' (OVERDUE)' : ''}${isCompleted ? ' (Completed)' : ''}`;
                pill.innerHTML = `
                    <span>${task.category === 'Exam' ? '⚡' : '📌'}</span>
                    <span style="overflow:hidden; text-overflow:ellipsis;">${escapeHtml(task.title)}</span>
                `;
                pill.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openEditTaskModal(task.id);
                });
                cell.appendChild(pill);
            } else {
                const session = item.data;
                const pill = document.createElement('div');
                pill.className = 'day-event-pill is-study-session';
                pill.title = `Study: ${session.topic || 'Session'} (${session.duration_minutes || 60}m)`;
                pill.innerHTML = `
                    <span>🎯</span>
                    <span style="overflow:hidden; text-overflow:ellipsis;">${escapeHtml(session.topic || 'Study Session')}</span>
                `;
                pill.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openEditStudySessionModal(session.id);
                });
                cell.appendChild(pill);
            }
        });

        if (allItems.length > 3) {
            const moreSpan = document.createElement('span');
            moreSpan.className = 'day-more-pill';
            moreSpan.textContent = `+${allItems.length - 3} more`;
            cell.appendChild(moreSpan);
        }

        cell.addEventListener('click', () => {
            showDayDetails(dateStr, dayTasks, daySessions, day, monthNames[currentMonth], currentYear);
        });

        daysGrid.appendChild(cell);
    }
}

// 2. WEEK VIEW
function renderWeekView() {
    const monthTitle = document.getElementById('calendarMonthTitle');
    const headerGrid = document.getElementById('calendarWeekHeaderGrid');
    const daysGrid = document.getElementById('calendarWeekDaysGrid');
    if (!monthTitle || !headerGrid || !daysGrid) return;

    const current = new Date(state.calendarDate);
    const dayOfWeek = current.getDay(); // 0 = Sun
    const startOfWeek = new Date(current);
    startOfWeek.setDate(current.getDate() - dayOfWeek);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    const startMonth = startOfWeek.toLocaleDateString(undefined, { month: 'short' });
    const endMonth = endOfWeek.toLocaleDateString(undefined, { month: 'short' });
    const yearStr = endOfWeek.getFullYear();

    if (startMonth === endMonth) {
        monthTitle.textContent = `${startMonth} ${startOfWeek.getDate()} – ${endOfWeek.getDate()}, ${yearStr}`;
    } else {
        monthTitle.textContent = `${startMonth} ${startOfWeek.getDate()} – ${endMonth} ${endOfWeek.getDate()}, ${yearStr}`;
    }

    headerGrid.innerHTML = '';
    daysGrid.innerHTML = '';

    const todayStr = formatLocalDateISO(new Date());
    const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

    for (let i = 0; i < 7; i++) {
        const dayDate = new Date(startOfWeek);
        dayDate.setDate(startOfWeek.getDate() + i);
        const dateStr = formatLocalDateISO(dayDate);
        const isToday = dateStr === todayStr;

        // Header cell
        const headerCell = document.createElement('div');
        headerCell.className = `week-header-cell ${isToday ? 'is-today' : ''}`;
        headerCell.style.cursor = 'pointer';
        headerCell.title = 'Click to switch to Day View';
        headerCell.innerHTML = `
            <span class="week-day-name">${dayNames[i]}</span>
            <span class="week-day-num">${dayDate.getDate()}</span>
        `;
        headerCell.addEventListener('click', () => {
            state.calendarDate = new Date(dayDate);
            state.calendarView = 'day';
            renderCalendar();
        });
        headerGrid.appendChild(headerCell);

        // Day Column
        const dayCol = document.createElement('div');
        dayCol.className = `week-day-col ${isToday ? 'is-today' : ''}`;

        const { dayTasks, daySessions } = getCalendarEventsForDate(dateStr);

        if (dayTasks.length === 0 && daySessions.length === 0) {
            dayCol.innerHTML = `<span class="empty-planner-hint" style="margin-top:20px;">No events</span>`;
        } else {
            // Render Tasks
            dayTasks.forEach(task => {
                const isCompleted = task.status === 'completed';
                const isOverdue = !isCompleted && task.is_overdue;
                let bg = task.course_color || '#6366f1';
                if (task.category === 'Exam') {
                    bg = '#ec4899';
                } else if (task.category === 'Project') {
                    bg = task.course_color || '#8b5cf6';
                }

                const card = document.createElement('div');
                card.className = `planner-item-card ${isOverdue ? 'is-overdue' : ''}`;
                card.style.borderLeft = `3px solid ${bg}`;
                if (isCompleted) card.style.opacity = '0.6';

                card.innerHTML = `
                    <div class="planner-item-title" style="${isCompleted ? 'text-decoration:line-through;' : ''}${isOverdue ? 'color:var(--danger);' : ''}">
                        ${task.category === 'Exam' ? '⚡' : '📌'} ${escapeHtml(task.title)}
                    </div>
                    <div class="planner-item-meta">
                        <span class="badge-course" style="background:${task.course_color || '#6366f1'}">${escapeHtml(task.course_code || 'General')}</span>
                        <span class="priority-badge ${task.priority.toLowerCase()}">${escapeHtml(task.priority)}</span>
                    </div>
                `;
                card.addEventListener('click', () => openEditTaskModal(task.id));
                dayCol.appendChild(card);
            });

            // Render Study Sessions
            daySessions.forEach(session => {
                const card = document.createElement('div');
                card.className = 'planner-item-card';
                card.style.borderLeft = '3px solid #06b6d4';

                card.innerHTML = `
                    <div class="planner-item-title" style="color:#06b6d4;">
                        🎯 ${escapeHtml(session.topic || 'Study Session')}
                    </div>
                    <div class="planner-item-meta">
                        <span>${session.start_time ? session.start_time : session.duration_minutes + 'm'}</span>
                        <span class="badge-course" style="background:${session.course_color || '#06b6d4'}">${escapeHtml(session.course_code || 'General')}</span>
                    </div>
                `;
                card.addEventListener('click', () => openEditStudySessionModal(session.id));
                dayCol.appendChild(card);
            });
        }

        daysGrid.appendChild(dayCol);
    }
}

// 3. DAY VIEW
function renderDayView() {
    const monthTitle = document.getElementById('calendarMonthTitle');
    const heading = document.getElementById('dayViewDateHeading');
    const tasksList = document.getElementById('dayViewTasksList');
    const sessionsList = document.getElementById('dayViewSessionsList');
    if (!heading || !tasksList || !sessionsList) return;

    const curr = state.calendarDate;
    const dateStr = formatLocalDateISO(curr);

    const fullDateText = curr.toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    heading.textContent = fullDateText;
    if (monthTitle) {
        monthTitle.textContent = curr.toLocaleDateString(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    }

    const { dayTasks, daySessions } = getCalendarEventsForDate(dateStr);

    // Tasks list
    if (dayTasks.length === 0) {
        tasksList.innerHTML = `<p class="empty-planner-hint" style="padding:24px 0;">No tasks or coursework deadlines for this day.</p>`;
    } else {
        tasksList.innerHTML = dayTasks.map(task => {
            const isCompleted = task.status === 'completed';
            const isOverdue = !isCompleted && task.is_overdue;
            const bg = task.course_color || '#6366f1';

            return `
                <div class="day-item-card ${isOverdue ? 'is-overdue' : ''}" data-task-id="${task.id}">
                    <div class="day-item-main">
                        <div class="day-item-title" style="${isCompleted ? 'text-decoration:line-through;opacity:0.6;' : ''}${isOverdue ? 'color:var(--danger);' : ''}">
                            ${escapeHtml(task.title)}
                        </div>
                        <div class="day-item-meta">
                            <span class="badge-course" style="background:${bg}">${escapeHtml(task.course_code || 'General')}</span>
                            <span class="badge-category">${escapeHtml(task.category)}</span>
                            <span class="priority-badge ${task.priority.toLowerCase()}">${escapeHtml(task.priority)}</span>
                            <span class="status-chip ${task.status}">${task.status.replace('_', ' ')}</span>
                            ${isOverdue ? '<span style="color:var(--danger);font-weight:700;">⚠️ OVERDUE</span>' : ''}
                        </div>
                    </div>
                    <button type="button" class="btn btn-outline btn-sm btn-edit-day-task" data-id="${task.id}">Edit</button>
                </div>
            `;
        }).join('');

        tasksList.querySelectorAll('.btn-edit-day-task').forEach(b => {
            b.addEventListener('click', (e) => {
                e.stopPropagation();
                openEditTaskModal(b.dataset.id);
            });
        });
        tasksList.querySelectorAll('.day-item-card').forEach(c => {
            c.addEventListener('click', () => openEditTaskModal(c.dataset.taskId));
        });
    }

    // Study Sessions list
    if (daySessions.length === 0) {
        sessionsList.innerHTML = `<p class="empty-planner-hint" style="padding:24px 0;">No study sessions planned for this day.</p>`;
    } else {
        sessionsList.innerHTML = daySessions.map(session => `
            <div class="day-item-card is-study-session" data-session-id="${session.id}">
                <div class="day-item-main">
                    <div class="day-item-title" style="color:#06b6d4;">
                        🎯 ${escapeHtml(session.topic || 'Study Session')}
                    </div>
                    <div class="day-item-meta">
                        <span class="badge-course" style="background:${session.course_color || '#06b6d4'}">${escapeHtml(session.course_code || 'General')}</span>
                        <span>⏱️ ${session.start_time ? session.start_time + ' – ' + (session.end_time || '') : ''} (${session.duration_minutes || 60} mins)</span>
                        ${session.task_title ? `<span style="color:var(--text-muted);">📋 Task: ${escapeHtml(session.task_title)}</span>` : ''}
                    </div>
                    ${session.notes ? `<p style="font-size:0.78rem; color:var(--text-secondary); margin:6px 0 0 0;">${escapeHtml(session.notes)}</p>` : ''}
                </div>
                <button type="button" class="btn btn-outline btn-sm btn-edit-day-session" data-id="${session.id}">Edit</button>
            </div>
        `).join('');

        sessionsList.querySelectorAll('.btn-edit-day-session').forEach(b => {
            b.addEventListener('click', (e) => {
                e.stopPropagation();
                openEditStudySessionModal(b.dataset.id);
            });
        });
        sessionsList.querySelectorAll('.day-item-card.is-study-session').forEach(c => {
            c.addEventListener('click', () => openEditStudySessionModal(c.dataset.sessionId));
        });
    }
}

// 4. DAY DETAILS DRAWER (FOR MONTH VIEW CLICKS)
function showDayDetails(dateStr, tasks, sessions, day, monthName, year) {
    const detailsContainer = document.getElementById('calendarDayDetails');
    const titleEl = document.getElementById('selectedDateTitle');
    const listEl = document.getElementById('selectedDateTasksList');
    if (!detailsContainer || !titleEl || !listEl) return;

    titleEl.textContent = `Schedule for ${monthName} ${day}, ${year}`;
    detailsContainer.style.display = 'block';

    const allEmpty = tasks.length === 0 && sessions.length === 0;

    if (allEmpty) {
        listEl.innerHTML = `
            <p style="color:var(--text-muted); padding:10px 0;">No tasks or study sessions scheduled for this day.</p>
            <div style="display:flex; gap:8px; margin-top:8px;">
                <button type="button" class="btn btn-primary btn-sm" id="quickAddTaskDayDrawerBtn">+ Add Task</button>
                <button type="button" class="btn btn-secondary btn-sm" id="quickAddSessionDayDrawerBtn">+ Plan Study Session</button>
                <button type="button" class="btn btn-outline btn-sm" id="jumpToDayViewBtn">View in Day View</button>
            </div>
        `;
        const qTaskBtn = document.getElementById('quickAddTaskDayDrawerBtn');
        if (qTaskBtn) {
            qTaskBtn.addEventListener('click', () => {
                detailsContainer.style.display = 'none';
                openAddTaskModal(dateStr);
            });
        }
        const qSessBtn = document.getElementById('quickAddSessionDayDrawerBtn');
        if (qSessBtn) {
            qSessBtn.addEventListener('click', () => {
                detailsContainer.style.display = 'none';
                openAddStudySessionModal(dateStr);
            });
        }
        const jumpDayBtn = document.getElementById('jumpToDayViewBtn');
        if (jumpDayBtn) {
            jumpDayBtn.addEventListener('click', () => {
                detailsContainer.style.display = 'none';
                state.calendarDate = parseLocalDate(dateStr);
                state.calendarView = 'day';
                renderCalendar();
            });
        }
        return;
    }

    let html = '';

    // Render Tasks
    if (tasks.length > 0) {
        html += `<h5 style="margin:8px 0 6px 0; font-size:0.82rem; color:var(--text-muted);">TASKS & DEADLINES</h5>`;
        html += tasks.map(task => {
            const isCompleted = task.status === 'completed';
            const isOverdue = !isCompleted && task.is_overdue;
            return `
                <div class="session-item" data-task-id="${task.id}" style="margin-bottom:8px; cursor:pointer; ${isOverdue ? 'border-left:3px solid var(--danger);' : ''}">
                    <div>
                        <span class="badge-course" style="background:${task.course_color || '#6366f1'}">${escapeHtml(task.course_code || 'General')}</span>
                        <strong style="margin-left:8px; ${isCompleted ? 'text-decoration:line-through;opacity:0.6;' : ''}${isOverdue ? 'color:var(--danger);' : ''}">
                            ${escapeHtml(task.title)}
                        </strong>
                        <span style="font-size:0.75rem; color:var(--text-muted); margin-left:8px;">(${escapeHtml(task.priority)})</span>
                        ${isOverdue ? '<span style="font-size:0.7rem; color:var(--danger); font-weight:700; margin-left:4px;">OVERDUE</span>' : ''}
                    </div>
                    <button class="btn btn-outline btn-sm btn-drawer-edit-task" data-id="${task.id}">Open</button>
                </div>
            `;
        }).join('');
    }

    // Render Study Sessions
    if (sessions.length > 0) {
        html += `<h5 style="margin:12px 0 6px 0; font-size:0.82rem; color:#06b6d4;">STUDY SESSIONS</h5>`;
        html += sessions.map(s => `
            <div class="session-item" data-session-id="${s.id}" style="margin-bottom:8px; cursor:pointer; border-left:3px solid #06b6d4;">
                <div>
                    <span class="badge-course" style="background:${s.course_color || '#06b6d4'}">${escapeHtml(s.course_code || 'General')}</span>
                    <strong style="margin-left:8px; color:#06b6d4;">🎯 ${escapeHtml(s.topic || 'Study Session')}</strong>
                    <span style="font-size:0.75rem; color:var(--text-muted); margin-left:8px;">${s.duration_minutes || 60}m</span>
                </div>
                <button class="btn btn-outline btn-sm btn-drawer-edit-session" data-id="${s.id}">Edit</button>
            </div>
        `).join('');
    }

    html += `
        <div style="display:flex; gap:8px; margin-top:12px; padding-top:8px; border-top:1px solid rgba(255,255,255,0.06);">
            <button type="button" class="btn btn-primary btn-sm" id="quickAddTaskDayDrawerBtn">+ Add Task</button>
            <button type="button" class="btn btn-secondary btn-sm" id="quickAddSessionDayDrawerBtn">+ Plan Study Session</button>
            <button type="button" class="btn btn-outline btn-sm" id="jumpToDayViewBtn">View in Day View</button>
        </div>
    `;

    listEl.innerHTML = html;

    listEl.querySelectorAll('.btn-drawer-edit-task').forEach(b => {
        b.addEventListener('click', (e) => {
            e.stopPropagation();
            detailsContainer.style.display = 'none';
            openEditTaskModal(b.dataset.id);
        });
    });

    listEl.querySelectorAll('.btn-drawer-edit-session').forEach(b => {
        b.addEventListener('click', (e) => {
            e.stopPropagation();
            detailsContainer.style.display = 'none';
            openEditStudySessionModal(b.dataset.id);
        });
    });

    listEl.querySelectorAll('.session-item[data-task-id]').forEach(item => {
        item.addEventListener('click', () => {
            detailsContainer.style.display = 'none';
            openEditTaskModal(item.dataset.taskId);
        });
    });

    listEl.querySelectorAll('.session-item[data-session-id]').forEach(item => {
        item.addEventListener('click', () => {
            detailsContainer.style.display = 'none';
            openEditStudySessionModal(item.dataset.sessionId);
        });
    });

    const qTaskBtn = document.getElementById('quickAddTaskDayDrawerBtn');
    if (qTaskBtn) {
        qTaskBtn.addEventListener('click', () => {
            detailsContainer.style.display = 'none';
            openAddTaskModal(dateStr);
        });
    }
    const qSessBtn = document.getElementById('quickAddSessionDayDrawerBtn');
    if (qSessBtn) {
        qSessBtn.addEventListener('click', () => {
            detailsContainer.style.display = 'none';
            openAddStudySessionModal(dateStr);
        });
    }

    const jumpDayBtn = document.getElementById('jumpToDayViewBtn');
    if (jumpDayBtn) {
        jumpDayBtn.addEventListener('click', () => {
            detailsContainer.style.display = 'none';
            state.calendarDate = parseLocalDate(dateStr);
            state.calendarView = 'day';
            renderCalendar();
        });
    }
}

// ==========================================================================
// Study Planner Modal & CRUD Logic
// ==========================================================================

async function loadStudySessions() {
    try {
        const res = await authFetch('/api/study-sessions');
        if (res.status === 401) return;
        const data = await res.json();
        if (data.success) {
            state.studySessions = data.sessions || [];
        }
    } catch (err) {
        console.error('Failed to load study sessions', err);
    }
}

function populateSessionSelects() {
    const courseSel = document.getElementById('sessionInputCourse');
    const taskSel = document.getElementById('sessionInputTask');

    if (courseSel) {
        const currentCourse = courseSel.value;
        courseSel.innerHTML = '<option value="">No Course (General)</option>';
        (state.courses || []).forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = `${c.code} - ${c.name}`;
            courseSel.appendChild(opt);
        });
        courseSel.value = currentCourse;
    }

    if (taskSel) {
        const currentTask = taskSel.value;
        taskSel.innerHTML = '<option value="">No Specific Task</option>';
        (state.tasks || []).filter(t => t.status !== 'completed').forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.id;
            opt.textContent = `${t.course_code ? '[' + t.course_code + '] ' : ''}${t.title}`;
            taskSel.appendChild(opt);
        });
        taskSel.value = currentTask;
    }
}

function openAddStudySessionModal(prefillDate) {
    const modal = document.getElementById('studySessionModal');
    if (!modal) return;

    document.getElementById('modalSessionTitle').textContent = 'Plan Study Session';
    document.getElementById('sessionFormId').value = '';
    document.getElementById('sessionInputTopic').value = '';
    document.getElementById('sessionInputNotes').value = '';

    populateSessionSelects();
    document.getElementById('sessionInputCourse').value = '';
    document.getElementById('sessionInputTask').value = '';

    const defaultDate = prefillDate || formatLocalDateISO(state.calendarDate || new Date());
    document.getElementById('sessionInputDate').value = defaultDate;
    document.getElementById('sessionInputStartTime').value = '14:00';
    document.getElementById('sessionInputEndTime').value = '15:00';
    document.getElementById('sessionInputDuration').value = 60;

    const delBtn = document.getElementById('deleteSessionBtn');
    if (delBtn) delBtn.style.display = 'none';

    modal.classList.add('open');
}

function closeStudySessionModal() {
    const modal = document.getElementById('studySessionModal');
    if (modal) modal.classList.remove('open');
}

async function openEditStudySessionModal(sessionId) {
    const modal = document.getElementById('studySessionModal');
    if (!modal) return;

    let session = (state.studySessions || []).find(s => String(s.id) === String(sessionId));
    if (!session) {
        try {
            const res = await authFetch(`/api/study-sessions/${sessionId}`);
            const data = await res.json();
            if (data.success) {
                session = data.session;
            }
        } catch (err) {
            console.error('Error fetching session details', err);
        }
    }
    if (!session) {
        showToast('Study session not found', 'error');
        return;
    }

    document.getElementById('modalSessionTitle').textContent = 'Edit Study Session';
    document.getElementById('sessionFormId').value = session.id;
    document.getElementById('sessionInputTopic').value = session.topic || '';
    document.getElementById('sessionInputNotes').value = session.notes || '';

    populateSessionSelects();
    document.getElementById('sessionInputCourse').value = session.course_id || '';
    document.getElementById('sessionInputTask').value = session.task_id || '';

    document.getElementById('sessionInputDate').value = session.session_date || '';
    document.getElementById('sessionInputStartTime').value = session.start_time || '14:00';
    document.getElementById('sessionInputEndTime').value = session.end_time || '15:00';
    document.getElementById('sessionInputDuration').value = session.duration_minutes || 60;

    const delBtn = document.getElementById('deleteSessionBtn');
    if (delBtn) {
        delBtn.style.display = 'inline-flex';
        delBtn.onclick = () => deleteStudySession(session.id);
    }

    modal.classList.add('open');
}

async function handleStudySessionSubmit(e) {
    e.preventDefault();
    const sessionId = document.getElementById('sessionFormId').value;
    const topic = document.getElementById('sessionInputTopic').value.trim();
    const sessionDate = document.getElementById('sessionInputDate').value.trim();

    if (!topic) {
        showToast('Study topic is required.', 'error');
        document.getElementById('sessionInputTopic').focus();
        return;
    }
    if (!sessionDate) {
        showToast('Session date is required.', 'error');
        document.getElementById('sessionInputDate').focus();
        return;
    }

    const startTime = document.getElementById('sessionInputStartTime').value.trim();
    const endTime = document.getElementById('sessionInputEndTime').value.trim();
    const duration = parseInt(document.getElementById('sessionInputDuration').value, 10) || 60;

    const payload = {
        topic: topic,
        course_id: document.getElementById('sessionInputCourse').value || null,
        task_id: document.getElementById('sessionInputTask').value || null,
        session_date: sessionDate,
        start_time: startTime || null,
        end_time: endTime || null,
        duration_minutes: duration,
        notes: document.getElementById('sessionInputNotes').value.trim()
    };

    const submitBtn = document.getElementById('saveSessionSubmitBtn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving...';
    }

    try {
        const url = sessionId ? `/api/study-sessions/${sessionId}` : '/api/study-sessions';
        const method = sessionId ? 'PUT' : 'POST';

        const res = await authFetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
            closeStudySessionModal();
            showToast(sessionId ? 'Study session updated!' : 'Study session scheduled!', 'success');
            await loadStudySessions();
            await loadAnalytics();
            loadRecentStudySessions();
            renderCalendar();
        } else {
            showToast(data.message || 'Error saving study session', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Failed to save study session', 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Save Session';
        }
    }
}

async function deleteStudySession(sessionId) {
    if (!sessionId) return;
    const confirmed = await showConfirmModal({
        title: 'Delete Study Session',
        message: 'Are you sure you want to delete this study session? This action cannot be undone.',
        confirmText: 'Delete Session',
        isDanger: true
    });
    if (!confirmed) return;

    try {
        const res = await authFetch(`/api/study-sessions/${sessionId}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            closeStudySessionModal();
            showToast('Study session deleted', 'info');
            await loadStudySessions();
            await loadAnalytics();
            loadRecentStudySessions();
            renderCalendar();
        } else {
            showToast(data.message || 'Failed to delete study session', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Failed to delete study session', 'error');
    }
}

// ==========================================================================
// Pomodoro Focus Timer
// ==========================================================================
function setupPomodoroTimer() {
    const startBtn = document.getElementById('startTimerBtn');
    const resetBtn = document.getElementById('resetTimerBtn');
    const soundBtn = document.getElementById('soundToggleBtn');
    const modeButtons = document.querySelectorAll('.timer-mode-btn');

    if (startBtn) {
        startBtn.addEventListener('click', togglePomodoro);
    }
    if (resetBtn) {
        resetBtn.addEventListener('click', resetPomodoro);
    }
    if (soundBtn) {
        soundBtn.addEventListener('click', () => {
            state.pomodoro.soundEnabled = !state.pomodoro.soundEnabled;
            soundBtn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                    ${state.pomodoro.soundEnabled ? '<path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>' : '<line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>'}
                </svg>
                Sound: ${state.pomodoro.soundEnabled ? 'ON' : 'OFF'}
            `;
        });
    }

    modeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            modeButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const minutes = parseInt(btn.dataset.time, 10);
            state.pomodoro.mode = btn.dataset.mode;
            state.pomodoro.totalSeconds = minutes * 60;
            state.pomodoro.remainingSeconds = minutes * 60;
            clearInterval(state.pomodoro.timer);
            state.pomodoro.isRunning = false;
            updatePomodoroDisplay();
            updateStartButtonUI(false);
            const statusLabel = document.getElementById('pomodoroStatusLabel');
            if (statusLabel) {
                statusLabel.textContent = state.pomodoro.mode === 'pomodoro' ? 'READY TO STUDY' : 'BREAK TIME';
            }
        });
    });

    updatePomodoroDisplay();
}

function togglePomodoro() {
    if (state.pomodoro.isRunning) {
        // Pause
        clearInterval(state.pomodoro.timer);
        state.pomodoro.isRunning = false;
        updateStartButtonUI(false);
    } else {
        // Start
        state.pomodoro.isRunning = true;
        updateStartButtonUI(true);
        state.pomodoro.timer = setInterval(() => {
            if (state.pomodoro.remainingSeconds > 0) {
                state.pomodoro.remainingSeconds--;
                updatePomodoroDisplay();
            } else {
                clearInterval(state.pomodoro.timer);
                state.pomodoro.isRunning = false;
                updateStartButtonUI(false);
                handlePomodoroFinished();
            }
        }, 1000);
    }
}

function resetPomodoro() {
    clearInterval(state.pomodoro.timer);
    state.pomodoro.isRunning = false;
    state.pomodoro.remainingSeconds = state.pomodoro.totalSeconds;
    updatePomodoroDisplay();
    updateStartButtonUI(false);
}

function updatePomodoroDisplay() {
    const mins = Math.floor(state.pomodoro.remainingSeconds / 60);
    const secs = state.pomodoro.remainingSeconds % 60;
    const str = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    const display = document.getElementById('pomodoroDisplay');
    if (display) display.textContent = str;

    // Ring progress calculation (r=120, circumference = 2 * PI * 120 ≈ 754)
    const ring = document.getElementById('timerProgressRing');
    if (ring) {
        const circumference = 2 * Math.PI * 120;
        const progress = state.pomodoro.remainingSeconds / state.pomodoro.totalSeconds;
        const offset = circumference * (1 - progress);
        ring.style.strokeDashoffset = offset;
    }
}

function updateStartButtonUI(isRunning) {
    const btn = document.getElementById('startTimerBtn');
    const text = document.getElementById('startBtnText');
    const icon = document.getElementById('playIcon');
    if (!btn || !text || !icon) return;

    if (isRunning) {
        text.textContent = 'Pause Focus';
        icon.innerHTML = `<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>`;
    } else {
        text.textContent = state.pomodoro.remainingSeconds < state.pomodoro.totalSeconds ? 'Resume' : 'Start Focus';
        icon.innerHTML = `<polygon points="5 3 19 12 5 21 5 3"/>`;
    }
}

async function handlePomodoroFinished() {
    if (state.pomodoro.soundEnabled) {
        playPomodoroBell();
    }
    triggerConfetti();

    const isStudySession = state.pomodoro.mode === 'pomodoro';
    const duration = Math.round(state.pomodoro.totalSeconds / 60);
    const selectedTask = document.getElementById('timerTaskSelect').value;

    if (isStudySession) {
        showToast(`🎉 Focus session complete! Logged ${duration} mins of deep study.`, 'success');
        try {
            await authFetch('/api/study-sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    task_id: selectedTask ? parseInt(selectedTask) : null,
                    duration_minutes: duration,
                    notes: 'Completed Pomodoro study session'
                })
            });
            loadRecentStudySessions();
            loadTasks();
            loadAnalytics();
        } catch (err) {
            console.error('Error logging study session', err);
        }
    } else {
        showToast('Break finished! Time to dive back in.', 'info');
    }
}

async function loadRecentStudySessions() {
    try {
        const res = await authFetch('/api/study-sessions');
        if (res.status === 401) return;
        const data = await res.json();
        if (data.success) {
            const list = document.getElementById('studySessionsList');
            const totalLabel = document.getElementById('totalStudyMinutesLabel');
            if (!list) return;

            const total = data.sessions.reduce((acc, s) => acc + s.duration_minutes, 0);
            if (totalLabel) totalLabel.textContent = `${total} mins logged`;

            if (data.sessions.length === 0) {
                list.innerHTML = `<p style="color:var(--text-muted); font-size:0.85rem; padding:10px 0;">No sessions logged yet today. Hit Start Focus above!</p>`;
                return;
            }

            list.innerHTML = data.sessions.map(s => `
                <div class="session-item">
                    <div>
                        <div class="session-item-title">${escapeHtml(s.task_title || 'General Study Session')}</div>
                        <div class="session-item-time">${formatDateOnly(s.created_at)} · ${s.notes ? escapeHtml(s.notes) : ''}</div>
                    </div>
                    <span class="badge-accent">+${s.duration_minutes}m</span>
                </div>
            `).join('');
        }
    } catch (err) {
        console.error(err);
    }
}

function populatePomodoroTaskSelect() {
    const select = document.getElementById('timerTaskSelect');
    if (!select) return;

    const currentVal = select.value;
    select.innerHTML = '<option value="">General Study (No specific task)</option>';
    state.tasks.filter(t => t.status !== 'completed').forEach(task => {
        const opt = document.createElement('option');
        opt.value = task.id;
        opt.textContent = `[${task.course_code || 'General'}] ${task.title}`;
        select.appendChild(opt);
    });
    if (currentVal) select.value = currentVal;
}

// ==========================================================================
// Analytics View
// ==========================================================================
function renderAnalytics(data) {
    if (!data || !data.overview) return;
    const o = data.overview;

    // Update 5 Core Dashboard metrics from analytics
    const elStudyHours = document.getElementById('statTotalStudyHours');
    const elStudySub = document.getElementById('statStudyHoursSub');
    if (elStudyHours && o.total_study_hours !== undefined) {
        elStudyHours.textContent = `${o.total_study_hours}h`;
    }
    if (elStudySub && o.total_study_sessions !== undefined) {
        elStudySub.textContent = `${o.total_study_sessions} sessions logged`;
    }

    const elCourses = document.getElementById('statTotalCourses');
    if (elCourses && o.total_courses !== undefined) {
        elCourses.textContent = o.total_courses;
    }

    const elAnaPercent = document.getElementById('analyticsPercent');
    if (elAnaPercent) elAnaPercent.textContent = `${o.completion_rate}%`;

    const elAnaDone = document.getElementById('anaDone');
    if (elAnaDone) elAnaDone.textContent = o.completed_tasks;

    const elAnaProg = document.getElementById('anaProg');
    if (elAnaProg) elAnaProg.textContent = o.in_progress_tasks;

    const elAnaTodo = document.getElementById('anaTodo');
    if (elAnaTodo) elAnaTodo.textContent = o.todo_tasks;

    const elAnaSpent = document.getElementById('analyticsSpentHours');
    if (elAnaSpent) elAnaSpent.textContent = `${o.total_spent_hours}h`;

    // Priority Distribution
    const pList = document.getElementById('priorityDistributionList');
    if (pList) {
        const priorities = [
            { name: 'Urgent', color: '#f43f5e', count: data.priority_stats['Urgent'] || 0 },
            { name: 'High', color: '#f97316', count: data.priority_stats['High'] || 0 },
            { name: 'Medium', color: '#f59e0b', count: data.priority_stats['Medium'] || 0 },
            { name: 'Low', color: '#10b981', count: data.priority_stats['Low'] || 0 }
        ];
        const activeTotal = (o.todo_tasks + o.in_progress_tasks) || 1;

        pList.innerHTML = priorities.map(p => {
            const pct = Math.round((p.count / activeTotal) * 100);
            return `
                <div class="priority-bar-item">
                    <div class="p-bar-label">
                        <span>${p.name} Priority</span>
                        <span>${p.count} tasks (${pct}%)</span>
                    </div>
                    <div class="p-bar-track">
                        <div class="p-bar-fill" style="width:${pct}%; background:${p.color}"></div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Courses Table
    const tableBody = document.getElementById('courseAnalyticsTableBody');
    if (tableBody) {
        tableBody.innerHTML = data.course_stats.map(c => {
            const total = c.task_count || 0;
            const completed = c.completed_count || 0;
            const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
            return `
                <tr>
                    <td>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <span class="course-color-dot" style="background:${c.color}"></span>
                            <strong>${escapeHtml(c.code)}</strong>
                            <span style="font-size:0.8rem; color:var(--text-muted)">${escapeHtml(c.name)}</span>
                        </div>
                    </td>
                    <td><strong>${total}</strong></td>
                    <td><span class="text-success">${completed}</span></td>
                    <td>
                        <div style="display:flex; align-items:center; gap:10px;">
                            <div class="p-bar-track" style="width:100px;">
                                <div class="p-bar-fill" style="width:${pct}%; background:${c.color}"></div>
                            </div>
                            <span style="font-size:0.8rem; font-weight:700;">${pct}%</span>
                        </div>
                    </td>
                    <td>${c.hours_spent || 0} hrs</td>
                </tr>
            `;
        }).join('');
    }

    // Topbar Study Streak (Dynamic)
    const streakEl = document.getElementById('topbarStudyStreak');
    if (streakEl) {
        const streak = data.study_streak || 0;
        streakEl.textContent = `${streak} ${streak === 1 ? 'Day' : 'Days'}`;
    }

    // Dashboard Planner Hub
    if (data.planner_hub) {
        renderPlannerHub(data.planner_hub);
    }
}

// ==========================================================================
// Dashboard Planner Hub (Phase 5)
// ==========================================================================
function renderPlannerHub(hub) {
    if (!hub) return;

    // 1. Today's Tasks
    const elCountToday = document.getElementById('dashCountTodayTasks');
    const elListToday = document.getElementById('dashListTodayTasks');
    if (elCountToday && elListToday) {
        const items = hub.today_tasks || [];
        elCountToday.textContent = items.length;
        if (items.length === 0) {
            elListToday.innerHTML = '<p class="empty-planner-hint">No tasks due today. Great job!</p>';
        } else {
            elListToday.innerHTML = items.map(t => `
                <div class="planner-item-card" data-task-id="${t.id}">
                    <div class="planner-item-title">${escapeHtml(t.title)}</div>
                    <div class="planner-item-meta">
                        <span class="badge-course" style="background:${t.course_color || '#6366f1'}">${escapeHtml(t.course_code || 'General')}</span>
                        <span class="priority-badge ${t.priority.toLowerCase()}">${escapeHtml(t.priority)}</span>
                    </div>
                </div>
            `).join('');
            elListToday.querySelectorAll('.planner-item-card').forEach(card => {
                card.addEventListener('click', () => openEditTaskModal(card.dataset.taskId));
            });
        }
    }

    // 2. Overdue Tasks
    const elCountOverdue = document.getElementById('dashCountOverdueTasks');
    const elListOverdue = document.getElementById('dashListOverdueTasks');
    if (elCountOverdue && elListOverdue) {
        const items = hub.overdue_tasks || [];
        elCountOverdue.textContent = items.length;
        if (items.length === 0) {
            elListOverdue.innerHTML = '<p class="empty-planner-hint">No overdue tasks! You\'re all caught up.</p>';
        } else {
            elListOverdue.innerHTML = items.map(t => `
                <div class="planner-item-card" data-task-id="${t.id}" style="border-left:3px solid var(--danger);">
                    <div class="planner-item-title" style="color:var(--danger);">${escapeHtml(t.title)}</div>
                    <div class="planner-item-meta">
                        <span>Due: ${formatShortDate(t.due_date)}</span>
                        <span class="priority-badge ${t.priority.toLowerCase()}">${escapeHtml(t.priority)}</span>
                    </div>
                </div>
            `).join('');
            elListOverdue.querySelectorAll('.planner-item-card').forEach(card => {
                card.addEventListener('click', () => openEditTaskModal(card.dataset.taskId));
            });
        }
    }

    // 3. Upcoming Deadlines (Next 7 Days)
    const elCountUpcoming = document.getElementById('dashCountUpcomingDeadlines');
    const elListUpcoming = document.getElementById('dashListUpcomingDeadlines');
    if (elCountUpcoming && elListUpcoming) {
        const items = hub.upcoming_deadlines || [];
        elCountUpcoming.textContent = items.length;
        if (items.length === 0) {
            elListUpcoming.innerHTML = '<p class="empty-planner-hint">No deadlines in the next 7 days.</p>';
        } else {
            elListUpcoming.innerHTML = items.map(t => `
                <div class="planner-item-card" data-task-id="${t.id}">
                    <div class="planner-item-title">${escapeHtml(t.title)}</div>
                    <div class="planner-item-meta">
                        <span class="badge-course" style="background:${t.course_color || '#6366f1'}">${escapeHtml(t.course_code || 'General')}</span>
                        <span>Due: ${formatShortDate(t.due_date)}</span>
                    </div>
                </div>
            `).join('');
            elListUpcoming.querySelectorAll('.planner-item-card').forEach(card => {
                card.addEventListener('click', () => openEditTaskModal(card.dataset.taskId));
            });
        }
    }

    // 4. Today's Study Sessions
    const elCountTodaySessions = document.getElementById('dashCountTodaySessions');
    const elListTodaySessions = document.getElementById('dashListTodaySessions');
    if (elCountTodaySessions && elListTodaySessions) {
        const items = hub.today_study_sessions || [];
        elCountTodaySessions.textContent = items.length;
        if (items.length === 0) {
            elListTodaySessions.innerHTML = '<p class="empty-planner-hint">No study sessions logged for today.</p>';
        } else {
            elListTodaySessions.innerHTML = items.map(s => `
                <div class="planner-item-card" data-session-id="${s.id}" style="border-left:3px solid #06b6d4;">
                    <div class="planner-item-title" style="color:#06b6d4;">🎯 ${escapeHtml(s.topic || 'Study Session')}</div>
                    <div class="planner-item-meta">
                        <span>${s.start_time ? s.start_time + ' - ' + (s.end_time || '') : (s.duration_minutes || 60) + ' mins'}</span>
                        <span class="badge-course" style="background:${s.course_color || '#06b6d4'}">${escapeHtml(s.course_code || 'General')}</span>
                    </div>
                </div>
            `).join('');
            elListTodaySessions.querySelectorAll('.planner-item-card').forEach(card => {
                card.addEventListener('click', () => openEditStudySessionModal(card.dataset.sessionId));
            });
        }
    }

    // 5. Upcoming Study Sessions
    const elCountUpcomingSessions = document.getElementById('dashCountUpcomingSessions');
    const elListUpcomingSessions = document.getElementById('dashListUpcomingSessions');
    if (elCountUpcomingSessions && elListUpcomingSessions) {
        const items = hub.upcoming_study_sessions || [];
        elCountUpcomingSessions.textContent = items.length;
        if (items.length === 0) {
            elListUpcomingSessions.innerHTML = '<p class="empty-planner-hint">No upcoming study sessions planned yet.</p>';
        } else {
            elListUpcomingSessions.innerHTML = items.map(s => `
                <div class="planner-item-card" data-session-id="${s.id}" style="border-left:3px solid #06b6d4;">
                    <div class="planner-item-title" style="color:#06b6d4;">🎯 ${escapeHtml(s.topic || 'Study Session')}</div>
                    <div class="planner-item-meta">
                        <span>${formatShortDate(s.session_date)}</span>
                        <span>${s.duration_minutes || 60} mins</span>
                    </div>
                </div>
            `).join('');
            elListUpcomingSessions.querySelectorAll('.planner-item-card').forEach(card => {
                card.addEventListener('click', () => openEditStudySessionModal(card.dataset.sessionId));
            });
        }
    }
}

function updateMetricsFromTasks() {
    const total = state.tasks.length;
    const completed = state.tasks.filter(t => t.status === 'completed').length;
    const inProgress = state.tasks.filter(t => t.status === 'in_progress').length;
    const todo = state.tasks.filter(t => t.status === 'todo').length;
    const pending = inProgress + todo;

    const overdue = state.tasks.filter(t => t.is_overdue).length;
    const dueToday = state.tasks.filter(t => {
        if (t.status === 'completed' || !t.due_date) return false;
        const d = new Date(t.due_date);
        const now = new Date();
        return d.toDateString() === now.toDateString();
    }).length;

    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    const coursesCount = state.courses ? state.courses.length : 0;

    // 1. Total Tasks
    const elTotal = document.getElementById('statTotalTasks');
    const elTasksSub = document.getElementById('statTasksSub');
    if (elTotal) elTotal.textContent = total;
    if (elTasksSub) elTasksSub.textContent = total === 1 ? '1 coursework item' : `${total} coursework items`;

    // 2. Pending Tasks (To Do)
    const elPending = document.getElementById('statPendingTasks');
    const elPendingSub = document.getElementById('statPendingSub');
    if (elPending) elPending.textContent = pending;
    if (elPendingSub) elPendingSub.textContent = `${todo} to do, ${inProgress} in progress`;

    // 3. In Progress Tasks
    const elInProg = document.getElementById('statInProgressTasks');
    const elInProgSub = document.getElementById('statInProgressSub');
    if (elInProg) elInProg.textContent = inProgress;
    if (elInProgSub) elInProgSub.textContent = inProgress === 1 ? '1 active task' : `${inProgress} active tasks`;

    // 4. Completed Tasks
    const elCompleted = document.getElementById('statCompletedTasks');
    const elCompletedSub = document.getElementById('statCompletedSub');
    if (elCompleted) elCompleted.textContent = completed;
    if (elCompletedSub) elCompletedSub.textContent = `${completed} finished`;

    // 5. Overdue Tasks
    const elOverdue = document.getElementById('statOverdueTasks');
    const elOverdueSub = document.getElementById('statOverdueSub');
    if (elOverdue) elOverdue.textContent = overdue;
    if (elOverdueSub) elOverdueSub.textContent = overdue === 1 ? '1 task past deadline' : `${overdue} tasks past deadline`;

    // 6. Completion Rate
    const elRate = document.getElementById('statCompletionRate');
    const elRateSub = document.getElementById('statCompletionSub');
    if (elRate) elRate.textContent = `${completionRate}%`;
    if (elRateSub) elRateSub.textContent = total > 0 ? `${completed} of ${total} finished` : 'No tasks yet';

    // Update filter toolbar badge for overdue tasks
    const elBadge = document.getElementById('filterOverdueBadge');
    if (elBadge) elBadge.textContent = overdue;

    // 7. Total Courses
    const elCourses = document.getElementById('statTotalCourses');
    const elCoursesSub = document.getElementById('statCoursesSub');
    if (elCourses) elCourses.textContent = coursesCount;
    if (elCoursesSub) elCoursesSub.textContent = coursesCount === 1 ? '1 enrolled subject' : `${coursesCount} enrolled subjects`;

    // 8. Total Study Hours (from analytics overview if available)
    const elStudyHours = document.getElementById('statTotalStudyHours');
    const elStudySub = document.getElementById('statStudyHoursSub');
    if (state.analytics && state.analytics.overview) {
        const hrs = state.analytics.overview.total_study_hours || 0;
        const sessions = state.analytics.overview.total_study_sessions || 0;
        if (elStudyHours) elStudyHours.textContent = `${hrs}h`;
        if (elStudySub) elStudySub.textContent = `${sessions} sessions logged`;
    }

    // Backward-compatible element hooks
    const elActive = document.getElementById('statActiveTasks');
    const elTodo = document.getElementById('statTodoTasks');
    const elUrgent = document.getElementById('statDueUrgent');
    const elOverdueText = document.getElementById('statOverdueText');
    const elCompCount = document.getElementById('statCompletedCount');

    if (elActive) elActive.textContent = pending;
    if (elTodo) elTodo.textContent = `${todo} to do, ${inProgress} in progress`;
    if (elUrgent) elUrgent.textContent = dueToday + overdue;
    if (elOverdueText) elOverdueText.textContent = `${overdue} overdue, ${dueToday} due today`;
    if (elCompCount) elCompCount.textContent = `${completed} of ${total} finished`;
}

// ==========================================================================
// Course Sidebar & Selects
// ==========================================================================
function renderSidebarCourses() {
    const sidebar = document.getElementById('sidebarCoursesList');
    if (!sidebar) return;

    sidebar.innerHTML = `
        <div class="sidebar-course-item-wrap">
            <button class="course-item-btn ${state.activeCourseFilter === 'all' ? 'active' : ''}" data-course-id="all">
                <span class="course-color-dot" style="background:#6366f1"></span>
                <span class="course-item-code">All Subjects</span>
                <span class="course-item-count">${state.tasks.length}</span>
            </button>
        </div>
    ` + state.courses.map(c => `
        <div class="sidebar-course-item-wrap ${String(state.activeCourseFilter) === String(c.id) ? 'active' : ''}">
            <button class="course-item-btn ${String(state.activeCourseFilter) === String(c.id) ? 'active' : ''}" data-course-id="${c.id}" title="${escapeHtml(c.name)}">
                <span class="course-color-dot" style="background:${c.color}"></span>
                <span class="course-item-code">${escapeHtml(c.code)}</span>
                <span class="course-item-count">${c.task_count || 0}</span>
            </button>
            <button class="course-item-del-btn" data-course-id="${c.id}" title="Delete ${escapeHtml(c.code)}" type="button">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        </div>
    `).join('');

    sidebar.querySelectorAll('.course-item-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            state.activeCourseFilter = btn.dataset.courseId;
            const select = document.getElementById('filterCourseSelect');
            if (select) select.value = state.activeCourseFilter;
            if (state.currentTab !== 'dashboard' && state.currentTab !== 'kanban') {
                switchTab('dashboard');
            }
            loadTasks();
            renderSidebarCourses();
        });
    });

    sidebar.querySelectorAll('.course-item-del-btn').forEach(delBtn => {
        delBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const courseId = delBtn.dataset.courseId;
            const course = state.courses.find(c => String(c.id) === String(courseId));
            const code = course ? course.code : 'this course';
            const confirmed = await showConfirmModal({
                title: `Delete Subject (${code})`,
                message: `Are you sure you want to delete ${code}? Any tasks assigned to this course will be preserved as General coursework.`,
                confirmText: 'Delete Subject',
                isDanger: true
            });
            if (confirmed) {
                try {
                    const res = await authFetch(`/api/courses/${courseId}`, { method: 'DELETE' });
                    const data = await res.json();
                    if (data.success) {
                        showToast(`Subject ${code} removed`, 'info');
                        if (String(state.activeCourseFilter) === String(courseId)) {
                            state.activeCourseFilter = 'all';
                            const select = document.getElementById('filterCourseSelect');
                            if (select) select.value = 'all';
                        }
                        await loadCourses();
                        await loadTasks();
                        await loadAnalytics();
                    } else {
                        showToast(data.message || 'Failed to delete course', 'error');
                    }
                } catch (err) {
                    console.error(err);
                    showToast('Failed to delete course', 'error');
                }
            }
        });
    });
}

function populateCourseSelects() {
    const filterSelect = document.getElementById('filterCourseSelect');
    const formSelect = document.getElementById('taskInputCourse');

    if (filterSelect) {
        filterSelect.innerHTML = '<option value="all">All Courses</option>' +
            state.courses.map(c => `<option value="${c.id}">${escapeHtml(c.code)} - ${escapeHtml(c.name)}</option>`).join('');
    }

    if (formSelect) {
        formSelect.innerHTML = '<option value="">No Course Assigned</option>' +
            state.courses.map(c => `<option value="${c.id}">${escapeHtml(c.code)} - ${escapeHtml(c.name)}</option>`).join('');
    }

    // Keep study session modal select in sync
    populateSessionSelects();
}

// ==========================================================================
// Task CRUD Handlers
// ==========================================================================
async function updateTaskStatus(taskId, status) {
    try {
        const res = await authFetch(`/api/tasks/${taskId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        const data = await res.json();
        if (data.success) {
            if (status === 'completed') {
                triggerConfetti();
                playRewardChime();
                showToast('🎉 Task completed! Awesome job!', 'success');
            } else {
                showToast(`Task moved to ${status === 'in_progress' ? 'In Progress' : 'To Do'}`, 'info');
            }
            await loadTasks();
            await loadAllTasks();
            await loadAnalytics();
            if (state.currentTab === 'calendar') {
                renderCalendar();
            }
        }
    } catch (err) {
        console.error(err);
        showToast('Failed to update task status', 'error');
    }
}

// ==========================================================================
// Phase 7: Modern Confirmation Dialog
// ==========================================================================
function showConfirmModal({ title = 'Are you sure?', message = 'This action cannot be undone.', confirmText = 'Delete', isDanger = true }) {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirmModal');
        const titleEl = document.getElementById('confirmModalTitle');
        const msgEl = document.getElementById('confirmModalMessage');
        const okBtn = document.getElementById('confirmOkBtn');
        const cancelBtn = document.getElementById('confirmCancelBtn');

        if (!modal || !okBtn || !cancelBtn) {
            resolve(window.confirm(`${title}\n\n${message}`));
            return;
        }

        if (titleEl) titleEl.textContent = title;
        if (msgEl) msgEl.textContent = message;
        okBtn.textContent = confirmText;
        okBtn.className = isDanger ? 'btn btn-danger' : 'btn btn-primary';

        const cleanup = () => {
            modal.classList.remove('open');
            okBtn.removeEventListener('click', onOk);
            cancelBtn.removeEventListener('click', onCancel);
            modal.removeEventListener('click', onBackdrop);
            document.removeEventListener('keydown', onKey);
        };

        const onOk = () => {
            cleanup();
            resolve(true);
        };

        const onCancel = () => {
            cleanup();
            resolve(false);
        };

        const onBackdrop = (e) => {
            if (e.target === modal) {
                cleanup();
                resolve(false);
            }
        };

        const onKey = (e) => {
            if (e.key === 'Escape') {
                cleanup();
                resolve(false);
            }
        };

        okBtn.addEventListener('click', onOk);
        cancelBtn.addEventListener('click', onCancel);
        modal.addEventListener('click', onBackdrop);
        document.addEventListener('keydown', onKey);

        modal.classList.add('open');
    });
}

async function deleteTask(taskId) {
    try {
        const res = await authFetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            showToast('Task removed from agenda', 'info');
            await loadTasks();
            await loadAllTasks();
            await loadAnalytics();
            if (state.currentTab === 'calendar') {
                renderCalendar();
            }
        }
    } catch (err) {
        console.error(err);
        showToast('Failed to delete task', 'error');
    }
}

// ==========================================================================
// Modal Handlers (Add/Edit Task & Course)
// ==========================================================================
function openAddTaskModal(prefillDate) {
    document.getElementById('modalTaskTitle').textContent = 'Add New Academic Task';
    document.getElementById('taskFormId').value = '';
    document.getElementById('taskInputTitle').value = '';
    document.getElementById('taskInputDesc').value = '';
    document.getElementById('taskInputCourse').value = '';
    document.getElementById('taskInputCategory').value = 'Assignment';
    document.getElementById('taskInputPriority').value = 'Medium';
    document.getElementById('taskInputStatus').value = 'todo';
    document.getElementById('taskInputEstimatedHours').value = '2.0';

    if (prefillDate && typeof prefillDate === 'string') {
        const datePart = prefillDate.slice(0, 10);
        document.getElementById('taskInputDueDate').value = `${datePart}T18:00`;
    } else {
        // Set default due date to 2 days from now at 18:00 local time
        const d = new Date();
        d.setDate(d.getDate() + 2);
        d.setHours(18, 0, 0, 0);
        const pad = (n) => String(n).padStart(2, '0');
        const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        document.getElementById('taskInputDueDate').value = dateStr;
    }

    state.modalSubtasks = [];
    renderModalSubtasks();

    document.getElementById('taskModal').classList.add('open');
    setTimeout(() => {
        const titleInput = document.getElementById('taskInputTitle');
        if (titleInput) titleInput.focus();
    }, 100);
}

async function openEditTaskModal(taskId) {
    try {
        const res = await authFetch(`/api/tasks/${taskId}`);
        const data = await res.json();
        if (!data.success) return;

        const task = data.task;
        document.getElementById('modalTaskTitle').textContent = 'Edit Academic Task';
        document.getElementById('taskFormId').value = task.id;
        document.getElementById('taskInputTitle').value = task.title;
        document.getElementById('taskInputDesc').value = task.description || '';
        document.getElementById('taskInputCourse').value = task.course_id || '';
        document.getElementById('taskInputCategory').value = task.category;
        document.getElementById('taskInputPriority').value = task.priority;
        document.getElementById('taskInputStatus').value = task.status;
        document.getElementById('taskInputEstimatedHours').value = task.estimated_hours || 1.0;
        document.getElementById('taskInputDueDate').value = task.due_date ? task.due_date.slice(0, 16) : '';

        state.modalSubtasks = task.subtasks ? task.subtasks.map(s => ({ title: s.title, is_completed: s.is_completed })) : [];
        renderModalSubtasks();

        document.getElementById('taskModal').classList.add('open');
    } catch (err) {
        console.error(err);
        showToast('Failed to load task details', 'error');
    }
}

function renderModalSubtasks() {
    const list = document.getElementById('modalSubtasksList');
    if (!list) return;

    list.innerHTML = state.modalSubtasks.map((st, idx) => `
        <div class="subtask-entry-row">
            <input type="checkbox" class="checklist-checkbox" ${st.is_completed ? 'checked' : ''} data-index="${idx}">
            <input type="text" class="form-control form-control-sm" value="${escapeHtml(st.title)}" data-title-index="${idx}">
            <button type="button" class="btn-remove-subtask" data-remove-index="${idx}">&times;</button>
        </div>
    `).join('');

    list.querySelectorAll('.checklist-checkbox').forEach(box => {
        box.addEventListener('change', (e) => {
            const idx = parseInt(e.target.dataset.index);
            state.modalSubtasks[idx].is_completed = e.target.checked ? 1 : 0;
        });
    });

    list.querySelectorAll('[data-title-index]').forEach(input => {
        input.addEventListener('input', (e) => {
            const idx = parseInt(e.target.dataset.titleIndex);
            state.modalSubtasks[idx].title = e.target.value;
        });
    });

    list.querySelectorAll('.btn-remove-subtask').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.target.dataset.removeIndex);
            state.modalSubtasks.splice(idx, 1);
            renderModalSubtasks();
        });
    });
}

function closeTaskModal() {
    document.getElementById('taskModal').classList.remove('open');
}

function openAddCourseModal() {
    document.getElementById('courseCodeInput').value = '';
    document.getElementById('courseNameInput').value = '';
    document.getElementById('courseInstructorInput').value = '';
    document.getElementById('courseModal').classList.add('open');
}

function closeCourseModal() {
    document.getElementById('courseModal').classList.remove('open');
}

// ==========================================================================
// Event Listeners Setup
// ==========================================================================
function setupEventListeners() {
    // Open Modal buttons
    const openAddBtn = document.getElementById('openAddTaskModalBtn');
    if (openAddBtn) openAddBtn.addEventListener('click', openAddTaskModal);

    const kanbanAddBtn = document.getElementById('quickAddTaskKanbanBtn');
    if (kanbanAddBtn) kanbanAddBtn.addEventListener('click', openAddTaskModal);

    const dashAddBtn = document.getElementById('dashAddNewTaskBtn');
    if (dashAddBtn) dashAddBtn.addEventListener('click', openAddTaskModal);

    const dashPlanBtn = document.getElementById('dashPlanStudySessionBtn');
    if (dashPlanBtn) dashPlanBtn.addEventListener('click', () => openAddStudySessionModal());

    const closeTaskBtn = document.getElementById('closeTaskModalBtn');
    if (closeTaskBtn) closeTaskBtn.addEventListener('click', closeTaskModal);

    const cancelTaskBtn = document.getElementById('cancelTaskModalBtn');
    if (cancelTaskBtn) cancelTaskBtn.addEventListener('click', closeTaskModal);

    const openCourseBtn = document.getElementById('openAddCourseModalBtn');
    if (openCourseBtn) openCourseBtn.addEventListener('click', openAddCourseModal);

    const closeCourseBtn = document.getElementById('closeCourseModalBtn');
    if (closeCourseBtn) closeCourseBtn.addEventListener('click', closeCourseModal);

    const cancelCourseBtn = document.getElementById('cancelCourseModalBtn');
    if (cancelCourseBtn) cancelCourseBtn.addEventListener('click', closeCourseModal);

    // Click outside backdrop to close modals
    ['taskModal', 'courseModal', 'studySessionModal'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('click', (e) => {
                if (e.target === el) {
                    el.classList.remove('open');
                }
            });
        }
    });

    // Add subtask step inside modal (Click or Enter key)
    const addSubtaskAction = () => {
        const input = document.getElementById('newSubtaskInput');
        const val = input ? input.value.trim() : '';
        if (val) {
            state.modalSubtasks.push({ title: val, is_completed: 0 });
            input.value = '';
            renderModalSubtasks();
        }
    };
    const addSubBtn = document.getElementById('addNewSubtaskBtn');
    if (addSubBtn) addSubBtn.addEventListener('click', addSubtaskAction);
    const subInput = document.getElementById('newSubtaskInput');
    if (subInput) {
        subInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addSubtaskAction();
            }
        });
    }

    // Global keyboard navigation: Escape closes open modals, drawers, and mobile sidebar
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeTaskModal();
            closeCourseModal();
            closeStudySessionModal();
            closeMobileSidebar();
            const d = document.getElementById('calendarDayDetails');
            if (d) d.style.display = 'none';
        }
    });

    // Calendar Navigation (Month, Week, Day)
    const hideDayDrawer = () => {
        const d = document.getElementById('calendarDayDetails');
        if (d) d.style.display = 'none';
    };

    const prevNavBtn = document.getElementById('prevMonthBtn');
    if (prevNavBtn) {
        prevNavBtn.addEventListener('click', () => {
            hideDayDrawer();
            if (state.calendarView === 'month') {
                state.calendarDate.setDate(1);
                state.calendarDate.setMonth(state.calendarDate.getMonth() - 1);
            } else if (state.calendarView === 'week') {
                state.calendarDate.setDate(state.calendarDate.getDate() - 7);
            } else if (state.calendarView === 'day') {
                state.calendarDate.setDate(state.calendarDate.getDate() - 1);
            }
            renderCalendar();
        });
    }

    const nextNavBtn = document.getElementById('nextMonthBtn');
    if (nextNavBtn) {
        nextNavBtn.addEventListener('click', () => {
            hideDayDrawer();
            if (state.calendarView === 'month') {
                state.calendarDate.setDate(1);
                state.calendarDate.setMonth(state.calendarDate.getMonth() + 1);
            } else if (state.calendarView === 'week') {
                state.calendarDate.setDate(state.calendarDate.getDate() + 7);
            } else if (state.calendarView === 'day') {
                state.calendarDate.setDate(state.calendarDate.getDate() + 1);
            }
            renderCalendar();
        });
    }

    const todayBtn = document.getElementById('calendarTodayBtn');
    if (todayBtn) {
        todayBtn.addEventListener('click', () => {
            hideDayDrawer();
            state.calendarDate = new Date();
            renderCalendar();
        });
    }

    // Calendar View Switcher (Month / Week / Day)
    const viewMonthBtn = document.getElementById('calendarViewMonthBtn');
    const viewWeekBtn = document.getElementById('calendarViewWeekBtn');
    const viewDayBtn = document.getElementById('calendarViewDayBtn');

    if (viewMonthBtn) {
        viewMonthBtn.addEventListener('click', () => {
            hideDayDrawer();
            state.calendarView = 'month';
            renderCalendar();
        });
    }
    if (viewWeekBtn) {
        viewWeekBtn.addEventListener('click', () => {
            hideDayDrawer();
            state.calendarView = 'week';
            renderCalendar();
        });
    }
    if (viewDayBtn) {
        viewDayBtn.addEventListener('click', () => {
            hideDayDrawer();
            state.calendarView = 'day';
            renderCalendar();
        });
    }

    // Calendar Category Filter Chips
    document.querySelectorAll('.cal-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.cal-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            state.calendarFilter = chip.dataset.calFilter;
            renderCalendar();
        });
    });

    // Calendar Show Completed Toggle
    const showCompCheckbox = document.getElementById('calShowCompletedCheckbox');
    if (showCompCheckbox) {
        showCompCheckbox.addEventListener('change', (e) => {
            state.calShowCompleted = e.target.checked;
            renderCalendar();
        });
    }

    // Study Planner Modal Listeners
    const openAddSessionBtn = document.getElementById('openAddStudySessionModalBtn');
    if (openAddSessionBtn) {
        openAddSessionBtn.addEventListener('click', () => openAddStudySessionModal());
    }
    const closeSessionBtn = document.getElementById('closeSessionModalBtn');
    if (closeSessionBtn) {
        closeSessionBtn.addEventListener('click', closeStudySessionModal);
    }
    const cancelSessionBtn = document.getElementById('cancelSessionModalBtn');
    if (cancelSessionBtn) {
        cancelSessionBtn.addEventListener('click', closeStudySessionModal);
    }
    const sessionForm = document.getElementById('studySessionForm');
    if (sessionForm) {
        sessionForm.addEventListener('submit', handleStudySessionSubmit);
    }

    // Auto calculate duration from start and end time
    const startInput = document.getElementById('sessionInputStartTime');
    const endInput = document.getElementById('sessionInputEndTime');
    const durInput = document.getElementById('sessionInputDuration');
    function updateDurationCalc() {
        if (!startInput || !endInput || !durInput) return;
        const s = startInput.value;
        const e = endInput.value;
        if (s && e) {
            const [sh, sm] = s.split(':').map(Number);
            const [eh, em] = e.split(':').map(Number);
            const diff = (eh * 60 + em) - (sh * 60 + sm);
            if (diff > 0) {
                durInput.value = diff;
            }
        }
    }
    if (startInput && endInput) {
        startInput.addEventListener('change', updateDurationCalc);
        endInput.addEventListener('change', updateDurationCalc);
    }

    // Day View Action Buttons
    const dayAddTaskBtn = document.getElementById('dayViewAddTaskBtn');
    if (dayAddTaskBtn) {
        dayAddTaskBtn.addEventListener('click', () => {
            openAddTaskModal(formatLocalDateISO(state.calendarDate));
        });
    }
    const dayAddSessionBtn = document.getElementById('dayViewAddSessionBtn');
    if (dayAddSessionBtn) {
        dayAddSessionBtn.addEventListener('click', () => {
            openAddStudySessionModal(formatLocalDateISO(state.calendarDate));
        });
    }

    const closeDayBtn = document.getElementById('closeDayDetailsBtn');
    if (closeDayBtn) {
        closeDayBtn.addEventListener('click', () => {
            document.getElementById('calendarDayDetails').style.display = 'none';
        });
    }

    // Filter toolbar listeners
    const searchInput = document.getElementById('taskSearchInput');
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            state.searchQuery = e.target.value.trim();
            loadTasks();
        }, 250);
    });

    document.getElementById('filterCourseSelect').addEventListener('change', (e) => {
        state.activeCourseFilter = e.target.value;
        loadTasks();
        renderSidebarCourses();
    });

    document.getElementById('filterPrioritySelect').addEventListener('change', (e) => {
        state.activePriorityFilter = e.target.value;
        loadTasks();
    });

    const overdueFilterBtn = document.getElementById('filterOverdueBtn');
    if (overdueFilterBtn) {
        overdueFilterBtn.addEventListener('click', () => {
            state.activeOverdueFilter = !state.activeOverdueFilter;
            overdueFilterBtn.classList.toggle('active', state.activeOverdueFilter);
            const statusSelect = document.getElementById('filterStatusSelect');
            if (state.activeOverdueFilter) {
                if (statusSelect) statusSelect.value = 'overdue';
            } else {
                if (statusSelect && statusSelect.value === 'overdue') statusSelect.value = 'all';
            }
            loadTasks();
        });
    }

    const clearFiltersBtn = document.getElementById('clearFiltersBtn');
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            state.searchQuery = '';
            state.activeCourseFilter = 'all';
            state.activePriorityFilter = 'all';
            state.activeStatusFilter = 'all';
            state.activeOverdueFilter = false;
            state.sortBy = 'due_date';

            const searchInput = document.getElementById('taskSearchInput');
            if (searchInput) searchInput.value = '';

            const courseSelect = document.getElementById('filterCourseSelect');
            if (courseSelect) courseSelect.value = 'all';

            const prioritySelect = document.getElementById('filterPrioritySelect');
            if (prioritySelect) prioritySelect.value = 'all';

            const statusSelect = document.getElementById('filterStatusSelect');
            if (statusSelect) statusSelect.value = 'all';

            const sortSelect = document.getElementById('sortBySelect');
            if (sortSelect) sortSelect.value = 'due_date';

            if (overdueFilterBtn) overdueFilterBtn.classList.remove('active');

            renderSidebarCourses();
            loadTasks();
            showToast('All filters cleared', 'info');
        });
    }

    document.getElementById('filterStatusSelect').addEventListener('change', (e) => {
        state.activeStatusFilter = e.target.value;
        if (e.target.value === 'overdue') {
            state.activeOverdueFilter = true;
            if (overdueFilterBtn) overdueFilterBtn.classList.add('active');
        } else {
            state.activeOverdueFilter = false;
            if (overdueFilterBtn) overdueFilterBtn.classList.remove('active');
        }
        loadTasks();
    });

    document.getElementById('sortBySelect').addEventListener('change', (e) => {
        state.sortBy = e.target.value;
        loadTasks();
    });

    // Task Form Submit
    document.getElementById('taskForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const taskId = document.getElementById('taskFormId').value;
        const title = document.getElementById('taskInputTitle').value.trim();
        const dueDate = document.getElementById('taskInputDueDate').value.trim();

        // Client-side validations
        if (!title) {
            showToast('Task title is required.', 'error');
            document.getElementById('taskInputTitle').focus();
            return;
        }
        if (title.length > 200) {
            showToast('Task title cannot exceed 200 characters.', 'error');
            return;
        }
        if (!dueDate) {
            showToast('Due date is required.', 'error');
            document.getElementById('taskInputDueDate').focus();
            return;
        }

        const payload = {
            title: title,
            description: document.getElementById('taskInputDesc').value.trim(),
            course_id: document.getElementById('taskInputCourse').value || null,
            category: document.getElementById('taskInputCategory').value,
            priority: document.getElementById('taskInputPriority').value,
            status: document.getElementById('taskInputStatus').value,
            due_date: dueDate,
            estimated_hours: parseFloat(document.getElementById('taskInputEstimatedHours').value) || 1.0,
            subtasks: state.modalSubtasks
        };

        const submitBtn = document.getElementById('saveTaskSubmitBtn');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Saving...';
        }

        try {
            const url = taskId ? `/api/tasks/${taskId}` : '/api/tasks';
            const method = taskId ? 'PUT' : 'POST';

            const res = await authFetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                closeTaskModal();
                showToast(taskId ? 'Task updated successfully' : 'New task scheduled!', 'success');
                await loadTasks();
                await loadAllTasks();
                await loadAnalytics();
                if (state.currentTab === 'calendar') {
                    renderCalendar();
                }
            } else {
                showToast(data.message || 'Error saving task', 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('Failed to save task', 'error');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Save Task';
            }
        }
    });

    // Course Form Submit
    document.getElementById('courseForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const colorRadio = document.querySelector('input[name="courseColor"]:checked');
        const payload = {
            code: document.getElementById('courseCodeInput').value.trim(),
            name: document.getElementById('courseNameInput').value.trim(),
            instructor: document.getElementById('courseInstructorInput').value.trim(),
            color: colorRadio ? colorRadio.value : '#6366f1'
        };

        const submitBtn = document.getElementById('createCourseSubmitBtn');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Creating...';
        }

        try {
            const res = await authFetch('/api/courses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                closeCourseModal();
                showToast('New subject added to semester profile!', 'success');
                await loadCourses();
            } else {
                showToast(data.message || 'Failed to create course', 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('Error adding subject', 'error');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Create Subject';
            }
        }
    });
}

// ==========================================================================
// Toast Notification Engine
// ==========================================================================
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <span>${escapeHtml(message)}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(40px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3200);
}

// ==========================================================================
// Audio Synthesizer (Zero External Audio Dependencies)
// ==========================================================================
function playRewardChime() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();

        // Notes: C5 -> E5 -> G5 -> C6
        const notes = [523.25, 659.25, 783.99, 1046.50];
        notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.value = freq;

            gain.gain.setValueAtTime(0.12, ctx.currentTime + i * 0.08);
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.08 + 0.35);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(ctx.currentTime + i * 0.08);
            osc.stop(ctx.currentTime + i * 0.08 + 0.4);
        });
    } catch (e) {
        // AudioContext disabled or not allowed
    }
}

function playSubtleClickSound() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.04);

        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 0.05);
    } catch (e) { }
}

function playPomodoroBell() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();

        // Tibetan bowl / bell simulation
        [440, 880, 1320].forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.value = freq;

            gain.gain.setValueAtTime(0.2 / (idx + 1), ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.8);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start();
            osc.stop(ctx.currentTime + 2.0);
        });
    } catch (e) { }
}

// ==========================================================================
// Celebration Confetti
// ==========================================================================
function triggerConfetti() {
    const canvas = document.createElement('canvas');
    canvas.className = 'confetti-canvas';
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#6366f1', '#ec4899', '#06b6d4', '#10b981', '#f59e0b', '#8b5cf6'];
    const particles = [];

    for (let i = 0; i < 65; i++) {
        particles.push({
            x: canvas.width / 2,
            y: canvas.height / 2,
            r: Math.random() * 5 + 3,
            color: colors[Math.floor(Math.random() * colors.length)],
            vx: (Math.random() - 0.5) * 14,
            vy: (Math.random() - 0.7) * 14,
            tilt: Math.random() * 10,
            tiltAngle: 0,
            tiltAngleInc: Math.random() * 0.1 + 0.05,
            opacity: 1
        });
    }

    let animationFrame;
    function render() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let alive = false;

        particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.35; // gravity
            p.tiltAngle += p.tiltAngleInc;
            p.opacity -= 0.015;

            if (p.opacity > 0) {
                alive = true;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = p.color;
                ctx.globalAlpha = Math.max(0, p.opacity);
                ctx.fill();
            }
        });

        if (alive) {
            animationFrame = requestAnimationFrame(render);
        } else {
            cancelAnimationFrame(animationFrame);
            canvas.remove();
        }
    }

    render();
}

// ==========================================================================
// Utilities
// ==========================================================================
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatDateOnly(dateStr) {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr);
        return d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
        return dateStr;
    }
}

// ==========================================================================
// Authentication & Session Management
// ==========================================================================

async function checkAuthAndInit() {
    try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (data.authenticated && data.user) {
            state.currentUser = data.user;
            updateProfileUI(data.user);
            applyCurrentStudentTheme();
            hideAuthModal();
            await loadCourses();
            await loadTasks();
            await loadAllTasks();
            await loadAnalytics();
            await loadStudySessions();
            loadRecentStudySessions();
            await loadNotifications();
            startNotificationPolling();
        } else {
            state.currentUser = null;
            clearDashboardData();
            showAuthModal('login');
        }
    } catch (err) {
        console.error('Error verifying auth status:', err);
        showAuthModal('login');
    }
}

function setupAuthListeners() {
    // Form submits
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLoginSubmit);
    }

    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegisterSubmit);
    }

    // Tab buttons
    const tabBtnLogin = document.getElementById('tabBtnLogin');
    if (tabBtnLogin) {
        tabBtnLogin.addEventListener('click', () => switchAuthTab('login'));
    }

    const tabBtnRegister = document.getElementById('tabBtnRegister');
    if (tabBtnRegister) {
        tabBtnRegister.addEventListener('click', () => switchAuthTab('register'));
    }

    // Switch links
    const switchToReg = document.getElementById('switchToRegisterBtn');
    if (switchToReg) {
        switchToReg.addEventListener('click', () => switchAuthTab('register'));
    }

    const switchToLog = document.getElementById('switchToLoginBtn');
    if (switchToLog) {
        switchToLog.addEventListener('click', () => switchAuthTab('login'));
    }

    // Logout buttons (sidebar + topbar)
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    const topLogoutBtn = document.getElementById('topLogoutBtn');
    if (topLogoutBtn) {
        topLogoutBtn.addEventListener('click', handleLogout);
    }

    // Welcome banner "Add Task" button
    const welcomeAddTaskBtn = document.getElementById('welcomeAddTaskBtn');
    if (welcomeAddTaskBtn) {
        welcomeAddTaskBtn.addEventListener('click', openAddTaskModal);
    }
}

async function handleLoginSubmit(e) {
    e.preventDefault();
    const alertBox = document.getElementById('loginAlert');
    const submitBtn = document.getElementById('loginSubmitBtn');
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (alertBox) alertBox.style.display = 'none';

    if (!email || !password) {
        showAuthAlert(alertBox, 'Please enter both email and password.');
        return;
    }

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>Signing In...</span>';
    }

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();

        if (res.ok && data.success) {
            state.currentUser = data.user;
            updateProfileUI(data.user);
            applyCurrentStudentTheme();
            hideAuthModal();
            document.getElementById('loginForm').reset();
            showToast(`Welcome back, ${data.user.name}!`, 'success');

            // Load fresh student data
            await loadCourses();
            await loadTasks();
            await loadAllTasks();
            await loadAnalytics();
            await loadStudySessions();
            loadRecentStudySessions();
            await loadNotifications();
            startNotificationPolling();
        } else {
            showAuthAlert(alertBox, data.message || 'Invalid email or password.');
            showToast(data.message || 'Login failed', 'error');
        }
    } catch (err) {
        console.error('Login error:', err);
        showAuthAlert(alertBox, 'Unable to connect to server. Please try again.');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span>Sign In to ScholarFlow</span>';
        }
    }
}

async function handleRegisterSubmit(e) {
    e.preventDefault();
    const alertBox = document.getElementById('registerAlert');
    const submitBtn = document.getElementById('registerSubmitBtn');
    const name = document.getElementById('registerName').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('registerConfirmPassword').value;

    if (alertBox) alertBox.style.display = 'none';

    if (!name || !email || !password || !confirmPassword) {
        showAuthAlert(alertBox, 'All fields are required.');
        return;
    }

    if (password.length < 6) {
        showAuthAlert(alertBox, 'Password must be at least 6 characters long.');
        return;
    }

    if (password !== confirmPassword) {
        showAuthAlert(alertBox, 'Passwords do not match.');
        return;
    }

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>Creating Account...</span>';
    }

    try {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                email,
                password,
                confirm_password: confirmPassword
            })
        });
        const data = await res.json();

        if (res.ok && data.success) {
            state.currentUser = data.user;
            updateProfileUI(data.user);
            applyCurrentStudentTheme();
            hideAuthModal();
            document.getElementById('registerForm').reset();
            showToast(`Welcome to ScholarFlow, ${data.user.name}!`, 'success');

            // Load fresh data for new student
            await loadCourses();
            await loadTasks();
            await loadAllTasks();
            await loadAnalytics();
            await loadStudySessions();
            loadRecentStudySessions();
            await loadNotifications();
            startNotificationPolling();
        } else {
            showAuthAlert(alertBox, data.message || 'Registration failed.');
            showToast(data.message || 'Registration failed', 'error');
        }
    } catch (err) {
        console.error('Registration error:', err);
        showAuthAlert(alertBox, 'Unable to connect to server. Please try again.');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span>Create Student Account</span>';
        }
    }
}

async function handleLogout() {
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
        console.error('Logout error:', err);
    }
    state.currentUser = null;
    clearDashboardData();
    closeMobileSidebar();
    const defaultTheme = localStorage.getItem('scholarflow_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', defaultTheme);
    updateThemeButtonUI(defaultTheme);
    showAuthModal('login');
    showToast('Logged out successfully. See you soon!', 'info');
}

function handleUnauthorizedSession() {
    if (state.currentUser) {
        state.currentUser = null;
        clearDashboardData();
        showAuthModal('login');
        showToast('Your session has expired. Please log in again.', 'warning');
    } else {
        showAuthModal('login');
    }
}

function showAuthModal(tab = 'login') {
    const authModal = document.getElementById('authModal');
    if (!authModal) return;

    authModal.classList.add('open');
    switchAuthTab(tab);
}

function hideAuthModal() {
    const authModal = document.getElementById('authModal');
    if (authModal) {
        authModal.classList.remove('open');
    }
}

function switchAuthTab(tab) {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const tabBtnLogin = document.getElementById('tabBtnLogin');
    const tabBtnRegister = document.getElementById('tabBtnRegister');
    const loginAlert = document.getElementById('loginAlert');
    const registerAlert = document.getElementById('registerAlert');

    if (loginAlert) loginAlert.style.display = 'none';
    if (registerAlert) registerAlert.style.display = 'none';

    if (tab === 'login') {
        if (loginForm) loginForm.style.display = 'block';
        if (registerForm) registerForm.style.display = 'none';
        if (tabBtnLogin) tabBtnLogin.classList.add('active');
        if (tabBtnRegister) tabBtnRegister.classList.remove('active');
        const emailInput = document.getElementById('loginEmail');
        if (emailInput) setTimeout(() => emailInput.focus(), 80);
    } else {
        if (loginForm) loginForm.style.display = 'none';
        if (registerForm) registerForm.style.display = 'block';
        if (tabBtnLogin) tabBtnLogin.classList.remove('active');
        if (tabBtnRegister) tabBtnRegister.classList.add('active');
        const nameInput = document.getElementById('registerName');
        if (nameInput) setTimeout(() => nameInput.focus(), 80);
    }
}

function showAuthAlert(el, message) {
    if (!el) return;
    el.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span>${escapeHtml(message)}</span>
    `;
    el.style.display = 'flex';
}

function formatCurrentDate() {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return new Date().toLocaleDateString('en-US', options);
}

function updateProfileUI(user) {
    const avatar = document.getElementById('studentAvatar');
    const name = document.getElementById('studentName');
    const email = document.getElementById('studentEmail');

    const welcomeAvatar = document.getElementById('welcomeAvatar');
    const welcomeName = document.getElementById('welcomeStudentName');
    const welcomeEmail = document.getElementById('welcomeStudentEmail');
    const currentDateEl = document.getElementById('dashboardCurrentDate');

    // Update current date
    const dateFormatted = formatCurrentDate();
    if (currentDateEl) {
        currentDateEl.textContent = dateFormatted;
    }

    if (user) {
        if (name) name.textContent = user.name;
        if (email) email.textContent = user.email;
        if (avatar) avatar.textContent = getInitials(user.name);

        if (welcomeAvatar) welcomeAvatar.textContent = getInitials(user.name);
        if (welcomeName) welcomeName.textContent = user.name;
        if (welcomeEmail) welcomeEmail.textContent = user.email;

        // Dynamic time-of-day greeting
        const greetingTitle = document.getElementById('welcomeTitle');
        if (greetingTitle) {
            const hour = new Date().getHours();
            let timeGreeting = 'Welcome back';
            if (hour < 12) timeGreeting = 'Good morning';
            else if (hour < 18) timeGreeting = 'Good afternoon';
            else timeGreeting = 'Good evening';
            greetingTitle.innerHTML = `${timeGreeting}, <span id="welcomeStudentName">${escapeHtml(user.name)}</span>! 👋`;
        }
    } else {
        if (name) name.textContent = 'Student';
        if (email) email.textContent = 'Please sign in';
        if (avatar) avatar.textContent = 'ST';

        if (welcomeAvatar) welcomeAvatar.textContent = 'ST';
        if (welcomeName) welcomeName.textContent = 'Student';
        if (welcomeEmail) welcomeEmail.textContent = 'Sign in to access your dashboard';
    }
}

function getInitials(name) {
    if (!name) return 'ST';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
}

function clearDashboardData() {
    state.tasks = [];
    state.allTasks = [];
    state.courses = [];
    state.studySessions = [];
    state.analytics = null;
    state.calendarView = 'month';
    state.calendarFilter = 'all';
    state.calShowCompleted = true;

    // Reset Pomodoro
    if (state.pomodoro.timer) {
        clearInterval(state.pomodoro.timer);
        state.pomodoro.timer = null;
        state.pomodoro.isRunning = false;
    }

    // Reset Topbar Study Streak
    const streakEl = document.getElementById('topbarStudyStreak');
    if (streakEl) streakEl.textContent = '0 Days';

    // Clear Planner Hub
    const cToday = document.getElementById('dashCountTodayTasks');
    const cOverdue = document.getElementById('dashCountOverdueTasks');
    const cUp = document.getElementById('dashCountUpcomingDeadlines');
    const cTodaySess = document.getElementById('dashCountTodaySessions');
    const cUpSess = document.getElementById('dashCountUpcomingSessions');
    if (cToday) cToday.textContent = '0';
    if (cOverdue) cOverdue.textContent = '0';
    if (cUp) cUp.textContent = '0';
    if (cTodaySess) cTodaySess.textContent = '0';
    if (cUpSess) cUpSess.textContent = '0';

    const lToday = document.getElementById('dashListTodayTasks');
    const lOverdue = document.getElementById('dashListOverdueTasks');
    const lUp = document.getElementById('dashListUpcomingDeadlines');
    const lTodaySess = document.getElementById('dashListTodaySessions');
    const lUpSess = document.getElementById('dashListUpcomingSessions');
    if (lToday) lToday.innerHTML = '<p class="empty-planner-hint">No tasks due today. Great job!</p>';
    if (lOverdue) lOverdue.innerHTML = '<p class="empty-planner-hint">No overdue tasks! You\'re all caught up.</p>';
    if (lUp) lUp.innerHTML = '<p class="empty-planner-hint">No deadlines in the next 7 days.</p>';
    if (lTodaySess) lTodaySess.innerHTML = '<p class="empty-planner-hint">No study sessions logged for today.</p>';
    if (lUpSess) lUpSess.innerHTML = '<p class="empty-planner-hint">No upcoming study sessions planned yet.</p>';

    // Clear Task List
    const taskContainer = document.getElementById('tasksListContainer');
    if (taskContainer) taskContainer.innerHTML = '';

    // Clear Kanban
    const colTodo = document.getElementById('kanbanDropTodo');
    const colProg = document.getElementById('kanbanDropProgress');
    const colDone = document.getElementById('kanbanDropDone');
    if (colTodo) colTodo.innerHTML = '';
    if (colProg) colProg.innerHTML = '';
    if (colDone) colDone.innerHTML = '';
    const bTodo = document.getElementById('kanbanBadgeTodo');
    const bProg = document.getElementById('kanbanBadgeProgress');
    const bDone = document.getElementById('kanbanBadgeDone');
    if (bTodo) bTodo.textContent = '0';
    if (bProg) bProg.textContent = '0';
    if (bDone) bDone.textContent = '0';

    // Clear Sidebar courses
    const sidebarCourses = document.getElementById('sidebarCoursesList');
    if (sidebarCourses) sidebarCourses.innerHTML = '';

    // Clear Course selects
    populateCourseSelects();

    // Clear Study Sessions
    const studyList = document.getElementById('studySessionsList');
    if (studyList) studyList.innerHTML = '';
    const totalStudyLabel = document.getElementById('totalStudyMinutesLabel');
    if (totalStudyLabel) totalStudyLabel.textContent = '0 mins logged';

    // Reset all personalized metrics
    const elTotal = document.getElementById('statTotalTasks');
    const elTasksSub = document.getElementById('statTasksSub');
    const elPending = document.getElementById('statPendingTasks');
    const elPendingSub = document.getElementById('statPendingSub');
    const elInProg = document.getElementById('statInProgressTasks');
    const elInProgSub = document.getElementById('statInProgressSub');
    const elCompleted = document.getElementById('statCompletedTasks');
    const elCompletedSub = document.getElementById('statCompletedSub');
    const elOverdue = document.getElementById('statOverdueTasks');
    const elOverdueSub = document.getElementById('statOverdueSub');
    const elRate = document.getElementById('statCompletionRate');
    const elRateSub = document.getElementById('statCompletionSub');
    const elBadge = document.getElementById('filterOverdueBadge');
    const elCourses = document.getElementById('statTotalCourses');
    const elCoursesSub = document.getElementById('statCoursesSub');
    const elStudyHours = document.getElementById('statTotalStudyHours');
    const elStudySub = document.getElementById('statStudyHoursSub');

    if (elTotal) elTotal.textContent = '0';
    if (elTasksSub) elTasksSub.textContent = '0 coursework items';
    if (elPending) elPending.textContent = '0';
    if (elPendingSub) elPendingSub.textContent = '0 to do';
    if (elInProg) elInProg.textContent = '0';
    if (elInProgSub) elInProgSub.textContent = 'Currently active';
    if (elCompleted) elCompleted.textContent = '0';
    if (elCompletedSub) elCompletedSub.textContent = '0 finished';
    if (elOverdue) elOverdue.textContent = '0';
    if (elOverdueSub) elOverdueSub.textContent = '0 overdue';
    if (elRate) elRate.textContent = '0%';
    if (elRateSub) elRateSub.textContent = 'Progress score';
    if (elBadge) elBadge.textContent = '0';
    if (elCourses) elCourses.textContent = '0';
    if (elCoursesSub) elCoursesSub.textContent = '0 enrolled subjects';
    if (elStudyHours) elStudyHours.textContent = '0h';
    if (elStudySub) elStudySub.textContent = '0 sessions logged';

    // Reset legacy / secondary metrics
    const statActive = document.getElementById('statActiveTasks');
    const statDue = document.getElementById('statDueUrgent');
    const statComp = document.getElementById('statCompletedRate');
    const statStudy = document.getElementById('statStudyTime');
    if (statActive) statActive.textContent = '0';
    if (statDue) statDue.textContent = '0';
    if (statComp) statComp.textContent = '0%';
    if (statStudy) statStudy.textContent = '0h 0m';

    // Reset filter controls in DOM
    const searchInput = document.getElementById('taskSearchInput');
    if (searchInput) searchInput.value = '';
    const courseSelect = document.getElementById('filterCourseSelect');
    if (courseSelect) courseSelect.value = 'all';
    const prioritySelect = document.getElementById('filterPrioritySelect');
    if (prioritySelect) prioritySelect.value = 'all';
    const statusSelect = document.getElementById('filterStatusSelect');
    if (statusSelect) statusSelect.value = 'all';
    const sortSelect = document.getElementById('sortBySelect');
    if (sortSelect) sortSelect.value = 'due_date';
    const overdueFilterBtn = document.getElementById('filterOverdueBtn');
    if (overdueFilterBtn) overdueFilterBtn.classList.remove('active');

    state.searchQuery = '';
    state.activeCourseFilter = 'all';
    state.activePriorityFilter = 'all';
    state.activeStatusFilter = 'all';
    state.activeOverdueFilter = false;
    state.sortBy = 'due_date';

    // Reset profile card and welcome banner
    updateProfileUI(null);

    // Phase 6: Reset Notifications
    stopNotificationPolling();
    state.notifications = [];
    state.unreadNotificationCount = 0;
    const notifBadge = document.getElementById('notificationBadge');
    if (notifBadge) notifBadge.style.display = 'none';
    const notifPill = document.getElementById('notificationUnreadPill');
    if (notifPill) notifPill.textContent = '0 unread';
    const notifDropdown = document.getElementById('notificationDropdown');
    if (notifDropdown) notifDropdown.classList.remove('open');
    const notifList = document.getElementById('notificationList');
    if (notifList) {
        notifList.innerHTML = `
            <div class="notification-empty" id="notificationEmpty">
                <div class="empty-icon-wrap">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                        <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                    </svg>
                </div>
                <p>No notifications yet</p>
                <span>You're all caught up with your deadlines and study plans!</span>
            </div>
        `;
    }
}

// ==========================================================================
// Phase 6: Notification & Reminder System
// ==========================================================================

async function loadNotifications() {
    if (!state.currentUser) return;
    try {
        const res = await authFetch('/api/notifications');
        if (res.status === 401) return;
        const data = await res.json();
        if (data.success) {
            state.notifications = data.notifications || [];
            state.unreadNotificationCount = data.unread_count || 0;
            renderNotificationsUI();
        }
    } catch (err) {
        console.error('Failed to load notifications:', err);
    }
}

function startNotificationPolling() {
    stopNotificationPolling();
    // Refresh notifications every 45 seconds while logged in
    state.notificationPollingInterval = setInterval(() => {
        if (state.currentUser) {
            loadNotifications();
        }
    }, 45000);
}

function stopNotificationPolling() {
    if (state.notificationPollingInterval) {
        clearInterval(state.notificationPollingInterval);
        state.notificationPollingInterval = null;
    }
}

function renderNotificationsUI() {
    const badge = document.getElementById('notificationBadge');
    const pill = document.getElementById('notificationUnreadPill');
    const list = document.getElementById('notificationList');

    if (badge) {
        if (state.unreadNotificationCount > 0) {
            badge.textContent = state.unreadNotificationCount > 99 ? '99+' : state.unreadNotificationCount;
            badge.style.display = 'inline-flex';
        } else {
            badge.style.display = 'none';
        }
    }

    if (pill) {
        pill.textContent = `${state.unreadNotificationCount} unread`;
    }

    if (!list) return;

    if (!state.notifications || state.notifications.length === 0) {
        list.innerHTML = `
            <div class="notification-empty" id="notificationEmpty">
                <div class="empty-icon-wrap">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                        <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                    </svg>
                </div>
                <p>No notifications yet</p>
                <span>You're all caught up with your deadlines and study plans!</span>
            </div>
        `;
        return;
    }

    let html = '';
    state.notifications.forEach(item => {
        const unreadClass = item.is_read ? '' : 'unread';
        const typeClass = `notif-icon-${item.type || 'assignment'}`;
        const iconSvg = getNotificationIconSvg(item.type);
        const timeAgo = formatNotificationTime(item.created_at);

        html += `
            <div class="notification-item ${unreadClass}" data-id="${item.id}">
                <div class="notif-icon ${typeClass}">
                    ${iconSvg}
                </div>
                <div class="notif-body">
                    <div class="notif-title">${escapeHtml(item.title)}</div>
                    <div class="notif-message">${escapeHtml(item.message)}</div>
                    <div class="notif-meta">
                        <span class="notif-time">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <polyline points="12 6 12 12 16 14"></polyline>
                            </svg>
                            ${timeAgo}
                        </span>
                        <div class="notif-actions">
                            ${!item.is_read ? `
                            <button class="btn-notif-action action-read" title="Mark as read" data-action="read" data-id="${item.id}" type="button">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                            </button>
                            ` : ''}
                            <button class="btn-notif-action action-delete" title="Delete notification" data-action="delete" data-id="${item.id}" type="button">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="3 6 5 6 21 6"></polyline>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });

    list.innerHTML = html;

    // Attach click events to action buttons
    list.querySelectorAll('.btn-notif-action').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const action = btn.dataset.action;
            const notifId = parseInt(btn.dataset.id, 10);
            if (action === 'read') {
                markNotificationRead(notifId);
            } else if (action === 'delete') {
                deleteNotification(notifId);
            }
        });
    });

    // Clicking an unread item marks it as read and optionally opens its task
    list.querySelectorAll('.notification-item').forEach(itemEl => {
        itemEl.addEventListener('click', () => {
            const notifId = parseInt(itemEl.dataset.id, 10);
            const notif = state.notifications.find(n => n.id === notifId);
            if (notif && !notif.is_read) {
                markNotificationRead(notifId);
            }
            if (notif && notif.related_type === 'task' && notif.related_id) {
                if (typeof openEditTaskModal === 'function') {
                    openEditTaskModal(notif.related_id);
                }
            }
        });
    });
}

function getNotificationIconSvg(type) {
    switch (type) {
        case 'overdue':
            return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>`;
        case 'exam':
            return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>
                <path d="M6 12v5c3 3 9 3 12 0v-5"></path>
            </svg>`;
        case 'study_session':
            return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
            </svg>`;
        case 'assignment':
        default:
            return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
            </svg>`;
    }
}

function formatNotificationTime(timestampStr) {
    if (!timestampStr) return 'Recently';
    try {
        const itemDate = new Date(timestampStr.replace(' ', 'T'));
        const now = new Date();
        const diffMs = now - itemDate;
        const diffSec = Math.floor(diffMs / 1000);
        if (diffSec < 60) return 'Just now';
        const diffMin = Math.floor(diffSec / 60);
        if (diffMin < 60) return `${diffMin}m ago`;
        const diffHr = Math.floor(diffMin / 60);
        if (diffHr < 24) return `${diffHr}h ago`;
        const diffDay = Math.floor(diffHr / 24);
        if (diffDay < 7) return `${diffDay}d ago`;
        return itemDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch (e) {
        return timestampStr;
    }
}

async function markNotificationRead(id) {
    try {
        const res = await authFetch(`/api/notifications/${id}/read`, { method: 'PUT' });
        const data = await res.json();
        if (data.success) {
            const notif = state.notifications.find(n => n.id === id);
            if (notif) notif.is_read = 1;
            state.unreadNotificationCount = data.unread_count ?? Math.max(0, state.unreadNotificationCount - 1);
            renderNotificationsUI();
        }
    } catch (err) {
        console.error('Failed to mark notification read:', err);
    }
}

async function markAllNotificationsRead() {
    try {
        const res = await authFetch('/api/notifications/read-all', { method: 'PUT' });
        const data = await res.json();
        if (data.success) {
            state.notifications.forEach(n => { n.is_read = 1; });
            state.unreadNotificationCount = 0;
            renderNotificationsUI();
            showToast('All notifications marked as read', 'info');
        }
    } catch (err) {
        console.error('Failed to mark all notifications read:', err);
    }
}

async function deleteNotification(id) {
    try {
        const res = await authFetch(`/api/notifications/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            state.notifications = state.notifications.filter(n => n.id !== id);
            state.unreadNotificationCount = data.unread_count ?? state.notifications.filter(n => !n.is_read).length;
            renderNotificationsUI();
            showToast('Notification removed', 'info');
        }
    } catch (err) {
        console.error('Failed to delete notification:', err);
    }
}

function setupNotificationListeners() {
    const bellBtn = document.getElementById('notificationBellBtn');
    const dropdown = document.getElementById('notificationDropdown');
    const markAllBtn = document.getElementById('markAllReadBtn');
    const wrapper = document.getElementById('notificationWrapper');

    if (bellBtn && dropdown) {
        bellBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = dropdown.classList.toggle('open');
            if (isOpen && state.currentUser) {
                loadNotifications();
            }
        });
    }

    if (markAllBtn) {
        markAllBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            markAllNotificationsRead();
        });
    }

    // Close dropdown on outside click
    document.addEventListener('click', (e) => {
        if (wrapper && !wrapper.contains(e.target)) {
            if (dropdown && dropdown.classList.contains('open')) {
                dropdown.classList.remove('open');
            }
        }
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && dropdown && dropdown.classList.contains('open')) {
            dropdown.classList.remove('open');
        }
    });
}
