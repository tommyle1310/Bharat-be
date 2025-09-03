import { Server as HTTPServer } from 'http';
import { Server as IOServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { getRedis } from './redis';

let io: IOServer | null = null;

export function initSocket(server: HTTPServer): IOServer {
  if (io) return io;

  io = new IOServer(server, {
    cors: {
      origin: '*',
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

export function getIO(): IOServer {
  if (!io) throw new Error('Socket.IO not initialized. Call initSocket(server) first.');
  return io;
}
