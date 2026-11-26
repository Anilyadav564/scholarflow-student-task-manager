from flask import Flask, render_template, request, jsonify, session
from datetime import datetime, timedelta
from functools import wraps
import sqlite3
import os
import re
from werkzeug.security import generate_password_hash, check_password_hash
from database import get_db, init_db

# Load optional .env configuration
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

app = Flask(__name__)

# Secure configurable secret key
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'scholarflow-secure-dev-session-key-2026')
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'

# Ensure database exists and schema is up to date
init_db()

# ----------------- Auth Helper / Decorator -----------------

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'success': False, 'message': 'Authentication required. Please log in.'}), 401
        return f(*args, **kwargs)
    return decorated_function


# ----------------- Page Route -----------------

@app.route('/')
def index():
    return render_template('index.html')


# ----------------- Authentication API -----------------

@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.get_json() or {}
    name = data.get('name', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    confirm_password = data.get('confirm_password', '')

    # 1. Validation checks
    if not name:
        return jsonify({'success': False, 'message': 'Student name is required.'}), 400
    if not email:
        return jsonify({'success': False, 'message': 'Email address is required.'}), 400
    if not password:
        return jsonify({'success': False, 'message': 'Password is required.'}), 400

    # Email format validation
    email_regex = r'^[^@\s]+@[^@\s]+\.[^@\s]+$'
    if not re.match(email_regex, email):
        return jsonify({'success': False, 'message': 'Please provide a valid email address.'}), 400

    # Password length check
    if len(password) < 6:
        return jsonify({'success': False, 'message': 'Password must be at least 6 characters long.'}), 400

    # Confirm password match
    if password != confirm_password:
        return jsonify({'success': False, 'message': 'Passwords do not match.'}), 400

    conn = get_db()
    cursor = conn.cursor()

    # 2. Reject duplicate email addresses
    cursor.execute('SELECT id FROM users WHERE LOWER(email) = ?;', (email,))
    if cursor.fetchone():
        conn.close()
        return jsonify({'success': False, 'message': 'Email address is already registered. Please log in.'}), 409

    # 3. Hash password and insert student record
    pw_hash = generate_password_hash(password)
    now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    cursor.execute('''
        INSERT INTO users (name, email, password_hash, created_at)
        VALUES (?, ?, ?, ?);
    ''', (name, email, pw_hash, now_str))
    user_id = cursor.lastrowid
    conn.commit()
    conn.close()

    # 4. Set session for automatic login
    session.clear()
    session['user_id'] = user_id

    return jsonify({
        'success': True,
        'message': 'Registration successful! Welcome to ScholarFlow.',
        'user': {
            'id': user_id,
            'name': name,
            'email': email
        }
    }), 201


@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not email or not password:
        return jsonify({'success': False, 'message': 'Email and password are required.'}), 400

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM users WHERE LOWER(email) = ?;', (email,))
    user = cursor.fetchone()
    conn.close()

    if not user or not check_password_hash(user['password_hash'], password):
        return jsonify({'success': False, 'message': 'Invalid email or password.'}), 401

    session.clear()
    session['user_id'] = user['id']

    return jsonify({
        'success': True,
        'message': 'Login successful.',
        'user': {
            'id': user['id'],
            'name': user['name'],
            'email': user['email']
        }
    })


@app.route('/api/auth/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'success': True, 'message': 'Logged out successfully.'})


@app.route('/api/auth/me', methods=['GET'])
def get_current_user():
    if 'user_id' not in session:
        return jsonify({'success': True, 'authenticated': False, 'user': None}), 200

    user_id = session['user_id']
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT id, name, email, created_at FROM users WHERE id = ?;', (user_id,))
    user = cursor.fetchone()
    conn.close()

    if not user:
        session.clear()
        return jsonify({'success': True, 'authenticated': False, 'user': None}), 200

    return jsonify({
        'success': True,
        'authenticated': True,
        'user': {
            'id': user['id'],
            'name': user['name'],
            'email': user['email'],
            'created_at': user['created_at']
        }
    })


# ----------------- Tasks API (Per-Student Protected) -----------------

@app.route('/api/tasks', methods=['GET'])
@login_required
def get_tasks():
    user_id = session['user_id']
    status = request.args.get('status')
    overdue_param = request.args.get('overdue')
    course_id = request.args.get('course_id')
    priority = request.args.get('priority')
    search = request.args.get('search')
    sort_by = request.args.get('sort_by', 'due_date') # due_date, priority, title, created_at

    query = '''
        SELECT t.*, 
               c.name as course_name, c.code as course_code, c.color as course_color
        FROM tasks t
        LEFT JOIN courses c ON t.course_id = c.id
        WHERE t.user_id = ?
    '''
    params = [user_id]
    now_iso = datetime.now().strftime('%Y-%m-%dT%H:%M')

    # Status & Overdue filtering
    if status == 'overdue' or overdue_param in ['true', '1', 'True']:
        query += " AND t.status != 'completed' AND t.due_date < ?"
        params.append(now_iso)
    elif status and status != 'all':
        query += ' AND t.status = ?'
        params.append(status)

    if course_id and course_id != 'all':
        query += ' AND t.course_id = ?'
        params.append(course_id)

    if priority and priority != 'all':
        query += ' AND t.priority = ?'
        params.append(priority)

    if search:
        query += ' AND (t.title LIKE ? OR t.description LIKE ?)'
        wildcard = f'%{search.strip()}%'
        params.extend([wildcard, wildcard])

    if sort_by == 'priority':
        query += ''' ORDER BY 
            CASE t.priority 
                WHEN 'Urgent' THEN 1 
                WHEN 'High' THEN 2 
                WHEN 'Medium' THEN 3 
                WHEN 'Low' THEN 4 
                ELSE 5 
            END, t.due_date ASC'''
    elif sort_by == 'title':
        query += ' ORDER BY t.title COLLATE NOCASE ASC'
    elif sort_by == 'created_at':
        query += ' ORDER BY t.created_at DESC'
    else:
        query += ' ORDER BY t.due_date ASC'

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(query, params)
    rows = cursor.fetchall()

    tasks = []
    now = datetime.now()

    for row in rows:
        task_id = row['id']
        # Fetch subtasks for this task
        cursor.execute('SELECT * FROM subtasks WHERE task_id = ? ORDER BY id ASC', (task_id,))
        subtask_rows = cursor.fetchall()
        subtasks = [dict(s) for s in subtask_rows]
        total_subtasks = len(subtasks)
        completed_subtasks = sum(1 for s in subtasks if s['is_completed'])

        # Calculate overdue
        is_overdue = False
        if row['status'] != 'completed' and row['due_date']:
            try:
                due_val = row['due_date']
                if len(due_val) == 10:
                    due_dt = datetime.fromisoformat(due_val + 'T23:59:59')
                else:
                    due_dt = datetime.fromisoformat(due_val)
                is_overdue = due_dt < now
            except ValueError:
                pass

        task_dict = dict(row)
        task_dict['subtasks'] = subtasks
        task_dict['subtasks_total'] = total_subtasks
        task_dict['subtasks_completed'] = completed_subtasks
        task_dict['is_overdue'] = is_overdue
        tasks.append(task_dict)

    conn.close()
    return jsonify({'success': True, 'tasks': tasks})


@app.route('/api/tasks/<int:task_id>', methods=['GET'])
@login_required
def get_task(task_id):
    user_id = session['user_id']
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT t.*, c.name as course_name, c.code as course_code, c.color as course_color
        FROM tasks t
        LEFT JOIN courses c ON t.course_id = c.id
        WHERE t.id = ? AND t.user_id = ?
    ''', (task_id, user_id))
    row = cursor.fetchone()

    if not row:
        conn.close()
        return jsonify({'success': False, 'message': 'Task not found'}), 404

    cursor.execute('SELECT * FROM subtasks WHERE task_id = ? ORDER BY id ASC', (task_id,))
    subtasks = [dict(s) for s in cursor.fetchall()]

    cursor.execute('SELECT * FROM study_sessions WHERE task_id = ? AND user_id = ? ORDER BY created_at DESC', (task_id, user_id))
    sessions = [dict(s) for s in cursor.fetchall()]

    conn.close()

    task_data = dict(row)
    # Calculate overdue flag
    is_overdue = False
    if task_data.get('status') != 'completed' and task_data.get('due_date'):
        try:
            due_val = task_data['due_date']
            if len(due_val) == 10:
                due_dt = datetime.fromisoformat(due_val + 'T23:59:59')
            else:
                due_dt = datetime.fromisoformat(due_val)
            is_overdue = due_dt < datetime.now()
        except ValueError:
            pass

    task_data['is_overdue'] = is_overdue
    task_data['subtasks'] = subtasks
    task_data['study_sessions'] = sessions
    return jsonify({'success': True, 'task': task_data})


@app.route('/api/tasks', methods=['POST'])
@login_required
def create_task():
    user_id = session['user_id']
    data = request.get_json() or {}

    # 1. Validate task title
    title = data.get('title', '').strip()
    if not title:
        return jsonify({'success': False, 'message': 'Task title is required.'}), 400
    if len(title) > 200:
        return jsonify({'success': False, 'message': 'Task title cannot exceed 200 characters.'}), 400

    # 2. Validate due date
    if 'due_date' in data and data['due_date'] is not None:
        due_date = str(data['due_date']).strip()
        if not due_date:
            return jsonify({'success': False, 'message': 'Due date cannot be empty.'}), 400
        try:
            if len(due_date) == 10:
                datetime.fromisoformat(due_date + 'T00:00:00')
            else:
                datetime.fromisoformat(due_date)
        except ValueError:
            return jsonify({'success': False, 'message': 'Invalid due date format. Please provide a valid date/time.'}), 400
    else:
        due_date = (datetime.now() + timedelta(days=2)).strftime('%Y-%m-%dT23:59')

    # 3. Validate priority
    priority = data.get('priority', 'Medium')
    allowed_priorities = ['Low', 'Medium', 'High', 'Urgent']
    if priority not in allowed_priorities:
        return jsonify({'success': False, 'message': f'Invalid priority. Must be one of: {", ".join(allowed_priorities)}'}), 400

    # 4. Validate status
    status = data.get('status', 'todo')
    allowed_statuses = ['todo', 'in_progress', 'completed']
    if status not in allowed_statuses:
        return jsonify({'success': False, 'message': f'Invalid status. Must be one of: {", ".join(allowed_statuses)}'}), 400

    # 5. Validate estimated hours
    try:
        estimated_hours = float(data.get('estimated_hours') if data.get('estimated_hours') is not None else 1.0)
        if estimated_hours < 0:
            return jsonify({'success': False, 'message': 'Estimated hours cannot be negative.'}), 400
    except (ValueError, TypeError):
        return jsonify({'success': False, 'message': 'Estimated hours must be a valid number.'}), 400

    description = data.get('description', '').strip()
    category = data.get('category', 'Assignment')
    course_id = data.get('course_id') or None
    subtasks_list = data.get('subtasks', [])

    now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    completed_at = now_str if status == 'completed' else None

    conn = get_db()
    cursor = conn.cursor()

    # 6. Verify course ownership if course_id is provided
    if course_id:
        cursor.execute('SELECT id FROM courses WHERE id = ? AND user_id = ?', (course_id, user_id))
        if not cursor.fetchone():
            conn.close()
            return jsonify({'success': False, 'message': 'Selected course was not found or does not belong to you.'}), 400

    cursor.execute('''
        INSERT INTO tasks (user_id, title, description, course_id, category, priority, status, due_date, estimated_hours, spent_hours, created_at, updated_at, completed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0.0, ?, ?, ?)
    ''', (user_id, title, description, course_id, category, priority, status, due_date, estimated_hours, now_str, now_str, completed_at))
    
    task_id = cursor.lastrowid

    if subtasks_list and isinstance(subtasks_list, list):
        for st in subtasks_list:
            if isinstance(st, str) and st.strip():
                cursor.execute('INSERT INTO subtasks (task_id, title, is_completed) VALUES (?, ?, 0)', (task_id, st.strip()))
            elif isinstance(st, dict) and st.get('title', '').strip():
                cursor.execute('INSERT INTO subtasks (task_id, title, is_completed) VALUES (?, ?, ?)',
                               (task_id, st['title'].strip(), 1 if st.get('is_completed') else 0))

    conn.commit()
    conn.close()

    return jsonify({'success': True, 'message': 'Task created successfully', 'task_id': task_id}), 201


@app.route('/api/tasks/<int:task_id>', methods=['PUT'])
@login_required
def update_task(task_id):
    user_id = session['user_id']
    data = request.get_json() or {}

    # 1. Validate title
    title = data.get('title', '').strip()
    if not title:
        return jsonify({'success': False, 'message': 'Task title is required.'}), 400
    if len(title) > 200:
        return jsonify({'success': False, 'message': 'Task title cannot exceed 200 characters.'}), 400

    # 2. Validate due date if provided
    due_date = data.get('due_date')
    if due_date is not None:
        due_date = str(due_date).strip()
        if due_date:
            try:
                if len(due_date) == 10:
                    datetime.fromisoformat(due_date + 'T00:00:00')
                else:
                    datetime.fromisoformat(due_date)
            except ValueError:
                return jsonify({'success': False, 'message': 'Invalid due date format.'}), 400
        else:
            return jsonify({'success': False, 'message': 'Due date cannot be empty.'}), 400

    # 3. Validate priority
    priority = data.get('priority', 'Medium')
    allowed_priorities = ['Low', 'Medium', 'High', 'Urgent']
    if priority not in allowed_priorities:
        return jsonify({'success': False, 'message': f'Invalid priority. Must be one of: {", ".join(allowed_priorities)}'}), 400

    # 4. Validate status
    status = data.get('status', 'todo')
    allowed_statuses = ['todo', 'in_progress', 'completed']
    if status not in allowed_statuses:
        return jsonify({'success': False, 'message': f'Invalid status. Must be one of: {", ".join(allowed_statuses)}'}), 400

    # 5. Validate estimated hours
    try:
        estimated_hours = float(data.get('estimated_hours') if data.get('estimated_hours') is not None else 1.0)
        if estimated_hours < 0:
            return jsonify({'success': False, 'message': 'Estimated hours cannot be negative.'}), 400
    except (ValueError, TypeError):
        return jsonify({'success': False, 'message': 'Estimated hours must be a valid number.'}), 400

    try:
        spent_hours = float(data.get('spent_hours') if data.get('spent_hours') is not None else 0.0)
        if spent_hours < 0:
            spent_hours = 0.0
    except (ValueError, TypeError):
        spent_hours = 0.0

    description = data.get('description', '').strip()
    course_id = data.get('course_id') or None
    category = data.get('category', 'Assignment')

    now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    completed_at = now_str if status == 'completed' else None

    conn = get_db()
    cursor = conn.cursor()

    # 6. Verify course ownership if course_id is supplied
    if course_id:
        cursor.execute('SELECT id FROM courses WHERE id = ? AND user_id = ?', (course_id, user_id))
        if not cursor.fetchone():
            conn.close()
            return jsonify({'success': False, 'message': 'Selected course was not found or does not belong to you.'}), 400

    cursor.execute('''
        UPDATE tasks
        SET title = ?, description = ?, course_id = ?, category = ?, priority = ?,
            status = ?, due_date = COALESCE(?, due_date), estimated_hours = ?, spent_hours = ?,
            updated_at = ?,
            completed_at = CASE 
                WHEN ? = 'completed' AND completed_at IS NULL THEN ? 
                WHEN ? != 'completed' THEN NULL 
                ELSE completed_at 
            END
        WHERE id = ? AND user_id = ?
    ''', (title, description, course_id, category, priority, status, due_date, estimated_hours, spent_hours, now_str, status, completed_at, status, task_id, user_id))

    if cursor.rowcount == 0:
        conn.close()
        return jsonify({'success': False, 'message': 'Task not found'}), 404

    # Update subtasks if provided
    if 'subtasks' in data and isinstance(data['subtasks'], list):
        cursor.execute('DELETE FROM subtasks WHERE task_id = ?', (task_id,))
        for st in data['subtasks']:
            st_title = st.get('title', '').strip() if isinstance(st, dict) else str(st).strip()
            is_comp = 1 if (isinstance(st, dict) and st.get('is_completed')) else 0
            if st_title:
                cursor.execute('INSERT INTO subtasks (task_id, title, is_completed) VALUES (?, ?, ?)',
                               (task_id, st_title, is_comp))

    conn.commit()
    conn.close()

    return jsonify({'success': True, 'message': 'Task updated successfully'})


@app.route('/api/tasks/<int:task_id>/status', methods=['PATCH'])
@login_required
def update_task_status(task_id):
    user_id = session['user_id']
    data = request.get_json() or {}
    new_status = data.get('status')
    if new_status not in ['todo', 'in_progress', 'completed']:
        return jsonify({'success': False, 'message': 'Invalid status. Must be todo, in_progress, or completed.'}), 400

    conn = get_db()
    cursor = conn.cursor()

    now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    completed_at = now_str if new_status == 'completed' else None

    cursor.execute('''
        UPDATE tasks 
        SET status = ?, 
            completed_at = ?,
            updated_at = ?
        WHERE id = ? AND user_id = ?
    ''', (new_status, completed_at, now_str, task_id, user_id))

    if cursor.rowcount == 0:
        conn.close()
        return jsonify({'success': False, 'message': 'Task not found'}), 404

    conn.commit()
    conn.close()

    return jsonify({'success': True, 'status': new_status})


@app.route('/api/tasks/<int:task_id>', methods=['DELETE'])
@login_required
def delete_task(task_id):
    user_id = session['user_id']
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM tasks WHERE id = ? AND user_id = ?', (task_id, user_id))
    if cursor.rowcount == 0:
        conn.close()
        return jsonify({'success': False, 'message': 'Task not found'}), 404

    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': 'Task deleted successfully'})


# ----------------- Subtasks API (Protected through Parent Task) -----------------

@app.route('/api/tasks/<int:task_id>/subtasks', methods=['POST'])
@login_required
def add_subtask(task_id):
    user_id = session['user_id']
    data = request.get_json() or {}
    title = data.get('title', '').strip()
    if not title:
        return jsonify({'success': False, 'message': 'Title required'}), 400

    conn = get_db()
    cursor = conn.cursor()

    # Verify parent task belongs to logged-in student
    cursor.execute('SELECT id FROM tasks WHERE id = ? AND user_id = ?', (task_id, user_id))
    if not cursor.fetchone():
        conn.close()
        return jsonify({'success': False, 'message': 'Task not found'}), 404

    cursor.execute('INSERT INTO subtasks (task_id, title, is_completed) VALUES (?, ?, 0)', (task_id, title))
    subtask_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return jsonify({'success': True, 'id': subtask_id, 'title': title, 'is_completed': 0})


@app.route('/api/subtasks/<int:subtask_id>/toggle', methods=['PATCH'])
@login_required
def toggle_subtask(subtask_id):
    user_id = session['user_id']
    conn = get_db()
    cursor = conn.cursor()

    # Verify ownership through parent task
    cursor.execute('''
        SELECT s.is_completed 
        FROM subtasks s
        JOIN tasks t ON s.task_id = t.id
        WHERE s.id = ? AND t.user_id = ?
    ''', (subtask_id, user_id))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return jsonify({'success': False, 'message': 'Subtask not found'}), 404

    new_val = 0 if row['is_completed'] == 1 else 1
    cursor.execute('UPDATE subtasks SET is_completed = ? WHERE id = ?', (new_val, subtask_id))
    conn.commit()
    conn.close()

    return jsonify({'success': True, 'is_completed': new_val})


@app.route('/api/subtasks/<int:subtask_id>', methods=['DELETE'])
@login_required
def delete_subtask(subtask_id):
    user_id = session['user_id']
    conn = get_db()
    cursor = conn.cursor()

    # Verify ownership through parent task
    cursor.execute('''
        SELECT s.id 
        FROM subtasks s
        JOIN tasks t ON s.task_id = t.id
        WHERE s.id = ? AND t.user_id = ?
    ''', (subtask_id, user_id))
    if not cursor.fetchone():
        conn.close()
        return jsonify({'success': False, 'message': 'Subtask not found'}), 404

    cursor.execute('DELETE FROM subtasks WHERE id = ?', (subtask_id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})


# ----------------- Courses API (Per-Student Protected) -----------------

@app.route('/api/courses', methods=['GET'])
@login_required
def get_courses():
    user_id = session['user_id']
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT c.*, 
               COUNT(t.id) as task_count,
               SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as completed_count
        FROM courses c
        LEFT JOIN tasks t ON (t.course_id = c.id AND t.user_id = ?)
        WHERE c.user_id = ?
        GROUP BY c.id
        ORDER BY c.code ASC
    ''', (user_id, user_id))
    courses = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify({'success': True, 'courses': courses})


@app.route('/api/courses', methods=['POST'])
@login_required
def create_course():
    user_id = session['user_id']
    data = request.get_json() or {}
    code = data.get('code', '').strip().upper()
    name = data.get('name', '').strip()
    color = data.get('color', '#6366f1').strip()
    instructor = data.get('instructor', '').strip()

    if not code or not name:
        return jsonify({'success': False, 'message': 'Course code and name are required'}), 400

    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            INSERT INTO courses (user_id, code, name, color, instructor)
            VALUES (?, ?, ?, ?, ?)
        ''', (user_id, code, name, color, instructor))
        course_id = cursor.lastrowid
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({'success': False, 'message': 'You already have a course with this code'}), 409

    conn.close()
    return jsonify({
        'success': True, 
        'course_id': course_id,
        'course': {
            'id': course_id,
            'code': code,
            'name': name,
            'color': color,
            'instructor': instructor
        }
    }), 201


@app.route('/api/courses/<int:course_id>', methods=['PUT'])
@login_required
def update_course(course_id):
    user_id = session['user_id']
    data = request.get_json() or {}
    code = data.get('code', '').strip().upper()
    name = data.get('name', '').strip()
    color = data.get('color', '#6366f1').strip()
    instructor = data.get('instructor', '').strip()

    if not code or not name:
        return jsonify({'success': False, 'message': 'Course code and name are required'}), 400

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT id FROM courses WHERE id = ? AND user_id = ?', (course_id, user_id))
    if not cursor.fetchone():
        conn.close()
        return jsonify({'success': False, 'message': 'Course not found'}), 404

    try:
        cursor.execute('''
            UPDATE courses
            SET code = ?, name = ?, color = ?, instructor = ?
            WHERE id = ? AND user_id = ?
        ''', (code, name, color, instructor, course_id, user_id))
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({'success': False, 'message': 'You already have another course with this code'}), 409

    conn.close()
    return jsonify({
        'success': True,
        'course': {
            'id': course_id,
            'code': code,
            'name': name,
            'color': color,
            'instructor': instructor
        }
    })


@app.route('/api/courses/<int:course_id>', methods=['DELETE'])
@login_required
def delete_course(course_id):
    user_id = session['user_id']
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT id FROM courses WHERE id = ? AND user_id = ?', (course_id, user_id))
    if not cursor.fetchone():
        conn.close()
        return jsonify({'success': False, 'message': 'Course not found'}), 404

    # Detach tasks from this course (keep them as General / unassigned)
    cursor.execute('UPDATE tasks SET course_id = NULL WHERE course_id = ? AND user_id = ?', (course_id, user_id))
    # Detach study sessions from this course
    cursor.execute('UPDATE study_sessions SET course_id = NULL WHERE course_id = ? AND user_id = ?', (course_id, user_id))
    # Delete the course
    cursor.execute('DELETE FROM courses WHERE id = ? AND user_id = ?', (course_id, user_id))
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': 'Course deleted successfully'})


# ----------------- Study Sessions / Pomodoro API (Per-Student Protected) -----------------

def calculate_study_streak(cursor, user_id):
    """
    Calculates consecutive active days of completed study sessions.
    Returns 0 if no study activity today or yesterday.
    """
    cursor.execute('''
        SELECT DISTINCT COALESCE(session_date, substr(created_at, 1, 10)) as study_day
        FROM study_sessions
        WHERE user_id = ? AND duration_minutes > 0
        ORDER BY study_day DESC
    ''', (user_id,))
    rows = cursor.fetchall()
    if not rows:
        return 0

    study_days = set(r[0] for r in rows if r[0])
    today = datetime.now().date()
    yesterday = today - timedelta(days=1)

    # Streak starts from today if studied today, else from yesterday if active yesterday
    if today.isoformat() in study_days:
        current_day = today
    elif yesterday.isoformat() in study_days:
        current_day = yesterday
    else:
        return 0

    streak = 0
    while current_day.isoformat() in study_days:
        streak += 1
        current_day = current_day - timedelta(days=1)

    return streak


@app.route('/api/study-sessions', methods=['GET'])
@login_required
def get_study_sessions():
    user_id = session['user_id']
    date_filter = request.args.get('date')
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    course_id = request.args.get('course_id')

    query = '''
        SELECT s.*, 
               COALESCE(c.name, tc.name) as course_name, 
               COALESCE(c.code, tc.code) as course_code, 
               COALESCE(c.color, tc.color) as course_color,
               t.title as task_title
        FROM study_sessions s
        LEFT JOIN courses c ON s.course_id = c.id
        LEFT JOIN tasks t ON s.task_id = t.id
        LEFT JOIN courses tc ON t.course_id = tc.id
        WHERE s.user_id = ?
    '''
    params = [user_id]

    if date_filter:
        query += " AND COALESCE(s.session_date, substr(s.created_at, 1, 10)) = ?"
        params.append(date_filter)

    if start_date:
        query += " AND COALESCE(s.session_date, substr(s.created_at, 1, 10)) >= ?"
        params.append(start_date)

    if end_date:
        query += " AND COALESCE(s.session_date, substr(s.created_at, 1, 10)) <= ?"
        params.append(end_date)

    if course_id and course_id != 'all':
        query += " AND (s.course_id = ? OR t.course_id = ?)"
        params.extend([course_id, course_id])

    query += ' ORDER BY COALESCE(s.session_date, substr(s.created_at, 1, 10)) DESC, s.start_time DESC, s.created_at DESC LIMIT 100'

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(query, params)
    sessions = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify({'success': True, 'sessions': sessions})


@app.route('/api/study-sessions/<int:session_id>', methods=['GET'])
@login_required
def get_study_session(session_id):
    user_id = session['user_id']
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT s.*, 
               COALESCE(c.name, tc.name) as course_name, 
               COALESCE(c.code, tc.code) as course_code, 
               COALESCE(c.color, tc.color) as course_color,
               t.title as task_title
        FROM study_sessions s
        LEFT JOIN courses c ON s.course_id = c.id
        LEFT JOIN tasks t ON s.task_id = t.id
        LEFT JOIN courses tc ON t.course_id = tc.id
        WHERE s.id = ? AND s.user_id = ?
    ''', (session_id, user_id))
    row = cursor.fetchone()
    conn.close()
    if not row:
        return jsonify({'success': False, 'message': 'Study session not found'}), 404
    return jsonify({'success': True, 'session': dict(row)})


@app.route('/api/study-sessions', methods=['POST'])
@login_required
def create_study_session():
    user_id = session['user_id']
    data = request.get_json() or {}

    topic = data.get('topic', '').strip()
    task_id = data.get('task_id')
    course_id = data.get('course_id')

    if 'topic' in data and not topic and not task_id:
        return jsonify({'success': False, 'message': 'Topic is required.'}), 400

    conn = get_db()
    cursor = conn.cursor()

    if not topic and task_id:
        cursor.execute('SELECT title FROM tasks WHERE id = ? AND user_id = ?', (task_id, user_id))
        t_row = cursor.fetchone()
        if t_row:
            topic = t_row[0]

    if not topic:
        topic = 'Focus Study Session'

    session_date = data.get('session_date')
    if not session_date:
        session_date = datetime.now().strftime('%Y-%m-%d')
    else:
        session_date = str(session_date).strip()
        try:
            datetime.fromisoformat(session_date[:10])
            session_date = session_date[:10]
        except ValueError:
            conn.close()
            return jsonify({'success': False, 'message': 'Invalid session date format. Use YYYY-MM-DD.'}), 400

    start_time = data.get('start_time', '09:00').strip()
    end_time = data.get('end_time', '10:00').strip()
    notes = data.get('notes', '').strip()

    duration = data.get('duration_minutes')
    if duration is not None:
        try:
            duration = int(duration)
            if duration <= 0:
                conn.close()
                return jsonify({'success': False, 'message': 'Duration must be greater than 0 minutes.'}), 400
        except (ValueError, TypeError):
            conn.close()
            return jsonify({'success': False, 'message': 'Duration must be an integer.'}), 400
    else:
        try:
            t1 = datetime.strptime(start_time, '%H:%M')
            t2 = datetime.strptime(end_time, '%H:%M')
            diff = int((t2 - t1).total_seconds() / 60)
            duration = diff if diff > 0 else 60
        except ValueError:
            duration = 60

    # Verify course ownership if provided
    if course_id:
        cursor.execute('SELECT id FROM courses WHERE id = ? AND user_id = ?', (course_id, user_id))
        if not cursor.fetchone():
            conn.close()
            return jsonify({'success': False, 'message': 'Selected course was not found or does not belong to you.'}), 400

    # Verify task ownership if provided
    if task_id:
        cursor.execute('SELECT id, course_id FROM tasks WHERE id = ? AND user_id = ?', (task_id, user_id))
        t_row = cursor.fetchone()
        if not t_row:
            conn.close()
            return jsonify({'success': False, 'message': 'Selected task was not found or does not belong to you.'}), 400
        elif not course_id and t_row['course_id']:
            course_id = t_row['course_id']

    now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    cursor.execute('''
        INSERT INTO study_sessions (user_id, course_id, task_id, topic, session_date, start_time, end_time, duration_minutes, created_at, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (user_id, course_id, task_id, topic, session_date, start_time, end_time, duration, now_str, notes))
    session_id = cursor.lastrowid

    if task_id:
        hours_to_add = round(duration / 60.0, 2)
        cursor.execute('''
            UPDATE tasks 
            SET spent_hours = ROUND(spent_hours + ?, 2)
            WHERE id = ? AND user_id = ?
        ''', (hours_to_add, task_id, user_id))

    conn.commit()
    conn.close()

    return jsonify({
        'success': True, 
        'message': 'Study session planned successfully', 
        'session_id': session_id,
        'session': {
            'id': session_id,
            'topic': topic,
            'course_id': course_id,
            'task_id': task_id,
            'session_date': session_date,
            'start_time': start_time,
            'end_time': end_time,
            'duration_minutes': duration,
            'notes': notes
        }
    })


@app.route('/api/study-sessions/<int:session_id>', methods=['PUT'])
@login_required
def update_study_session(session_id):
    user_id = session['user_id']
    data = request.get_json() or {}

    conn = get_db()
    cursor = conn.cursor()

    # Verify session ownership first
    cursor.execute('SELECT * FROM study_sessions WHERE id = ? AND user_id = ?', (session_id, user_id))
    existing = cursor.fetchone()
    if not existing:
        conn.close()
        return jsonify({'success': False, 'message': 'Study session not found'}), 404

    existing_dict = dict(existing)

    # 1. Topic
    if 'topic' in data:
        topic = data.get('topic', '').strip()
        if not topic:
            conn.close()
            return jsonify({'success': False, 'message': 'Session topic cannot be empty.'}), 400
    else:
        topic = existing_dict.get('topic') or 'Focus Study Session'

    # 2. Session date
    if 'session_date' in data:
        session_date = data.get('session_date')
        if not session_date:
            conn.close()
            return jsonify({'success': False, 'message': 'Session date cannot be empty.'}), 400
        try:
            datetime.fromisoformat(str(session_date)[:10])
            session_date = str(session_date)[:10]
        except ValueError:
            conn.close()
            return jsonify({'success': False, 'message': 'Invalid session date format.'}), 400
    else:
        session_date = existing_dict.get('session_date') or datetime.now().strftime('%Y-%m-%d')

    start_time = data.get('start_time', existing_dict.get('start_time') or '09:00').strip()
    end_time = data.get('end_time', existing_dict.get('end_time') or '10:00').strip()
    course_id = data.get('course_id') if 'course_id' in data else existing_dict.get('course_id')
    task_id = data.get('task_id') if 'task_id' in data else existing_dict.get('task_id')
    notes = data.get('notes', existing_dict.get('notes') or '').strip()

    # 3. Duration
    if 'duration_minutes' in data:
        try:
            duration = int(data['duration_minutes'])
            if duration <= 0:
                conn.close()
                return jsonify({'success': False, 'message': 'Duration must be greater than 0.'}), 400
        except (ValueError, TypeError):
            conn.close()
            return jsonify({'success': False, 'message': 'Duration must be an integer.'}), 400
    else:
        duration = existing_dict.get('duration_minutes') or 60

    # Verify course ownership
    if course_id:
        cursor.execute('SELECT id FROM courses WHERE id = ? AND user_id = ?', (course_id, user_id))
        if not cursor.fetchone():
            conn.close()
            return jsonify({'success': False, 'message': 'Selected course was not found or does not belong to you.'}), 400

    # Verify task ownership
    if task_id:
        cursor.execute('SELECT id FROM tasks WHERE id = ? AND user_id = ?', (task_id, user_id))
        if not cursor.fetchone():
            task_id = None

    cursor.execute('''
        UPDATE study_sessions
        SET topic = ?, session_date = ?, start_time = ?, end_time = ?, duration_minutes = ?, course_id = ?, task_id = ?, notes = ?
        WHERE id = ? AND user_id = ?
    ''', (topic, session_date, start_time, end_time, duration, course_id, task_id, notes, session_id, user_id))

    conn.commit()
    conn.close()
    return jsonify({
        'success': True, 
        'message': 'Study session updated successfully',
        'session': {
            'id': session_id,
            'topic': topic,
            'session_date': session_date,
            'start_time': start_time,
            'end_time': end_time,
            'duration_minutes': duration,
            'notes': notes
        }
    })


@app.route('/api/study-sessions/<int:session_id>', methods=['DELETE'])
@login_required
def delete_study_session(session_id):
    user_id = session['user_id']
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM study_sessions WHERE id = ? AND user_id = ?', (session_id, user_id))
    if cursor.rowcount == 0:
        conn.close()
        return jsonify({'success': False, 'message': 'Study session not found'}), 404

    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': 'Study session deleted successfully'})


# ----------------- Analytics API (Per-Student Protected) -----------------

@app.route('/api/analytics', methods=['GET'])
@login_required
def get_analytics():
    user_id = session['user_id']
    conn = get_db()
    cursor = conn.cursor()

    # Overview counts for current student
    cursor.execute('''
        SELECT 
            COUNT(*) as total_tasks,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
            SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_tasks,
            SUM(CASE WHEN status = 'todo' THEN 1 ELSE 0 END) as todo_tasks,
            COALESCE(SUM(estimated_hours), 0.0) as total_estimated_hours,
            COALESCE(SUM(spent_hours), 0.0) as total_spent_hours
        FROM tasks
        WHERE user_id = ?
    ''', (user_id,))
    overview = dict(cursor.fetchone())

    # Today & Overdue for current student
    now_str = datetime.now().strftime('%Y-%m-%d')
    cursor.execute('''
        SELECT COUNT(*) FROM tasks 
        WHERE user_id = ? AND status != 'completed' AND substr(due_date, 1, 10) = ?
    ''', (user_id, now_str))
    due_today = cursor.fetchone()[0]

    now_iso = datetime.now().strftime('%Y-%m-%dT%H:%M')
    cursor.execute('''
        SELECT COUNT(*) FROM tasks 
        WHERE user_id = ? AND status != 'completed' AND due_date < ?
    ''', (user_id, now_iso))
    overdue = cursor.fetchone()[0]

    # Course breakdown for current student
    cursor.execute('''
        SELECT c.code, c.name, c.color,
               COUNT(t.id) as task_count,
               SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as completed_count,
               COALESCE(SUM(t.spent_hours), 0.0) as hours_spent
        FROM courses c
        LEFT JOIN tasks t ON (t.course_id = c.id AND t.user_id = ?)
        WHERE c.user_id = ?
        GROUP BY c.id
    ''', (user_id, user_id))
    course_stats = [dict(row) for row in cursor.fetchall()]

    # Total courses count for current student
    cursor.execute('SELECT COUNT(*) FROM courses WHERE user_id = ?', (user_id,))
    total_courses = cursor.fetchone()[0]

    # Priority distribution for current student
    cursor.execute('''
        SELECT priority, COUNT(*) as count 
        FROM tasks 
        WHERE user_id = ? AND status != 'completed' 
        GROUP BY priority
    ''', (user_id,))
    priority_stats = {row['priority']: row['count'] for row in cursor.fetchall()}

    # Total study minutes and sessions for current student
    cursor.execute('SELECT COALESCE(SUM(duration_minutes), 0), COUNT(*) FROM study_sessions WHERE user_id = ?', (user_id,))
    study_row = cursor.fetchone()
    total_study_minutes = study_row[0]
    total_study_sessions = study_row[1]
    total_study_hours = round(total_study_minutes / 60.0, 1)

    # Dynamic Study Streak Calculation
    study_streak = calculate_study_streak(cursor, user_id)

    # Dashboard Integration Hub Queries
    upcoming_7_days = (datetime.now() + timedelta(days=7)).strftime('%Y-%m-%d')

    # Today's Tasks
    cursor.execute('''
        SELECT t.*, c.code as course_code, c.name as course_name, c.color as course_color
        FROM tasks t
        LEFT JOIN courses c ON t.course_id = c.id
        WHERE t.user_id = ? AND substr(t.due_date, 1, 10) = ?
        ORDER BY t.due_date ASC
    ''', (user_id, now_str))
    today_tasks_list = [dict(r) for r in cursor.fetchall()]

    # Upcoming Deadlines (Next 7 days, excluding today, not completed)
    cursor.execute('''
        SELECT t.*, c.code as course_code, c.name as course_name, c.color as course_color
        FROM tasks t
        LEFT JOIN courses c ON t.course_id = c.id
        WHERE t.user_id = ? AND substr(t.due_date, 1, 10) > ? AND substr(t.due_date, 1, 10) <= ? AND t.status != 'completed'
        ORDER BY t.due_date ASC
    ''', (user_id, now_str, upcoming_7_days))
    upcoming_tasks_list = [dict(r) for r in cursor.fetchall()]

    # Overdue Tasks
    cursor.execute('''
        SELECT t.*, c.code as course_code, c.name as course_name, c.color as course_color
        FROM tasks t
        LEFT JOIN courses c ON t.course_id = c.id
        WHERE t.user_id = ? AND t.status != 'completed' AND t.due_date < ?
        ORDER BY t.due_date ASC
    ''', (user_id, now_iso))
    overdue_tasks_list = [dict(r) for r in cursor.fetchall()]

    # Today's Study Sessions
    cursor.execute('''
        SELECT s.*, c.code as course_code, c.name as course_name, c.color as course_color, t.title as task_title
        FROM study_sessions s
        LEFT JOIN courses c ON s.course_id = c.id
        LEFT JOIN tasks t ON s.task_id = t.id
        WHERE s.user_id = ? AND COALESCE(s.session_date, substr(s.created_at, 1, 10)) = ?
        ORDER BY s.start_time ASC
    ''', (user_id, now_str))
    today_sessions_list = [dict(r) for r in cursor.fetchall()]

    # Upcoming Study Sessions (Next 7 days, excluding today)
    cursor.execute('''
        SELECT s.*, c.code as course_code, c.name as course_name, c.color as course_color, t.title as task_title
        FROM study_sessions s
        LEFT JOIN courses c ON s.course_id = c.id
        LEFT JOIN tasks t ON s.task_id = t.id
        WHERE s.user_id = ? AND COALESCE(s.session_date, substr(s.created_at, 1, 10)) > ? AND COALESCE(s.session_date, substr(s.created_at, 1, 10)) <= ?
        ORDER BY s.session_date ASC, s.start_time ASC
    ''', (user_id, now_str, upcoming_7_days))
    upcoming_sessions_list = [dict(r) for r in cursor.fetchall()]

    conn.close()

    total_tasks = overview['total_tasks'] or 0
    completed_tasks = overview['completed_tasks'] or 0
    in_progress_tasks = overview['in_progress_tasks'] or 0
    todo_tasks = overview['todo_tasks'] or 0
    pending_tasks = in_progress_tasks + todo_tasks

    return jsonify({
        'success': True,
        'study_streak': study_streak,
        'overview': {
            'total_tasks': total_tasks,
            'pending_tasks': pending_tasks,
            'completed_tasks': completed_tasks,
            'in_progress_tasks': in_progress_tasks,
            'todo_tasks': todo_tasks,
            'total_courses': total_courses,
            'total_study_hours': total_study_hours,
            'total_study_minutes': total_study_minutes,
            'total_study_sessions': total_study_sessions,
            'study_streak': study_streak,
            'due_today': due_today,
            'overdue': overdue,
            'total_estimated_hours': overview['total_estimated_hours'] or 0.0,
            'total_spent_hours': overview['total_spent_hours'] or 0.0,
            'completion_rate': round((completed_tasks / total_tasks * 100) if total_tasks else 0, 1)
        },
        'course_stats': course_stats,
        'priority_stats': priority_stats,
        'planner_hub': {
            'study_streak': study_streak,
            'today_tasks': today_tasks_list,
            'upcoming_deadlines': upcoming_tasks_list,
            'overdue_tasks': overdue_tasks_list,
            'today_study_sessions': today_sessions_list,
            'upcoming_study_sessions': upcoming_sessions_list
        }
    })


# ----------------- Phase 6: Notification & Reminder System -----------------

def generate_student_reminders(conn, user_id):
    """
    Scans a student's tasks and study sessions to automatically generate
    reminders and alerts:
    - Upcoming assignments/tasks due within 48 hours
    - Exam reminders within 7 days
    - Overdue task alerts (past due and not completed)
    - Study session reminders scheduled for today or within the next 24 hours
    Uses dedup_key to prevent duplicate notifications and honors dismissed notifications.
    """
    cursor = conn.cursor()
    now = datetime.now()
    now_str = now.strftime('%Y-%m-%d %H:%M:%S')

    # Get already dismissed keys for this student
    cursor.execute('SELECT dedup_key FROM notification_dismissals WHERE user_id = ?;', (user_id,))
    dismissed_keys = set(row[0] for row in cursor.fetchall())

    # 1. Check Tasks (Assignments, Exams, Projects, Overdue)
    cursor.execute('''
        SELECT t.*, c.name as course_name, c.code as course_code
        FROM tasks t
        LEFT JOIN courses c ON t.course_id = c.id
        WHERE t.user_id = ? AND LOWER(t.status) != 'completed' AND t.due_date IS NOT NULL AND t.due_date != ''
    ''', (user_id,))
    tasks = cursor.fetchall()

    for task in tasks:
        due_str = task['due_date']
        due_dt = None
        for fmt in ('%Y-%m-%dT%H:%M', '%Y-%m-%d %H:%M:%S', '%Y-%m-%d', '%Y-%m-%dT%H:%M:%S'):
            try:
                due_dt = datetime.strptime(due_str, fmt)
                break
            except ValueError:
                continue

        if not due_dt:
            continue

        # If date only, treat as end of that day for deadline comparison
        if len(due_str) == 10:
            due_dt = due_dt.replace(hour=23, minute=59, second=59)

        diff = due_dt - now
        course_display = task['course_code'] or task['course_name'] or 'General'
        category = (task['category'] or 'Assignment').strip()
        is_exam = category.lower() == 'exam' or 'exam' in task['title'].lower()

        # Overdue check: past due date
        if diff.total_seconds() < 0:
            dedup_key = f"user_{user_id}_task_overdue_{task['id']}"
            if dedup_key not in dismissed_keys:
                cursor.execute('''
                    INSERT OR IGNORE INTO notifications 
                    (user_id, title, message, type, related_type, related_id, is_read, created_at, dedup_key)
                    VALUES (?, ?, ?, 'overdue', 'task', ?, 0, ?, ?)
                ''', (
                    user_id,
                    f"Overdue: {task['title']}",
                    f"Task '{task['title']}' ({course_display}) was due on {task['due_date']} and is still incomplete.",
                    task['id'],
                    now_str,
                    dedup_key
                ))

        # Exam reminder: within 7 days
        elif is_exam and diff.total_seconds() <= 7 * 86400:
            dedup_key = f"user_{user_id}_exam_{task['id']}"
            if dedup_key not in dismissed_keys:
                days_left = max(0, int(diff.total_seconds() // 86400))
                hours_left = max(0, int((diff.total_seconds() % 86400) // 3600))
                time_text = f"in {days_left}d {hours_left}h" if days_left > 0 else f"in {hours_left} hours"
                cursor.execute('''
                    INSERT OR IGNORE INTO notifications 
                    (user_id, title, message, type, related_type, related_id, is_read, created_at, dedup_key)
                    VALUES (?, ?, ?, 'exam', 'task', ?, 0, ?, ?)
                ''', (
                    user_id,
                    f"Exam Reminder: {task['title']}",
                    f"Upcoming exam for {course_display} is scheduled {time_text} on {task['due_date']}. Start reviewing now!",
                    task['id'],
                    now_str,
                    dedup_key
                ))

        # Upcoming assignment / project deadline: within 48 hours
        elif not is_exam and diff.total_seconds() <= 48 * 3600:
            dedup_key = f"user_{user_id}_task_upcoming_{task['id']}"
            if dedup_key not in dismissed_keys:
                hours_left = max(1, int(diff.total_seconds() // 3600))
                cursor.execute('''
                    INSERT OR IGNORE INTO notifications 
                    (user_id, title, message, type, related_type, related_id, is_read, created_at, dedup_key)
                    VALUES (?, ?, ?, 'assignment', 'task', ?, 0, ?, ?)
                ''', (
                    user_id,
                    f"Upcoming Due Date: {task['title']}",
                    f"{category} for {course_display} is due in ~{hours_left} hours ({task['due_date']}).",
                    task['id'],
                    now_str,
                    dedup_key
                ))

    # 2. Check Study Sessions (Scheduled today or upcoming 24 hours)
    cursor.execute('''
        SELECT s.*, c.name as course_name, c.code as course_code
        FROM study_sessions s
        LEFT JOIN courses c ON s.course_id = c.id
        WHERE s.user_id = ?
    ''', (user_id,))
    sessions = cursor.fetchall()

    today_str = now.strftime('%Y-%m-%d')
    tomorrow_str = (now + timedelta(days=1)).strftime('%Y-%m-%d')

    for s in sessions:
        s_date = s['session_date'] or (s['created_at'][:10] if s['created_at'] else '')
        if not s_date:
            continue
        
        # Check if session is today or tomorrow within 24h
        if s_date == today_str or s_date == tomorrow_str:
            dedup_key = f"user_{user_id}_session_{s['id']}_{s_date}"
            if dedup_key not in dismissed_keys:
                course_display = s['course_code'] or s['course_name'] or 'Study Plan'
                start_t = s['start_time'] or '09:00'
                day_label = 'today' if s_date == today_str else 'tomorrow'
                cursor.execute('''
                    INSERT OR IGNORE INTO notifications 
                    (user_id, title, message, type, related_type, related_id, is_read, created_at, dedup_key)
                    VALUES (?, ?, ?, 'study_session', 'study_session', ?, 0, ?, ?)
                ''', (
                    user_id,
                    f"Study Session: {s['topic']}",
                    f"You have a study session scheduled {day_label} at {start_t} for {course_display} ({s['duration_minutes']} min).",
                    s['id'],
                    now_str,
                    dedup_key
                ))

    conn.commit()


@app.route('/api/notifications', methods=['GET'])
@login_required
def get_notifications():
    user_id = session['user_id']
    conn = get_db()
    
    # Generate automatic reminders
    generate_student_reminders(conn, user_id)
    
    cursor = conn.cursor()
    cursor.execute('''
        SELECT * FROM notifications 
        WHERE user_id = ? 
        ORDER BY is_read ASC, created_at DESC 
        LIMIT 50
    ''', (user_id,))
    notifications = [dict(row) for row in cursor.fetchall()]
    
    cursor.execute('SELECT COUNT(*) FROM notifications WHERE user_id = ? AND is_read = 0;', (user_id,))
    unread_count = cursor.fetchone()[0]
    
    conn.close()
    return jsonify({
        'success': True,
        'notifications': notifications,
        'unread_count': unread_count
    })


@app.route('/api/notifications/<int:notification_id>/read', methods=['PUT'])
@login_required
def mark_notification_read(notification_id):
    user_id = session['user_id']
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('SELECT id FROM notifications WHERE id = ? AND user_id = ?;', (notification_id, user_id))
    if not cursor.fetchone():
        conn.close()
        return jsonify({'success': False, 'message': 'Notification not found.'}), 404
        
    cursor.execute('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?;', (notification_id, user_id))
    conn.commit()
    
    cursor.execute('SELECT COUNT(*) FROM notifications WHERE user_id = ? AND is_read = 0;', (user_id,))
    unread_count = cursor.fetchone()[0]
    conn.close()
    
    return jsonify({
        'success': True,
        'message': 'Notification marked as read.',
        'unread_count': unread_count
    })


@app.route('/api/notifications/read-all', methods=['PUT'])
@login_required
def mark_all_notifications_read():
    user_id = session['user_id']
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0;', (user_id,))
    conn.commit()
    conn.close()
    
    return jsonify({
        'success': True,
        'message': 'All notifications marked as read.',
        'unread_count': 0
    })


@app.route('/api/notifications/<int:notification_id>', methods=['DELETE'])
@login_required
def delete_notification(notification_id):
    user_id = session['user_id']
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('SELECT dedup_key FROM notifications WHERE id = ? AND user_id = ?;', (notification_id, user_id))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return jsonify({'success': False, 'message': 'Notification not found.'}), 404
        
    dedup_key = row['dedup_key']
    if dedup_key:
        now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        cursor.execute('''
            INSERT OR IGNORE INTO notification_dismissals (user_id, dedup_key, dismissed_at)
            VALUES (?, ?, ?);
        ''', (user_id, dedup_key, now_str))
        
    cursor.execute('DELETE FROM notifications WHERE id = ? AND user_id = ?;', (notification_id, user_id))
    conn.commit()
    
    cursor.execute('SELECT COUNT(*) FROM notifications WHERE user_id = ? AND is_read = 0;', (user_id,))
    unread_count = cursor.fetchone()[0]
    conn.close()
    
    return jsonify({
        'success': True,
        'message': 'Notification deleted successfully.',
        'unread_count': unread_count
    })


if __name__ == '__main__':
    host = os.environ.get('HOST', '127.0.0.1')
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_DEBUG', 'False').lower() in ('true', '1', 't')
    print(f"Starting ScholarFlow server on http://{host}:{port} (debug={debug}) ...")
    app.run(debug=debug, host=host, port=port)
