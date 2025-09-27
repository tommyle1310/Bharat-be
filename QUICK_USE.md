# KMSG Buyer Service - Quick Setup Guide

## 🚀 Quick Start

### Local Development (Windows)
```powershell
# 1. Start development with hot reload (nodemon)
.\start-dev.ps1

# 2. Stop when done
.\stop-dev.ps1
```

### Remote Server (Ubuntu)
```bash
# 1. Start production
./indus-deploy.sh start --env .env.test

# 2. Stop when done
./indus-deploy.sh stop
```

---

## 📋 Prerequisites

- **Docker & Docker Compose** installed
- **Node.js 18+** installed
- **PowerShell** (Windows) or **Bash** (Linux/Mac)

---

## 🏠 Local Development

### Setup
1. **Install dependencies**: `npm install`
2. **Start development**: `.\start-dev.ps1`
3. **Choose environment**: Select `.env.development` (option 1)
4. **Wait for containers**: Redis + MySQL will start automatically
5. **App starts with nodemon**: Code changes auto-restart server

### What happens:
- ✅ Redis container starts on port 6381
- ✅ MySQL container starts on port 3308  
- ✅ App runs with nodemon (hot reload)
- ✅ Local file paths: `D:\jobs\upwork\kmsg\data-files`
- ✅ Images accessible at: `http://localhost:1310/data-files/vehicles/1/1.jpg`

### Commands (PowerShell)
```powershell
# Start development
.\start-dev.ps1

# Stop development  
.\stop-dev.ps1

# Run migrations
npm run db:migrate

# Seed database
npm run db:seed
```

### If you prefer Git Bash on Windows
```bash
# Use a Windows path for the volume mount
export LOCAL_DATA_FILES_PATH='/d/jobs/upwork/kmsg/data-files'

# Start/Stop stack from Git Bash
./indus-deploy.sh start --env .env.test
./indus-deploy.sh stop
```

---

## 🌐 Remote Server (Ubuntu)

### Setup
1. **Upload project** to server
2. **Install dependencies**: `npm install`
3. **Configure .env.test** with remote database
4. **Start production**: `./indus-deploy.sh start --env .env.test`
   - This now always rebuilds the app image to pick up your latest code
   - If you still see old code, force a clean start:
     ```bash
     ./indus-deploy.sh stop
     docker rm -f indus_auction_system_buyer_service_backend indus_auction_system_buyer_service_redis indus_auction_system_buyer_service_mysql 2>/dev/null || true
     docker image rm -f indus_auction_system_buyer_service-app 2>/dev/null || true
     ./indus-deploy.sh start --env .env.test
     ```

### What happens:
- ✅ Uses remote database from `.env.test`
- ✅ Redis fallback to local container if remote fails
- ✅ File paths: `/home/ubuntu/indus/data_files`
- ✅ App accessible at: `http://server:1310`

### Commands
```bash
chmod +x indus-deploy.sh


# Start production
./indus-deploy.sh start --env .env.test

# Stop production
./indus-deploy.sh stop

# Check status
./indus-deploy.sh status

# View logs
./indus-deploy.sh logs

# Resource limits (auto-applied)
# - App: 0.4 CPU, 256MB RAM
# - MySQL: 0.4 CPU, 768MB RAM
# - Redis: 0.2 CPU, 128MB RAM
# This fits your EC2 (2 vCPU, ~2GB RAM) with margin.
# Tip: If under memory pressure, restart just Redis/MySQL:
#   docker restart indus_auction_system_buyer_service_redis
#   docker restart indus_auction_system_buyer_service_mysql
```

---

## 🧪 Run tests locally (step-by-step)

npm run test runs on your HOST (not inside Docker). Make sure Redis/DB hostnames are resolvable from your host.

### Option A — Use remote DB from .env.test (recommended, PowerShell)
```powershell
# 1) Ensure stack is running (redis will be local, DB is remote per .env.test)
& "C:\Program Files\Git\bin\bash.exe" -lc "./indus-deploy.sh start --env .env.test"

# 2) Override Redis for your local process (use the mapped host port 6381)
$env:REDIS_HOST="127.0.0.1"; $env:REDIS_PORT="6381"; npm run test
# DB stays remote as defined in .env.test

# Optional: if your test needs local Windows data files path instead of Linux path from .env.test
$env:LOCAL_DATA_FILES_PATH="D:\\jobs\\upwork\\kmsg\\data-files"; npm run test
```

### Option A (Git Bash)
```bash
./indus-deploy.sh start --env .env.test
export REDIS_HOST=127.0.0.1 REDIS_PORT=6381
# Optional local files path
export LOCAL_DATA_FILES_PATH='/d/jobs/upwork/kmsg/data-files'
npm run test
```

### Option B — Use local DB + local Redis (PowerShell)
```powershell
# 1) Start with local DB preferred
./indus-deploy.sh start --env .env.test --prefer-local-db

# 2) Override both Redis and DB for your local process
$env:REDIS_HOST="127.0.0.1"; $env:REDIS_PORT="6381"; \
$env:DB_HOST="127.0.0.1"; $env:DB_PORT="3308"; \
$env:DB_USER="indus_app_user"; $env:DB_PASSWORD="IndusProd"; $env:DB_NAME="prod_indus_db"; \
npm run test
```

### Option B (Git Bash)
```bash
./indus-deploy.sh start --env .env.test --prefer-local-db
export REDIS_HOST=127.0.0.1 REDIS_PORT=6381
export DB_HOST=127.0.0.1 DB_PORT=3308
export DB_USER=indus_app_user DB_PASSWORD=IndusProd DB_NAME=prod_indus_db
npm run test
```

### Option C — Regenerate a local-friendly .env.runtime for tests (PowerShell)
```powershell
# Copy remote env, then rewrite Redis to localhost
Copy-Item .env.test .env.runtime -Force
(Get-Content .env.runtime) | % { 
  $_ -replace '^REDIS_HOST=.*','REDIS_HOST=127.0.0.1' `
     -replace '^REDIS_PORT=.*','REDIS_PORT=6381' 
} | Set-Content .env.runtime

npm run test
```

### Run bash script from PowerShell (if PS can’t execute .sh)
```powershell
& "C:\Program Files\Git\bin\bash.exe" -lc "./indus-deploy.sh start --env .env.test"
& "C:\Program Files\Git\bin\bash.exe" -lc "./indus-deploy.sh stop"
```

Tip:
- If you used `.\start-dev.ps1`, it already writes `.env.runtime` with 127.0.0.1 for Redis/DB.
- If you used `./indus-deploy.sh`, your `.env.runtime` may point to container hostnames (`redis`, `mysql`). Use the overrides above or regenerate `.env.runtime`.

---

## 🐛 Common Issues & Fixes

### ❌ "Port 1310 already in use"
**Fix**: Script will ask to stop the process. Choose `y` to continue.

### ❌ "Redis connection failed"
**Fix**: 
```powershell
# Check if Redis container is running
docker ps | findstr redis

# Restart Redis
docker restart indus_auction_system_buyer_service_redis
```

### ❌ "Database connection failed" or "Access denied for user"
**Fix**:
```powershell
# Check if MySQL container is running
docker ps | findstr mysql

# Fix database credentials in .env.runtime
(Get-Content .env.runtime) | ForEach-Object { 
    $_ -replace '^DB_USER=.*', 'DB_USER=indus_app_user' `
       -replace '^DB_PASSWORD=.*', 'DB_PASSWORD=IndusProd' `
       -replace '^DB_NAME=.*', 'DB_NAME=prod_indus_db' 
} | Set-Content .env.runtime

# Restart MySQL if needed
docker restart indus_auction_system_buyer_service_mysql
```

### ❌ "Images not loading (404 error)"
**Fix**: 
- Local: Ensure `D:\jobs\upwork\kmsg\data-files\vehicles\1\1.jpg` exists
- Remote: Ensure `/home/ubuntu/indus/data_files/vehicles/1/1.jpg` exists

### ❌ "PowerShell script won't run"
**Fix**:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### ❌ "Docker containers won't start" (Windows Git Bash shows: mkdir C:\Program Files\Git\home: Access is denied.)
Cause: LOCAL_DATA_FILES_PATH points to a Linux-style /home path. On Git Bash, /home maps to C:\\Program Files\\Git\\home.
Fix:
```bash
export LOCAL_DATA_FILES_PATH='/d/jobs/upwork/kmsg/data-files'
./indus-deploy.sh stop
./indus-deploy.sh start --env .env.test
```

---

## 📊 Container Info

### Container Names
- **App**: `indus_auction_system_buyer_service_backend`
- **MySQL**: `indus_auction_system_buyer_service_mysql`
- **Redis**: `indus_auction_system_buyer_service_redis`

### Ports
- **App**: `1310` (http://localhost:1310)
- **MySQL**: `3308` (for local development)
- **Redis**: `6381` (for local development)

### Network
- **Network**: `indus_buyer_net`

---

## 🎯 Development Workflow

### Local Development (Recommended)
1. Run `.\start-dev.ps1`
2. Make code changes
3. Server auto-restarts (nodemon)
4. Test APIs at `http://localhost:1310`
5. Run `.\stop-dev.ps1` when done

### Docker Development
1. Run `./indus-deploy.sh start --env .env.test --prefer-local-db`
2. Make code changes
3. Run `docker restart indus_auction_system_buyer_service_backend`
4. Test APIs at `http://localhost:1310`
5. Run `./indus-deploy.sh stop` when done

---

## 🔄 Migration Commands

```bash
# Run database migration
npm run db:migrate

# Seed database with test data
npm run db:seed

# Reset database (WARNING: Deletes all data)
npm run db:reset
```

---

## 📝 Quick Reference

| Task | Local | Remote |
|------|-------|--------|
| **Start** | `.\start-dev.ps1` | `./indus-deploy.sh start --env .env.test` |
| **Stop** | `.\stop-dev.ps1` | `./indus-deploy.sh stop` |
| **Status** | `docker ps` | `./indus-deploy.sh status` |
| **Logs** | `docker logs -f container_name` | `./indus-deploy.sh logs` |
| **Migrate** | `npm run db:migrate` | `npm run db:migrate` |

---

## 🆘 Emergency Reset

If everything breaks:

```bash
# Nuclear option - clean everything
./indus-deploy.sh stop
docker stop $(docker ps -aq) 2>/dev/null || true
docker rm $(docker ps -aq) 2>/dev/null || true
docker system prune -af
rm -f .env.runtime

# Start fresh
./indus-deploy.sh start --env .env.test --prefer-local-db
```

---

**That's it!** 🎉 

- **Local development**: Use `.\start-dev.ps1` for hot reload
- **Remote deployment**: Use `./indus-deploy.sh start --env .env.test`
- **Testing**: Follow the "Run tests locally" section above for exact steps
- **Problems**: Check the Common Issues section above