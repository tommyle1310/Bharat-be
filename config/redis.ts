import Redis, { Redis as RedisClient, RedisOptions } from 'ioredis';
import { config } from './config';

let redisClient: RedisClient | null = null;

export function getRedis(): RedisClient {
  console.log(`[Redis] Connecting to ${'127.0.0.1'}:${config.redis.port} db=${config.redis.db}`);
  if (redisClient) return redisClient;

  const options: RedisOptions = {
    host: '127.0.0.1',
    port: config.redis.port,
    db: config.redis.db,
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  };

  if (config.redis.username !== undefined) {
    options.username = config.redis.username;
  }
  if (config.redis.password !== undefined) {
    options.password = config.redis.password;
  }
  if (config.redis.tls !== undefined) {
    options.tls = config.redis.tls;
  }

  redisClient = new Redis(options);

  redisClient.on('error', (err) => {
    console.error('[Redis] error', err);
  });

  redisClient.on('connect', () => {
    console.log('[Redis] connected');
  });

  redisClient.on('ready', () => {
    console.log('[Redis] ready');
  });

  return redisClient;
}

export async function checkRedisHealth(): Promise<boolean> {
  try {
    const client = getRedis();
    const pong = await client.ping();
    return pong === 'PONG';
  } catch (e) {
    return false;
  }
}

export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}
