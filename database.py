import sqlite3
import os
import shutil
from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash

DB_PATH = os.environ.get('DATABASE_PATH', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'student_tasks.db'))
BACKUP_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'student_tasks_backup.db')

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def backup_db():
    """Creates a safety copy of student_tasks.db before any changes."""
    if os.path.exists(DB_PATH) and not os.path.exists(BACKUP_PATH):
        shutil.copy2(DB_PATH, BACKUP_PATH)
        print(f"[Backup] Successfully created database backup at: {BACKUP_PATH}")
    elif os.path.exists(BACKUP_PATH):
        print(f"[Backup] Backup already exists at: {BACKUP_PATH}")

def migrate_tables_if_needed(conn, default_user_id):
    """
    Safely migrates existing tables to associate them with a user_id
    and adjusts constraints (e.g. per-student unique course codes).
    """
    cursor = conn.cursor()

    # 1. Courses Table Migration
    cursor.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='courses';")
    courses_row = cursor.fetchone()
    if not courses_row:
        cursor.execute('''
            CREATE TABLE courses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                code TEXT NOT NULL,
                name TEXT NOT NULL,
                color TEXT NOT NULL,
                instructor TEXT,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                UNIQUE (user_id, code)
            );
        ''')
    else:
        courses_sql = courses_row[0]
        # Check if user_id is present and compound UNIQUE (user_id, code) is active
        has_compound_unique = ('UNIQUE (user_id, code)' in courses_sql or 'UNIQUE(user_id, code)' in courses_sql)
        has_user_id = 'user_id' in courses_sql

        if not has_user_id or not has_compound_unique:
            print("[Migration] Migrating 'courses' table to support per-student ownership and unique codes...")
            cursor.execute("PRAGMA foreign_keys = OFF;")
            cursor.execute('''
                CREATE TABLE courses_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    code TEXT NOT NULL,
                    name TEXT NOT NULL,
                    color TEXT NOT NULL,
                    instructor TEXT,
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                    UNIQUE (user_id, code)
                );
            ''')
            cursor.execute("PRAGMA table_info(courses);")
            old_course_cols = [c[1] for c in cursor.fetchall()]
            if 'user_id' in old_course_cols:
                cursor.execute('''
                    INSERT INTO courses_new (id, user_id, code, name, color, instructor)
                    SELECT id, user_id, code, name, color, instructor FROM courses;
                ''')
            else:
                cursor.execute('''
                    INSERT INTO courses_new (id, user_id, code, name, color, instructor)
                    SELECT id, ?, code, name, color, instructor FROM courses;
                ''', (default_user_id,))
            cursor.execute("DROP TABLE courses;")
            cursor.execute("ALTER TABLE courses_new RENAME TO courses;")
            conn.commit()
            cursor.execute("PRAGMA foreign_keys = ON;")

    # 2. Tasks Table Migration
    cursor.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='tasks';")
    tasks_row = cursor.fetchone()
    if not tasks_row:
        cursor.execute('''
            CREATE TABLE tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                course_id INTEGER,
                category TEXT NOT NULL DEFAULT 'Assignment',
                priority TEXT NOT NULL DEFAULT 'Medium',
                status TEXT NOT NULL DEFAULT 'todo',
                due_date TEXT NOT NULL,
                estimated_hours REAL DEFAULT 1.0,
                spent_hours REAL DEFAULT 0.0,
                created_at TEXT NOT NULL,
                updated_at TEXT,
                completed_at TEXT,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                FOREIGN KEY (course_id) REFERENCES courses (id) ON DELETE SET NULL
            );
        ''')
    else:
        tasks_sql = tasks_row[0]
        if 'user_id' not in tasks_sql:
            print("[Migration] Migrating 'tasks' table to add student ownership (user_id)...")
            cursor.execute("PRAGMA foreign_keys = OFF;")
            cursor.execute('''
                CREATE TABLE tasks_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    title TEXT NOT NULL,
                    description TEXT,
                    course_id INTEGER,
                    category TEXT NOT NULL DEFAULT 'Assignment',
                    priority TEXT NOT NULL DEFAULT 'Medium',
                    status TEXT NOT NULL DEFAULT 'todo',
                    due_date TEXT NOT NULL,
                    estimated_hours REAL DEFAULT 1.0,
                    spent_hours REAL DEFAULT 0.0,
                    created_at TEXT NOT NULL,
                    updated_at TEXT,
                    completed_at TEXT,
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                    FOREIGN KEY (course_id) REFERENCES courses (id) ON DELETE SET NULL
                );
            ''')
            cursor.execute('''
                INSERT INTO tasks_new (id, user_id, title, description, course_id, category, priority, status, due_date, estimated_hours, spent_hours, created_at, updated_at, completed_at)
                SELECT id, ?, title, description, course_id, category, priority, status, due_date, estimated_hours, spent_hours, created_at, created_at, completed_at FROM tasks;
            ''', (default_user_id,))
            cursor.execute("DROP TABLE tasks;")
            cursor.execute("ALTER TABLE tasks_new RENAME TO tasks;")
            conn.commit()
            cursor.execute("PRAGMA foreign_keys = ON;")

    # Ensure updated_at column exists in tasks
    cursor.execute("PRAGMA table_info(tasks);")
    task_cols = [c[1] for c in cursor.fetchall()]
    if 'updated_at' not in task_cols:
        print("[Migration] Adding 'updated_at' column to tasks table...")
        cursor.execute("ALTER TABLE tasks ADD COLUMN updated_at TEXT;")
        cursor.execute("UPDATE tasks SET updated_at = created_at WHERE updated_at IS NULL;")
        conn.commit()

    # Create indexes for performance, per-student querying, and sorting
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks (user_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON tasks (user_id, status);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_tasks_user_due_date ON tasks (user_id, due_date);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_tasks_user_priority ON tasks (user_id, priority);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_tasks_user_course ON tasks (user_id, course_id);")
    conn.commit()

    # 3. Subtasks Table (Ensures table exists, references tasks(id) on delete cascade)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS subtasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            is_completed INTEGER DEFAULT 0,
            FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE
        );
    ''')

    # 4. Study Sessions Table Migration
    cursor.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='study_sessions';")
    sessions_row = cursor.fetchone()
    if not sessions_row:
        cursor.execute('''
            CREATE TABLE study_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                course_id INTEGER,
                task_id INTEGER,
                topic TEXT NOT NULL DEFAULT 'Study Session',
                session_date TEXT NOT NULL,
                start_time TEXT DEFAULT '09:00',
                end_time TEXT DEFAULT '10:00',
                duration_minutes INTEGER NOT NULL DEFAULT 60,
                created_at TEXT NOT NULL,
                notes TEXT,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                FOREIGN KEY (course_id) REFERENCES courses (id) ON DELETE SET NULL,
                FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE SET NULL
            );
        ''')
    else:
        sessions_sql = sessions_row[0]
        if 'user_id' not in sessions_sql:
            print("[Migration] Migrating 'study_sessions' table to add student ownership (user_id)...")
            cursor.execute("PRAGMA foreign_keys = OFF;")
            cursor.execute('''
                CREATE TABLE study_sessions_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    course_id INTEGER,
                    task_id INTEGER,
                    topic TEXT NOT NULL DEFAULT 'Study Session',
                    session_date TEXT NOT NULL,
                    start_time TEXT DEFAULT '09:00',
                    end_time TEXT DEFAULT '10:00',
                    duration_minutes INTEGER NOT NULL DEFAULT 60,
                    created_at TEXT NOT NULL,
                    notes TEXT,
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                    FOREIGN KEY (course_id) REFERENCES courses (id) ON DELETE SET NULL,
                    FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE SET NULL
                );
            ''')
            cursor.execute('''
                INSERT INTO study_sessions_new (id, user_id, course_id, task_id, topic, session_date, start_time, end_time, duration_minutes, created_at, notes)
                SELECT id, ?, NULL, task_id, 'Study Session', substr(created_at, 1, 10), '09:00', '10:00', duration_minutes, created_at, notes FROM study_sessions;
            ''', (default_user_id,))
            cursor.execute("DROP TABLE study_sessions;")
            cursor.execute("ALTER TABLE study_sessions_new RENAME TO study_sessions;")
            conn.commit()
            cursor.execute("PRAGMA foreign_keys = ON;")

    # Check and add missing study_sessions columns if table already exists
    cursor.execute("PRAGMA table_info(study_sessions);")
    existing_cols = [c[1] for c in cursor.fetchall()]
    if 'topic' not in existing_cols:
        print("[Migration] Adding 'topic' column to study_sessions table...")
        cursor.execute("ALTER TABLE study_sessions ADD COLUMN topic TEXT DEFAULT 'Study Session';")
    if 'course_id' not in existing_cols:
        print("[Migration] Adding 'course_id' column to study_sessions table...")
        cursor.execute("ALTER TABLE study_sessions ADD COLUMN course_id INTEGER REFERENCES courses(id) ON DELETE SET NULL;")
    if 'session_date' not in existing_cols:
        print("[Migration] Adding 'session_date' column to study_sessions table...")
        cursor.execute("ALTER TABLE study_sessions ADD COLUMN session_date TEXT;")
        cursor.execute("UPDATE study_sessions SET session_date = substr(created_at, 1, 10) WHERE session_date IS NULL;")
    if 'start_time' not in existing_cols:
        print("[Migration] Adding 'start_time' column to study_sessions table...")
        cursor.execute("ALTER TABLE study_sessions ADD COLUMN start_time TEXT DEFAULT '09:00';")
    if 'end_time' not in existing_cols:
        print("[Migration] Adding 'end_time' column to study_sessions table...")
        cursor.execute("ALTER TABLE study_sessions ADD COLUMN end_time TEXT DEFAULT '10:00';")

    # Backfill topic and course_id from associated task if task_id exists
    cursor.execute('''
        UPDATE study_sessions 
        SET topic = (SELECT title FROM tasks WHERE tasks.id = study_sessions.task_id)
        WHERE task_id IS NOT NULL AND (topic IS NULL OR topic = 'Study Session')
          AND EXISTS (SELECT 1 FROM tasks WHERE tasks.id = study_sessions.task_id);
    ''')
    cursor.execute('''
        UPDATE study_sessions 
        SET course_id = (SELECT course_id FROM tasks WHERE tasks.id = study_sessions.task_id)
        WHERE task_id IS NOT NULL AND course_id IS NULL
          AND EXISTS (SELECT 1 FROM tasks WHERE tasks.id = study_sessions.task_id);
    ''')

    cursor.execute("CREATE INDEX IF NOT EXISTS idx_subtasks_task_id ON subtasks (task_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_study_sessions_user_id ON study_sessions (user_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_study_sessions_date ON study_sessions (user_id, session_date);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_study_sessions_course ON study_sessions (user_id, course_id);")
    conn.commit()

    # 5. Create notifications table if not exists with duplicate prevention
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            type TEXT NOT NULL,
            related_type TEXT,
            related_id INTEGER,
            is_read INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            dedup_key TEXT UNIQUE,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        );
    ''')
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications (user_id, is_read);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications (user_id, created_at DESC);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_notifications_dedup ON notifications (dedup_key);")
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS notification_dismissals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            dedup_key TEXT NOT NULL,
            dismissed_at TEXT NOT NULL,
            UNIQUE(user_id, dedup_key),
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        );
    ''')
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_notif_dismiss_user ON notification_dismissals (user_id, dedup_key);")
    conn.commit()

    # 6. Check foreign key consistency
    cursor.execute("PRAGMA foreign_key_check;")
    fk_errors = cursor.fetchall()
    if fk_errors:
        raise RuntimeError(f"Foreign key integrity check failed after migration: {fk_errors}")

def init_db():
    """Initializes the database, runs migrations if necessary, and seeds data if empty."""
    backup_db()
    conn = get_db()
    cursor = conn.cursor()

    # 1. Create users table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
    ''')
    conn.commit()

    # 2. Check or create initial default student account for existing data preservation
    cursor.execute('SELECT id FROM users ORDER BY id ASC LIMIT 1;')
    row = cursor.fetchone()
    if row:
        default_user_id = row[0]
    else:
        # Default student account preserves existing tasks for Alex Morgan
        default_pw_hash = generate_password_hash('student123')
        now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        cursor.execute('''
            INSERT INTO users (name, email, password_hash, created_at)
            VALUES (?, ?, ?, ?);
        ''', ('Alex Morgan', 'alex.morgan@scholarflow.edu', default_pw_hash, now_str))
        conn.commit()
        default_user_id = cursor.lastrowid
        print(f"[Seed User] Created initial student account: Alex Morgan (ID: {default_user_id})")

    # 3. Migrate tables to include user ownership and updated constraints
    migrate_tables_if_needed(conn, default_user_id)

    # 4. Seed initial data if courses is completely empty
    cursor = conn.cursor()
    cursor.execute('SELECT COUNT(*) FROM courses;')
    if cursor.fetchone()[0] == 0:
        seed_data(conn, default_user_id)

    conn.close()

def seed_data(conn, user_id):
    """Inserts sample courses, tasks, subtasks, and study sessions for a given user."""
    cursor = conn.cursor()

    # Seed Courses
    courses = [
        (user_id, 'CS 301', 'Data Structures & Algorithms', '#6366f1', 'Prof. Alan Turing'),
        (user_id, 'MATH 240', 'Linear Algebra & Matrices', '#ec4899', 'Dr. Katherine Johnson'),
        (user_id, 'PHYS 210', 'Electromagnetism & Optics', '#06b6d4', 'Prof. Richard Feynman'),
        (user_id, 'ENG 105', 'Technical Writing & Ethics', '#f59e0b', 'Dr. Maya Angelou'),
        (user_id, 'AI 420', 'Deep Learning & Neural Nets', '#8b5cf6', 'Dr. Geoffrey Hinton')
    ]
    cursor.executemany(
        'INSERT INTO courses (user_id, code, name, color, instructor) VALUES (?, ?, ?, ?, ?);',
        courses
    )

    now = datetime.now()
    today_str = now.strftime('%Y-%m-%dT18:00')
    tomorrow_str = (now + timedelta(days=1)).strftime('%Y-%m-%dT15:30')
    in_3_days_str = (now + timedelta(days=3)).strftime('%Y-%m-%dT23:59')
    in_5_days_str = (now + timedelta(days=5)).strftime('%Y-%m-%dT11:00')
    past_due_str = (now - timedelta(days=1)).strftime('%Y-%m-%dT20:00')
    next_week_str = (now + timedelta(days=7)).strftime('%Y-%m-%dT14:00')

    # Seed Tasks
    tasks = [
        (
            user_id,
            'Implement Red-Black Tree in C++',
            'Write self-balancing binary search tree insertions, rotations and deletion tests for Lab 4.',
            1, 'Assignment', 'Urgent', 'in_progress', today_str, 4.0, 2.5,
            now.strftime('%Y-%m-%d %H:%M:%S'), now.strftime('%Y-%m-%d %H:%M:%S'), None
        ),
        (
            user_id,
            'Midterm Exam Preparation - Eigenvalues & SVD',
            'Review chapter 6 on Orthogonality, Gram-Schmidt process, and practice past year exam papers.',
            2, 'Exam', 'Urgent', 'todo', tomorrow_str, 6.0, 1.0,
            now.strftime('%Y-%m-%d %H:%M:%S'), now.strftime('%Y-%m-%d %H:%M:%S'), None
        ),
        (
            user_id,
            'Convolutional Neural Network for Image Classification',
            'Train ResNet architecture on CIFAR-10, plot loss curves and write analysis in report.',
            5, 'Project', 'High', 'in_progress', in_3_days_str, 8.0, 3.5,
            now.strftime('%Y-%m-%d %H:%M:%S'), now.strftime('%Y-%m-%d %H:%M:%S'), None
        ),
        (
            user_id,
            'Maxwell Equations Problem Set 5',
            'Solve problems 5.1 through 5.14 involving boundary conditions and wave propagation in dielectric media.',
            3, 'Homework', 'Medium', 'todo', in_5_days_str, 3.0, 0.0,
            now.strftime('%Y-%m-%d %H:%M:%S'), now.strftime('%Y-%m-%d %H:%M:%S'), None
        ),
        (
            user_id,
            'Draft Research Ethics Proposal',
            'Complete the 3-page draft exploring privacy implications of generative AI agents in academic research.',
            4, 'Reading', 'Low', 'completed', past_due_str, 2.5, 2.5,
            (now - timedelta(days=3)).strftime('%Y-%m-%d %H:%M:%S'),
            (now - timedelta(days=1)).strftime('%Y-%m-%d %H:%M:%S'),
            (now - timedelta(days=1)).strftime('%Y-%m-%d %H:%M:%S')
        ),
        (
            user_id,
            'Literature Review on Vision Transformers',
            'Read the original ViT paper and summarize key differences compared to ConvNets.',
            5, 'Reading', 'Medium', 'todo', next_week_str, 3.0, 0.5,
            now.strftime('%Y-%m-%d %H:%M:%S'), now.strftime('%Y-%m-%d %H:%M:%S'), None
        )
    ]

    cursor.executemany('''
        INSERT INTO tasks (user_id, title, description, course_id, category, priority, status, due_date, estimated_hours, spent_hours, created_at, updated_at, completed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    ''', tasks)

    # Seed Subtasks
    subtasks = [
        (1, 'Define Node struct with color enum and parent pointer', 1),
        (1, 'Implement left_rotate and right_rotate helpers', 1),
        (1, 'Implement insert_fixup cases 1, 2, 3', 1),
        (1, 'Write unit tests for 1000 random insertions', 0),
        (2, 'Review lecture slides 12-15 on SVD', 1),
        (2, 'Complete 2024 Midterm Practice Exam', 0),
        (2, 'Formula cheat sheet review', 0),
        (3, 'Set up PyTorch DataLoader and augmentation pipeline', 1),
        (3, 'Train baseline 18-layer model for 25 epochs', 1),
        (3, 'Evaluate confusion matrix and error analysis', 0),
        (3, 'Export final test metrics to LaTeX table', 0)
    ]
    cursor.executemany('''
        INSERT INTO subtasks (task_id, title, is_completed)
        VALUES (?, ?, ?);
    ''', subtasks)

    # Seed Study Sessions
    today_date = now.strftime('%Y-%m-%d')
    yesterday_date = (now - timedelta(days=1)).strftime('%Y-%m-%d')
    sessions = [
        (user_id, 1, 1, 'Red-Black Tree Rotations', today_date, '14:00', '14:45', 45, (now - timedelta(hours=3)).strftime('%Y-%m-%d %H:%M:%S'), 'Implemented tree rotations and fixups'),
        (user_id, 5, 3, 'ResNet CNN Architecture', yesterday_date, '16:00', '16:50', 50, (now - timedelta(days=1, hours=2)).strftime('%Y-%m-%d %H:%M:%S'), 'Trained epoch 1-15 on GPU'),
        (user_id, 2, 2, 'Eigenvalues Practice Problems', today_date, '10:00', '10:25', 25, (now - timedelta(hours=1)).strftime('%Y-%m-%d %H:%M:%S'), 'Solved 4 eigenvalue matrix problems')
    ]
    cursor.executemany('''
        INSERT INTO study_sessions (user_id, course_id, task_id, topic, session_date, start_time, end_time, duration_minutes, created_at, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    ''', sessions)

    conn.commit()

def verify_db():
    """Prints verification statistics and checks foreign key integrity."""
    conn = get_db()
    cursor = conn.cursor()
    print("\n--- ScholarFlow Database Status & Verification ---")
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name ASC;")
    tables = [row[0] for row in cursor.fetchall() if row[0] != 'sqlite_sequence']
    print(f"Tables present ({len(tables)}): {', '.join(tables)}")

    for t in tables:
        cursor.execute(f"SELECT COUNT(*) FROM {t};")
        count = cursor.fetchone()[0]
        cursor.execute(f"PRAGMA table_info({t});")
        cols = [c[1] for c in cursor.fetchall()]
        print(f"  * Table '{t}': {count} rows | Columns: {', '.join(cols)}")

    # Check foreign keys
    cursor.execute("PRAGMA foreign_key_check;")
    fk_errors = cursor.fetchall()
    if fk_errors:
        print("  [FAIL] Foreign key violations found:", fk_errors)
    else:
        print("  [OK] Foreign key integrity: 100% OK (No broken references)")
    
    # Display the sample/preserved user
    cursor.execute("SELECT id, name, email, created_at FROM users;")
    users = cursor.fetchall()
    print(f"\nStudents in system: {len(users)}")
    for u in users:
        print(f"  * Student #{u['id']}: {u['name']} <{u['email']}>")

    conn.close()

if __name__ == '__main__':
    init_db()
    verify_db()
    print("\nDatabase initialization and migration completed successfully!")
