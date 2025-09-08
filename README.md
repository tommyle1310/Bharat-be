## Backend setup

### Environment
Create a `.env` file based on the following keys:

```
NODE_ENV=development
HOST=0.0.0.0
PORT=1310

# CORS: comma separated list or *
CORS_ORIGIN=*

# Redis basic
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_DB=0
# Optional auth
# REDIS_USERNAME=
# REDIS_PASSWORD=
# REDIS_TLS=false
```

### Scripts
- `npm run dev` - start with ts-node + nodemon
- `npm run build` - compile TypeScript to `dist`
- `npm start` - run compiled build

### Health check
GET `/health` returns `{ status: 'ok', redis: 'up|down' }`.

### Socket.IO
Server initializes Socket.IO with Redis adapter. Connect to `ws://HOST:PORT`.

