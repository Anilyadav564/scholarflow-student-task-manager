# 🎓 ScholarFlow: Project Demonstration & Viva Presentation Guide

This guide provides a step-by-step walkthrough to successfully present and demonstrate the **ScholarFlow Student Task Manager** during a college project review, evaluation viva, or faculty panel presentation.

---

## 🚀 1. Application Startup Instructions

### Step 1: Open Terminal (PowerShell or Command Prompt)
Navigate to the project root directory:
```powershell
cd "c:\Users\anil\Desktop\StudentTask Manager backup"
```

### Step 2: Start the Application
Run the Flask server:
```powershell
python app.py
```
*Expected Console Output:*
```
Starting ScholarFlow server on http://127.0.0.1:5000 (debug=False) ...
```

### Step 3: Open in Browser
Open your browser (Google Chrome, Edge, Firefox, or Safari) and navigate to:
👉 **[http://127.0.0.1:5000](http://127.0.0.1:5000)**

---

## 🎬 2. Step-by-Step Live Demonstration Script

Follow these steps during your presentation to showcase the complete feature set in 5 to 7 minutes:

### Stage 1: Student Registration & Authentication
1. **Show Auth Modal**: When navigating to `http://127.0.0.1:5000` while logged out, the application displays a clean, modal-based authentication screen.
2. **Tab Switching**: Click `"Create Account"` to switch to registration. Click `"Sign In"` or `"Create one now"` to highlight seamless tab switching.
3. **Register a New Student**:
   - **Name**: `Alex Morgan` (or your presenter name)
   - **Email**: `alex.demo@scholarflow.edu`
   - **Password**: `demoPass123`
   - **Confirm Password**: `demoPass123`
   - Click `"Create Student Account"`.
4. **Instant Login & Feedback**: Note the green toast notification `"Welcome to ScholarFlow, Alex Morgan!"`. The modal closes automatically.

---

### Stage 2: Personalized Academic Dashboard
1. **Personalized Welcome Banner**:
   - Point out the greeting: `"Good morning, Alex Morgan!"` (dynamically adapts based on current local time).
   - Point out today's date prominently displayed.
2. **KPI Metric Cards**:
   - Point out the 8 real-time metric cards (Total Coursework Items, To Do, In Progress, Completed, Overdue alerts, Completion Rate, Enrolled Subjects, and Study Hours).
3. **🎯 Daily Agenda Planner Hub**:
   - Point out the three sections: *Today's Agenda*, *Upcoming 7-Day Deadlines*, and *Today's Study Blocks*.
   - Point out the quick action buttons: `"Plan Study Session"` (`#dashPlanStudySessionBtn`) and `"Add Task"` (`#dashAddNewTaskBtn`).

---

### Stage 3: Subject / Course Management
1. **Open Subject Creator**:
   - In the left sidebar, click the `+` icon button next to **"Subjects"** (`#openAddCourseModalBtn`).
2. **Create Course 1**:
   - **Course Code**: `CS 350`
   - **Title**: `Operating Systems & Concurrency`
   - **Instructor**: `Prof. Andrew Tanenbaum`
   - **Color**: Select the Indigo or Violet swatch.
   - Click `"Create Subject"`.
3. **Verify Course Display**:
   - Point out `CS 350` now appears in the sidebar with its color accent dot and task counter.
4. **Create Course 2**:
   - **Course Code**: `MATH 201`
   - **Title**: `Linear Algebra & Matrix Theory`
   - **Color**: Select the Pink or Emerald swatch.
   - Click `"Create Subject"`.

---

### Stage 4: Task Management & Subtask Checklists
1. **Create Task 1 (With Subtasks)**:
   - Click the `"Add Task"` button on the Daily Agenda (`#dashAddNewTaskBtn`).
   - **Task Title**: `Kernel Process Scheduler Lab`
   - **Course**: Select `CS 350 - Operating Systems`.
   - **Category**: `Assignment`
   - **Priority**: `High`
   - **Due Date**: Select a date 2 days from today.
   - **Estimated Hours**: `4.5`
   - **Add Milestone Checklist Steps**:
     - Type `Implement Round-Robin algorithm` in the subtask field and click `+ Add Step` (or press Enter).
     - Type `Test context switching overhead` and press Enter.
     - Type `Write final laboratory report` and press Enter.
   - Click `"Save Task"`.
2. **Review Task Card**:
   - The card renders with the high-priority tag, `CS 350` color badge, estimated hours, and a milestone checklist with a live progress bar.
   - Check off the first subtask: notice the progress bar animates from 0% to 33%!
3. **Task Editing**:
   - Click the Edit (pencil) icon on the task card. Modify the estimated hours to `5.0`. Save and verify instant update.

---

### Stage 5: Kanban Workflow Board
1. **Navigate to Kanban**:
   - Click **"Kanban Board"** in the sidebar navigation (`#nav-kanban`).
2. **Visual Pipeline**:
   - The task appears in the **"To Do"** column.
3. **Drag-and-Drop Interaction**:
   - Drag the card from **"To Do"** and drop it into **"In Progress"**.
   - Note the dropzone highlight effect and the instant column count badge update (`In Progress (1)`).
   - Drag it to **"Completed"**; note the completion badge increments and the status synchronizes with the database.

---

### Stage 6: Deadlines & Exam Calendar
1. **Navigate to Calendar**:
   - Click **"Schedule & Deadlines"** in the sidebar (`#nav-calendar`).
2. **Month View**:
   - The scheduled task appears on its exact due date with the `CS 350` color dot.
3. **Filter Chips**:
   - Click the `"Assignments"` chip: only assignments are displayed.
   - Click the `"All Items"` chip to reset.
4. **Switch Calendar Views**:
   - Click `"Week"`: shows a 7-day horizontal timeline grid.
   - Click `"Day"`: shows the day's scheduled hourly blocks.
   - Click `"Today"`: immediately resets the view to the current date.
5. **Day Details Drawer**:
   - Click on any day cell: an overlay drawer slides out showing all tasks and study sessions scheduled for that date, with quick add buttons.

---

### Stage 7: Pomodoro Focus Room
1. **Navigate to Pomodoro**:
   - Click **"Pomodoro Focus"** in the sidebar (`#nav-pomodoro`).
2. **Timer Controls**:
   - Point out the circular countdown display (default: `25:00`).
   - Select the task dropdown: choose `[CS 350] Kernel Process Scheduler Lab`.
   - Click `"Start Focus"`. The radial ring activates and countdown begins.
   - Click `"Pause"` to demonstrate pause functionality.
   - Click `"Reset"` to demonstrate reset.
3. **Mode Switchers**:
   - Click `"Short Break (5m)"`: timer resets to `05:00`.
   - Click `"Long Break (15m)"`: timer resets to `15:00`.
   - Click `"Focus (25m)"`: resets back to `25:00`.
4. **Web Audio Demonstration**:
   - Click the `"Sound: ON"` button: toggles between sound enabled and muted.
   - Emphasize to the examiners that all audio tones are synthesized directly via the HTML5 Web Audio API with zero external audio files.

---

### Stage 8: Automated Notification Center
1. **Notification Bell**:
   - Point out the notification bell icon in the top header (`#notificationBellBtn`) with its real-time unread badge.
2. **Open Dropdown**:
   - Click the bell: an elegant glassmorphic dropdown reveals active deadline reminders.
3. **Actions**:
   - Click the checkmark icon to mark a notification as read.
   - Click `"Mark all read"`: the unread pill updates to `0 unread` and the red badge disappears.
   - Emphasize the duplicate prevention engine that prevents deleted notifications from reappearing.

---

### Stage 9: Performance Analytics
1. **Navigate to Analytics**:
   - Click **"Analytics & Stats"** in the sidebar (`#nav-analytics`).
2. **Metrics Breakdown**:
   - View the overall task completion score.
   - View the active priority workload distribution bars.
   - Point out the Course Workload table showing tasks and study hours per subject.

---

### Stage 10: Dark / Light Theme & Logout
1. **Theme Toggle**:
   - In the bottom-left sidebar, click the `"Dark Mode"` toggle button (`#themeToggleBtn`).
   - The entire application transitions seamlessly into a crisp, high-contrast **Light Ivory Theme**.
   - Click it again to switch back to the **Obsidian Dark Theme**.
2. **Safe Logout**:
   - Click the `"Log Out"` button in the sidebar or top bar.
   - The student session is cleared, the dashboard data is reset, and the authentication modal reappears.

---

## 🎤 3. College Project Review Presentation Outline (Slides / Viva)

Use this structured outline for your presentation slides:

| Slide # | Title | Key Talking Points |
| :---: | :--- | :--- |
| **1** | **Title & Introduction** | Project Title: *ScholarFlow – Student Task & Study Manager*. Student Name, Department, College, Date. |
| **2** | **Motivation & Problem Statement** | Academic disorganization, missed exam deadlines, cognitive overload, app fatigue from juggling multiple tools. |
| **3** | **Project Objectives** | Unified academic hub, strict student data privacy, zero heavy dependencies, interactive calendar & Kanban, Pomodoro with synthesized audio. |
| **4** | **System Architecture** | Model-View-Controller (MVC) architecture, RESTful JSON APIs, session cookies, database connection lifecycle. |
| **5** | **Database Schema (ERD)** | Relational tables (`users`, `courses`, `tasks`, `subtasks`, `study_sessions`, `notifications`, `dismissals`) with foreign keys and cascading integrity. |
| **6** | **Core Modules & Innovation** | Daily Agenda Hub, Drag-and-Drop Kanban, 3-view Deadlines Calendar, Web Audio Pomodoro room, automated notification deduplication engine. |
| **7** | **Live Demonstration** | 5-minute live demonstration following the walkthrough script above. |
| **8** | **Testing & Results** | 145/145 Backend regression tests passed; 70/70 Google Chrome Headless in-browser tests passed (100% pass rate). |
| **9** | **Key Advantages & Impact** | Lightweight, high-speed, zero npm vulnerabilities, privacy-first, beautiful dark/light themes. |
| **10** | **Conclusion & Future Scope** | Summary of deliverables, mobile push notifications, iCal calendar synchronization, syllabus PDF parsing. |

---

## 💡 4. Anticipated Viva / Examiner Questions & Answers

**Q1: Why did you choose SQLite instead of MySQL or PostgreSQL?**  
*Answer:* SQLite is a serverless, self-contained, zero-configuration database ideal for desktop productivity applications. It eliminates database server setup requirements while providing full ACID transactions and foreign-key integrity. For high-concurrency cloud deployments, our clean abstraction in `database.py` allows seamless migration to PostgreSQL by simply switching the connection adapter.

**Q2: How do you prevent Student A from accessing Student B's coursework?**  
*Answer:* Every single database query strictly enforces session verification through our `@login_required` decorator and parameterizes `WHERE user_id = ?` using the cryptographically signed session cookie (`session['user_id']`). Any attempt by another user to query or modify an unowned record returns a `404 Not Found` response.

**Q3: Why did you use vanilla JavaScript instead of React or Vue?**  
*Answer:* Modern vanilla ES6+ JavaScript and CSS3 custom properties provide complete native support for DOM manipulation, CSS grid, Flexbox, and async fetch without the overhead of hundreds of megabytes of `node_modules`, complex Webpack/Vite compilation steps, or security supply-chain risks. The entire ScholarFlow client loads in less than 50 milliseconds.

**Q4: How does the notification system avoid sending duplicate alerts?**  
*Answer:* Each notification is assigned a deterministic deduplication key (e.g., `assignment_<task_id>_due_<date>`). The database schema enforces unique dismissals in `notification_dismissals`. When a student dismisses an alert, its key is permanently logged so subsequent background evaluations never recreate it.

**Q5: How do the audio chimes work without audio files?**  
*Answer:* We utilize the native HTML5 Web Audio API. Our JavaScript creates an `AudioContext`, spawns an `OscillatorNode` at specific frequencies (e.g., 880Hz for an A5 note), modulates the volume using an `ExponentialRampToValueAtTime` gain envelope, and plays a synthesized chime directly through the hardware speakers without requiring external `.mp3` or `.wav` files.

