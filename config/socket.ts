import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { getRedis } from './redis';
import { config } from './config';

let io: SocketIOServer | null = null;

export function initSocket(server: HTTPServer): SocketIOServer {
  if (io) return io;

  io = new SocketIOServer(server, {
    cors: {
      origin: config.corsOrigin,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      credentials: true,
    },
    serveClient: false,
  });

  // Redis adapter for horizontal scaling/pubsub
  const pubClient = getRedis();
  const subClient = pubClient.duplicate();
  io.adapter(createAdapter(pubClient, subClient));

  io.on('connection', (socket) => {
    console.log('[Socket.IO] client connected', socket.id);
    socket.on('disconnect', (reason) => {
      console.log('[Socket.IO] client disconnected', socket.id, reason);
    });
  });

  return io;
}

export function getIO(): SocketIOServer {
  if (!io) throw new Error('Socket.IO not initialized. Call initSocket(server) first.');
  return io;
}
