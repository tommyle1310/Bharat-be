## Buyer Service Backend — Simple Instructions

### 0) Prerequisites
- Open Docker Desktop and keep it running
- Install Node.js 18+
- In the project folder, run: `npm i`

---

### 1) Local Development (Windows)
- Start (hot reload with nodemon):
```powershell
./start-dev.ps1
```
- When prompted, pick your env file:
  - Choose `.env.development` for full local
  - Choose `.env.test` if you want to connect to the Ubuntu DB
- Stop:
```powershell
./stop-dev.ps1
```

---

### 2) Deploy on Ubuntu (production)

cd /home/ubuntu/indus/be/indus_auction_system/services/buyer-service


Give execute permission once:
```bash
chmod +x indus-deploy.sh
```
Start:
```bash
./indus-deploy.sh start --env .env.test
```
Stop:
```bash
./indus-deploy.sh stop
```
Debug:
```bash
./indus-deploy.sh status
./indus-deploy.sh logs
```

---

### 3) Resource limits (already set in docker-compose)
- App: 0.4 CPU, 256MB RAM
- MySQL: 0.4 CPU, 768MB RAM
- Redis: 0.2 CPU, 128MB RAM
- Fits EC2 with 2 vCPU / ~2GB RAM

If under memory pressure, restart only Redis/MySQL:
```bash
docker restart indus_auction_system_buyer_service_redis
docker restart indus_auction_system_buyer_service_mysql
```

---

### 4) After code changes (Ubuntu) — force rebuild/reset
Use this when you deployed, changed backend code, and want a clean redeploy:
```bash
./indus-deploy.sh stop
docker rm -f indus_auction_system_buyer_service_backend \
  indus_auction_system_buyer_service_redis \
  indus_auction_system_buyer_service_mysql 2>/dev/null || true
docker image rm -f indus_auction_system_buyer_service-app 2>/dev/null || true
./indus-deploy.sh start --env .env.test
```

---

### 5) Quick tips
- Always ensure Docker Desktop is running before starting locally
- If ports are busy, retry after stopping (or let the script handle it)
- For tests or advanced usage, see `QUICK_USE.md`


