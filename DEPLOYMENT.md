# 🚀 ScholarFlow: Production Deployment Readiness & Operations Guide

This document inspects and outlines the technical readiness of **ScholarFlow** for production deployment in cloud environments, institutional servers, or dedicated virtual private servers (VPS).

---

## 🔍 1. Production Readiness Audit

| Category | Requirement | Current Status | Audit Details |
| :--- | :--- | :---: | :--- |
| **Secret Key Configuration** | Strong random cryptographic key; no hardcoded defaults in production | **READY** | Configured in `app.py` via `os.environ.get('SECRET_KEY')`. Reads from environment variable or `.env`. |
| **Debug Mode** | `debug=False` in production to prevent arbitrary code execution | **READY** | `app.py` reads `FLASK_DEBUG` from environment and defaults to `False`. |
| **Session Cookie Security** | Cookies protected against script access and cross-site tampering | **READY** | `SESSION_COOKIE_HTTPONLY = True`, `SESSION_COOKIE_SAMESITE = 'Lax'`. `SESSION_COOKIE_SECURE` can be enabled behind HTTPS. |
| **Database Persistence** | Data directory and SQLite file preserved across server restarts | **READY** | `database.py` supports configurable path via `DATABASE_PATH` environment variable. |
| **Static File Delivery** | CSS, JS, fonts, and icons served efficiently | **READY** | Native Flask static handler configured. In production, Nginx or Cloudflare can serve `/static` directly for maximum throughput. |
| **WSGI Server Support** | Do not use Flask's built-in single-threaded development server in production | **READY** | Full compatibility with **Waitress** (Windows/Cross-platform) and **Gunicorn** (Linux/Docker). |
| **Dependency Manifest** | Complete, version-pinned `requirements.txt` | **READY** | `requirements.txt` specifies Flask, Werkzeug, python-dotenv, waitress, gunicorn, requests, and websockets. |
| **Cross-Origin Security** | Prevent unauthorized API access | **READY** | Same-origin policy enforced by default; no permissive CORS headers. |

---

## 🛠️ 2. Deployment Configurations

### Option 1: Windows Server Production Deployment (with Waitress)

Waitress is a production-quality, multi-threaded pure-Python WSGI server designed specifically for Windows and cross-platform environments.

#### Step 1: Install Waitress
```powershell
pip install waitress
```

#### Step 2: Configure Environment (`.env`)
Create a `.env` file in the project root:
```env
FLASK_APP=app.py
FLASK_DEBUG=False
SECRET_KEY=9f83b1c4e72a5018d3f6a2b8e4c7d01f5e8b2c4a7d1e0f3b6c9a2e5d8f1b4c7a
HOST=0.0.0.0
PORT=5000
DATABASE_PATH=student_tasks.db
```

#### Step 3: Run with Waitress
```powershell
waitress-serve --host=0.0.0.0 --port=5000 --threads=4 app:app
```
*Note: Waitress handles multi-threading efficiently, managing concurrent student requests without blocking.*

---

### Option 2: Linux VPS / Cloud Server Deployment (Ubuntu / Debian with Gunicorn & Nginx)

For deployment on AWS EC2, DigitalOcean Droplet, Linode, or Google Compute Engine:

#### Step 1: Install System Dependencies
```bash
sudo apt update && sudo apt install -y python3-pip python3-venv nginx
```

#### Step 2: Set Up Virtual Environment & Dependencies
```bash
cd /var/www/scholarflow
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

#### Step 3: Configure Gunicorn Systemd Service
Create `/etc/systemd/system/scholarflow.service`:
```ini
[Unit]
Description=ScholarFlow Student Task Manager Gunicorn Service
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/var/www/scholarflow
Environment="PATH=/var/www/scholarflow/venv/bin"
EnvironmentFile=/var/www/scholarflow/.env
ExecStart=/var/www/scholarflow/venv/bin/gunicorn --workers 4 --bind 127.0.0.1:5000 app:app

[Install]
WantedBy=multi-user.target
```

Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable scholarflow
sudo systemctl start scholarflow
```

#### Step 4: Configure Nginx as Reverse Proxy
Create `/etc/nginx/sites-available/scholarflow`:
```nginx
server {
    listen 80;
    server_name scholarflow.yourdomain.edu;

    # Serve static assets directly for maximum speed
    location /static/ {
        alias /var/www/scholarflow/static/;
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }

    # Proxy dynamic requests to Gunicorn
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site and test configuration:
```bash
sudo ln -s /etc/nginx/sites-available/scholarflow /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### Step 5: Enable Free SSL / HTTPS (Let's Encrypt Certbot)
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d scholarflow.yourdomain.edu
```

---

### Option 3: Containerized Deployment (Docker & Docker Compose)

For platform-agnostic deployment across cloud providers:

#### `Dockerfile`:
```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Prevent Python from writing .pyc files and buffer output
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Persist database on volume mount
VOLUME ["/app/data"]
ENV DATABASE_PATH=/app/data/student_tasks.db

EXPOSE 5000

CMD ["gunicorn", "--workers", "4", "--bind", "0.0.0.0:5000", "app:app"]
```

#### `docker-compose.yml`:
```yaml
version: '3.8'

services:
  scholarflow:
    build: .
    container_name: scholarflow_app
    restart: always
    ports:
      - "5000:5000"
    environment:
      - FLASK_DEBUG=False
      - SECRET_KEY=${SECRET_KEY}
      - DATABASE_PATH=/app/data/student_tasks.db
    volumes:
      - scholarflow_data:/app/data

volumes:
  scholarflow_data:
```

---

## 🔒 3. Production Security Checklist

Before publishing the application to the internet:

1. **Generate a Strong Production Secret Key**:
   Run this Python one-liner to generate a cryptographically strong 64-character secret key:
   ```bash
   python -c "import secrets; print(secrets.token_hex(32))"
   ```
   Paste this value into `.env` as `SECRET_KEY=...`. Never commit `.env` to Git.

2. **Enable HTTPS / SSL**:
   When running behind HTTPS, add this line in `app.py`:
   ```python
   app.config['SESSION_COOKIE_SECURE'] = True
   ```
   This ensures session cookies are never transmitted over unencrypted HTTP connections.

3. **Database Backup Strategy**:
   Configure a recurring daily cron job or Windows Task Scheduler to back up the SQLite database file:
   ```bash
   sqlite3 student_tasks.db ".backup '/var/backups/scholarflow_$(date +\%Y\%m\%d).db'"
   ```

4. **File Permissions**:
   Ensure the database file is owned by the web process user (`www-data`) and has restricted permissions (`chmod 600 student_tasks.db`).

---

## 📋 4. What Requires User Action for Actual Cloud Hosting

To deploy ScholarFlow to a live public URL (e.g., on Render, Railway, DigitalOcean, or AWS):
1. **Domain Name**: Purchase or configure a domain name (or use a free subdomain provided by Render / Railway).
2. **DNS Records**: Point the domain's `A` or `CNAME` records to the server's public IP address.
3. **Environment Secrets**: Generate and input your production `SECRET_KEY` in the hosting platform's environment variables console.
4. **Persistent Disk**: If deploying on serverless containers (such as Render or Railway), attach a persistent disk volume to the container so that `student_tasks.db` persists across container redeployments.

