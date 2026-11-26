<<<<<<< HEAD
# 🎓 ScholarFlow · Modern Student Task & Study Management System

[![Python](https://img.shields.io/badge/Python-3.9%20%7C%203.10%20%7C%203.11%20%7C%203.12%20%7C%203.13-blue.svg?logo=python&logoColor=white)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-3.0%2B-black.svg?logo=flask&logoColor=white)](https://flask.palletsprojects.com/)
[![SQLite](https://img.shields.io/badge/SQLite-3.0%2B-003B57.svg?logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![Chrome V8](https://img.shields.io/badge/E2E%20Tested-Google%20Chrome%20V8-success.svg?logo=googlechrome&logoColor=white)](https://www.google.com/chrome/)
[![License](https://img.shields.io/badge/License-Academic%20Submission-green.svg)](#)

> **ScholarFlow** is an enterprise-grade, privacy-centric student productivity application engineered with **Flask**, **SQLite**, and vanilla modern **CSS3 / ES6+ JavaScript**. It unifies individual academic dashboards, multi-stage Kanban workflows, interactive 3-view calendar scheduling, Pomodoro deep work timers, automated deadline reminders, course workload analytics, and responsive dark/light themes into a zero-external-dependency web application.

---

## 📋 Table of Contents
1. [Project Overview](#-project-overview)
2. [Key Features](#-key-features)
3. [Technology Stack](#-technology-stack)
4. [Project Architecture & Directory Structure](#-project-architecture--directory-structure)
5. [Installation & Setup (Windows & Cross-Platform)](#-installation--setup-windows--cross-platform)
6. [Running the Application](#-running-the-application)
7. [Automated Testing & Verification](#-automated-testing--verification)
8. [Production Deployment Guide](#-production-deployment-guide)
9. [Security, Privacy & Data Isolation](#-security-privacy--data-isolation)
10. [Screenshots & UI Walkthrough](#-screenshots--ui-walkthrough)
11. [Academic Submission Details](#-academic-submission-details)

---

## 🌟 Project Overview

Modern college students face cognitive overload balancing multiple courses, lab assignments, project milestones, exam preparations, and daily study habits. Existing commercial productivity tools often suffer from:
- Lack of academic context (no course linkage, credit weighting, or exam schedules).
- Fragmented workflows (separate apps for task lists, timers, calendars, and notes).
- Invasive tracking and subscription paywalls.

**ScholarFlow** addresses these challenges by providing a unified, self-contained academic productivity ecosystem:
- **Zero Heavy Frontend Frameworks**: Pure vanilla modern JavaScript (ES6+) and modern CSS3 custom properties with glassmorphism—providing instant load times and zero NPM supply-chain vulnerabilities.
- **Strict Per-Student Data Isolation**: Every database query enforces session-authenticated user ID filtering (`user_id = session['user_id']`), guaranteeing zero cross-account data leakage.
- **Synthesized Offline Audio**: Built-in Pomodoro bell and celebration chimes synthesized directly through the browser's native **Web Audio API** (zero external MP3/WAV dependencies).

---

## ✨ Key Features

### 1. 📊 Personalized Student Dashboard
- **Dynamic Welcome & Metrics**: Greets logged-in students by real name with time-of-day greetings (`"Good morning, Alex!"`), active date display, and real-time coursework metrics.
- **Academic KPI Cards**: Real-time counters for Total Coursework Items, To Do, In Progress, Completed, Overdue alerts, Study Hours logged, and consecutive Study Streak days.
- **🎯 Daily Agenda Planner Hub**: Real-time breakdown of tasks due today, upcoming 7-day deadlines, and scheduled study sessions with one-click creation buttons.

### 2. 📋 Interactive Workflow Kanban Board
- **3-Stage Visual Pipeline**: Organizes coursework across `To Do`, `In Progress`, and `Completed` columns.
- **Drag-and-Drop & Optimistic UI**: Native HTML5 drag-and-drop support with instant UI feedback and backend status synchronization via `PATCH /api/tasks/<id>/status`.
- **Kanban Task Cards**: Displays course badge accents, priority badges, estimated study hours, and subtask progress indicators.

### 3. 📅 Deadlines & Exam Calendar
- **3 Dynamic Views**: Seamlessly switch between **Month View** (grid schedule), **Week View** (7-day timeline), and **Day View** (hourly agenda drawer).
- **Multi-Category Filters**: Instant filter chips for *All Items*, *Assignments*, *Exams*, *Projects*, and *Study Sessions*, plus a *Show Completed* toggle.
- **Date Navigation**: Previous/Next interval controls and a `"Today"` instant-jump button.
- **Day Details Drawer**: Clicking any calendar date reveals all tasks and study blocks scheduled for that specific date.

### 4. ⏱️ Pomodoro Focus Room
- **3 Work Modes**: 25-minute Deep Focus, 5-minute Short Break, and 15-minute Long Break.
- **Task Association**: Link timer sessions directly to active coursework tasks to track real hours invested.
- **Web Audio Sound Effects**: Custom synthesized audio chimes for session completion with sound mute/unmute toggle.
- **Visual Circular Progress**: SVG-based dynamic radial countdown ring.

### 5. 🔔 Automated Notification & Reminder Engine
- **Proactive System Alerts**: Automatically evaluates deadlines on every poll and alerts students to:
  - Upcoming Assignments (due within 24–72 hours).
  - Upcoming Exams (scheduled within 7 days).
  - Overdue Tasks requiring immediate attention.
  - Scheduled Study Sessions for today.
- **Notification Dropdown**: Bell icon with real-time unread badge counter, individual mark-as-read, delete with permanent dismissal tracking, and `"Mark all read"` functionality.
- **Duplicate Prevention Engine**: Database-backed unique deduplication keys ensure duplicate notifications are never spawned.

### 6. 📚 Course / Subject Management
- **Subject Catalog**: Create semester courses with custom course codes (e.g., `CS 101`, `MATH 201`), descriptive titles, instructor names, and vibrant color palettes.
- **Sidebar Course Filtering**: Click any subject in the sidebar to instantly filter dashboard and calendar tasks to that course.
- **Safe Subject Deletion**: Removing a course automatically preserves all student tasks by gracefully reassigning them to general unassigned coursework.

### 7. 📈 Academic Performance Analytics
- **Task Completion Gauges**: Real-time percentage completion score.
- **Workload Breakdown**: Priority distribution bars (Urgent, High, Medium, Low).
- **Coursework Allocation Table**: Detailed breakdown showing total tasks, completed items, and study hours invested per subject.

### 8. 🎨 Professional UI/UX & Responsive Themes
- **Dark Obsidian & Light Ivory Themes**: High-contrast, accessibility-tested themes toggled with one click and persisted per student in `localStorage`.
- **Modern Glassmorphism**: Frosted glass panels (`backdrop-filter: blur`), subtle borders, and CSS custom property theming.
- **Fully Responsive**: Fluid drawer navigation, overlay backdrops, and optimized layouts for mobile phones (375px+), tablets (768px+), and desktops (1024px+).

---

## 🛠️ Technology Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Backend Framework** | **Python 3.9+ / Flask 3.0+** | Lightweight, high-performance RESTful API and template server |
| **Security & Auth** | **Werkzeug Security** | PBKDF2:SHA256 password hashing and HTTPOnly session cookies |
| **Database** | **SQLite 3** | Zero-configuration ACID-compliant relational SQL engine |
| **Frontend Architecture** | **HTML5 & Vanilla ES6+ JS** | Lightweight, high-speed UI with zero heavy frontend dependencies |
| **Styling & Theming** | **Modern CSS3 Custom Properties** | Obsidian Dark and Crisp Light themes with Glassmorphism |
| **Audio Synthesizer** | **HTML5 Web Audio API** | Real-time synthesized bell and chime frequencies (offline) |
| **Automated Testing** | **Chrome DevTools & Headless V8** | Headless real-browser DOM click and end-to-end execution testing |
| **Production Server** | **Waitress (Win) / Gunicorn (Linux)** | Multi-threaded WSGI production server readiness |

---

## 📂 Project Architecture & Directory Structure

```
ScholarFlow/
├── app.py                     # Main Flask Application & RESTful API Endpoints
├── database.py                # Database Connection, Schema Migrations & Seeding
├── requirements.txt           # Project Dependencies & Version Specifications
├── README.md                  # Comprehensive Project Guide & Documentation
├── DOCUMENTATION.md           # 14-Section Academic Project Report
├── DEMO_GUIDE.md              # Viva / Demo Presentation Step-by-Step Script
├── DEPLOYMENT.md              # Production Server & Deployment Readiness Guide
├── .env.example               # Environment Configuration Template
├── .gitignore                 # Git Ignore File for Security & Privacy
├── templates/
│   └── index.html             # Single-Page Web Application UI Shell
├── static/
│   ├── css/
│   │   └── style.css          # Design System, Glassmorphic Panels & Responsive Layouts
│   └── js/
│       └── app.js             # Client State Manager, Modal Handlers, Timer & API Client
└── scratch/                   # Automated Regression & Real-Browser Test Suites
    ├── run_browser_e2e_tests.py     # 70-Point Google Chrome Headless Test Runner
    ├── run_all_backend_tests.py    # Master Backend Regression Runner
    ├── test_phase7_ui_ux.py        # Phase 7 UI/UX & Authentication Test Suite (62 tests)
    └── test_phase6_notifications.py# Notification & Deduplication Suite (69 tests)
```

---

## 💻 Installation & Setup (Windows & Cross-Platform)

### 1. Prerequisites
- **Python 3.9 or higher** (Python 3.10–3.13 supported).
- Verify Python and pip in your terminal:
  ```powershell
  python --version
  pip --version
  ```

### 2. Clone or Extract Project
Open PowerShell or Command Prompt in the project folder:
```powershell
cd "c:\Users\anil\Desktop\StudentTask Manager backup"
```

### 3. (Optional but Recommended) Create a Virtual Environment
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

### 4. Install Dependencies
```powershell
pip install -r requirements.txt
```

### 5. Configure Environment Variables
Copy `.env.example` to `.env`:
```powershell
copy .env.example .env
```

---

## 🚀 Running the Application

### Option A: Development Server
```powershell
python app.py
```
*Console output:*
```
Starting ScholarFlow server on http://127.0.0.1:5000 (debug=False) ...
```
Open your browser and navigate to: **[http://127.0.0.1:5000](http://127.0.0.1:5000)**

### Option B: Production Server (Windows with Waitress)
```powershell
pip install waitress
waitress-serve --host=127.0.0.1 --port=5000 app:app
```

### Option C: Production Server (Linux with Gunicorn)
```bash
gunicorn --workers 4 --bind 127.0.0.1:5000 app:app
```

---

## 🧪 Automated Testing & Verification

ScholarFlow includes automated regression suites testing both backend API logic and live in-browser DOM interactions.

### 1. Execute All Backend Regression Test Suites (145+ Tests)
```powershell
python scratch/run_all_backend_tests.py
```
*Results:*
- `test_phase7_ui_ux.py`: **62/62 PASSED**
- `test_phase6_notifications.py`: **69/69 PASSED**
- `test_audit_calendar_planner.py`: **8/8 PASSED**
- `test_phase5_calendar_planner.py`: **6/6 PASSED**

### 2. Execute Real-Browser In-Browser E2E Tests (70 Tests)
Tests click events, modals, dropdowns, timers, and DOM mutations inside the **Google Chrome V8 Engine**:
```powershell
python scratch/run_browser_e2e_tests.py
```
*Results:*
```
======================================================================
BROWSER TEST RESULTS (GOOGLE CHROME V8 ENGINE):
======================================================================
[PASS] Welcome Banner displays logged-in student name (Sophia Hayes)
[PASS] Sidebar displays logged-in student name (Sophia Hayes)
[PASS] Navigation button #nav-kanban exists
[PASS] Clicking #nav-kanban activates tab pane #tab-kanban
[PASS] Navigation button #nav-calendar exists
[PASS] Clicking #nav-calendar activates tab pane #tab-calendar
[PASS] Navigation button #nav-pomodoro exists
[PASS] Clicking #nav-pomodoro activates tab pane #tab-pomodoro
[PASS] Navigation button #nav-analytics exists
[PASS] Clicking #nav-analytics activates tab pane #tab-analytics
[PASS] Navigation button #nav-dashboard exists
[PASS] Clicking #nav-dashboard activates tab pane #tab-dashboard
[PASS] Theme toggle button exists in DOM
[PASS] Clicking Theme Toggle switches data-theme attribute
[PASS] Repaired: #dashAddNewTaskBtn button exists on Agenda
[PASS] Repaired: Clicking #dashAddNewTaskBtn opens #taskModal
[PASS] Clicking #cancelTaskModalBtn closes #taskModal
[PASS] Repaired: #dashPlanStudySessionBtn button exists on Agenda
[PASS] Repaired: Clicking #dashPlanStudySessionBtn opens #studySessionModal
[PASS] Clicking #cancelSessionModalBtn closes #studySessionModal
[PASS] Clicking #welcomeAddTaskBtn opens #taskModal
[PASS] Clicking #closeTaskModalBtn closes #taskModal
[PASS] #openAddCourseModalBtn exists in sidebar
[PASS] Clicking #openAddCourseModalBtn opens #courseModal
[PASS] Submitting courseForm closes #courseModal
[PASS] Newly added course CHEM 101 renders in sidebar
[PASS] Subtask renders inside modal checklist
[PASS] Submitting taskForm closes #taskModal
[PASS] Created task appears in #tasksListContainer
[PASS] Submitting studySessionForm closes #studySessionModal
[PASS] Calendar Week View button toggles active state
[PASS] Calendar Day View button toggles active state
[PASS] Calendar Month View button toggles active state
[PASS] Next calendar navigation works cleanly
[PASS] Prev calendar navigation works cleanly
[PASS] Today calendar navigation works cleanly
[PASS] Calendar category chips exist
[PASS] Clicking category chip activates it
[PASS] Pomodoro #startTimerBtn exists
[PASS] Clicking #startTimerBtn starts timer (isRunning: true)
[PASS] Clicking #startTimerBtn pauses timer (isRunning: false)
[PASS] Clicking #resetTimerBtn resets remaining seconds
[PASS] Clicking #soundToggleBtn toggles soundEnabled
[PASS] Pomodoro mode switcher buttons exist (3 modes)
[PASS] Clicking Short Break mode sets 5-minute timer
[PASS] Clicking Focus mode sets 25-minute timer
[PASS] Notification bell button exists
[PASS] Clicking #notificationBellBtn opens notification dropdown
[PASS] Clicking 'Mark all read' executes cleanly
[PASS] Clicking #notificationBellBtn closes dropdown
[PASS] showConfirmModal() opens #confirmModal
[PASS] Clicking #confirmCancelBtn resolves false and closes modal
[PASS] Task edit button .btn-edit-task exists in task list
[PASS] Clicking .btn-edit-task opens task modal with data
[PASS] Editing task updates title in UI
[PASS] Task delete button .btn-delete-task exists in task list
[PASS] Clicking .btn-delete-task triggers #confirmModal
[PASS] Cancelling delete preserves task in list
[PASS] Confirming delete removes task from DOM
[PASS] Course delete button .course-item-del-btn exists in sidebar
[PASS] Clicking course delete button triggers #confirmModal
[PASS] Cancelling preserves course in sidebar
[PASS] Confirming deletes course from sidebar list
[PASS] Clicking #tabBtnRegister shows register form
[PASS] Clicking #tabBtnLogin shows login form
[PASS] Logout button #logoutBtn exists in sidebar
[PASS] Clicking #logoutBtn clears currentUser state
[PASS] Logout opens #authModal
[PASS] Logout clears task list container
[PASS] Zero uncaught JavaScript exceptions during browser execution
======================================================================
SUMMARY: 70/70 BROWSER TESTS PASSED (100.0%)
======================================================================
```

---

## 🔒 Security, Privacy & Data Isolation

1. **Password Hashing**: Passwords are never stored in plaintext. Passwords use **Werkzeug PBKDF2:SHA256** with unique salts (`generate_password_hash` and `check_password_hash`).
2. **Session Cookies**: Session cookies have `HTTPOnly=True` and `SameSite='Lax'` to prevent Cross-Site Scripting (XSS) cookie theft.
3. **Strict SQL Isolation**: Every query checks `WHERE user_id = ?` using the session's authenticated user ID. Cross-account access attempts return `404 Not Found`.
4. **Git Safety**: The `.gitignore` file strictly blocks database files (`*.db`), environment secrets (`.env`), and test artifacts from being committed to public repositories.

---

## 📸 Screenshots & UI Walkthrough

| View | Description |
| :--- | :--- |
| **Academic Dashboard** | Header greeting, 8 KPI cards, Daily Agenda planner hub, multi-filter task list with subtasks |
| **Kanban Board** | Visual 3-stage board (`To Do`, `In Progress`, `Completed`) with native drag-and-drop |
| **Deadlines Calendar** | Monthly view with color-coded exam and assignment indicators, week view, and day agenda drawer |
| **Pomodoro Focus Room**| Circular radial countdown timer, 25m/5m/15m mode buttons, task linkage, and Web Audio chime |
| **Academic Analytics** | Completion gauge, priority distribution bars, and course-by-course workload table |
| **Notification Center**| Bell icon with live unread counter, upcoming deadline reminders, overdue alerts, and dismissal engine |

---

## 🎓 Academic Submission Details

- **Project Title**: ScholarFlow – Student Task & Study Management Web Application
- **Course**: Final Year / Semester Academic Project Submission
- **System Architecture**: Model-View-Controller (MVC) Client-Server Architecture
- **Primary Modules**: Authentication, Task CRUD, Course Management, Kanban Pipeline, Deadlines Calendar, Pomodoro Timer, Automated Notification Engine, Academic Analytics, and Accessibility Theming
- **Verification Status**: Complete (Phases 1–7.5 Verified, 100% Tests Passing)

---

*ScholarFlow · Empowering students to stay organized, beat deadlines, and master their semester.*
=======
# scholarflow-student-task-manager
A Flask-based Student Task and Study Management System.
>>>>>>> c4800c11af5a8641d66b8c8ff5534b35ae7fbded
