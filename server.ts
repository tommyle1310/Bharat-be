
import http from 'http';
import { createApp } from './app';
import { initSocket } from './config/socket';
import { config } from './config/config';
import { disconnectRedis } from './config/redis';
import { startAutoBidRunner } from './services/auto-bid.runner';
import { getRedis } from './config/redis';
import { getIO } from './config/socket';

const app = createApp();
const server = http.createServer(app);
initSocket(server);
// startAutoBidRunner();

server.listen(config.port, config.host, () => {
  console.log(`HTTP listening on http://${config.host}:${config.port} in ${config.env}`);
  // Subscribe to Redis channels/keys for cross-process events and forward via Socket.IO
  const redis = getRedis().duplicate();
  redis.on('message', (channel, message) => {
    try {
      const io = getIO();
      if (channel === 'vehicle:endtime:update') {
        const payload = JSON.parse(message);
        io.emit('vehicle:endtime:update', payload);
      } else if (channel === 'vehicle:winner:update') {
        const payload = JSON.parse(message);
        io.emit('vehicle:winner:update', payload);
        // Additionally, emit convenience events to specific buyers if they are identified
        if (payload?.winnerBuyerId) io.to(String(payload.winnerBuyerId)).emit('isWinning', { vehicleId: payload.vehicleId });
        if (payload?.loserBuyerId) io.to(String(payload.loserBuyerId)).emit('isLosing', { vehicleId: payload.vehicleId });
      }
    } catch (e) {
      console.error('[Redis->Socket] Failed handling message', channel, e);
    }
  });
  // Use Redis pub/sub channels for events
  redis.subscribe('vehicle:endtime:update', 'vehicle:winner:update').catch((e) => {
    console.error('[Redis] subscribe error', e);
  });
});

const shutdown = async (signal: string) => {
  console.log(`\nReceived ${signal}. Graceful shutdown...`);
  server.close(async () => {
    await disconnectRedis();
    console.log('Server closed. Bye.');
    process.exit(0);
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
