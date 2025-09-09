
import http from 'http';
import { createApp } from './app';
import { initSocket } from './config/socket';
import { config } from './config/config';
import { disconnectRedis } from './config/redis';
import { startAutoBidRunner } from './services/auto-bid.runner';

const app = createApp();
const server = http.createServer(app);
initSocket(server);
startAutoBidRunner();

server.listen(config.port, config.host, () => {
  console.log(`HTTP listening on http://${config.host}:${config.port} in ${config.env}`);
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
