import { Server } from 'socket.io';

export function registerVehicleSockets(io: Server) {
  io.of('/vehicles').on('connection', (socket: any) => {
    socket.emit('hello', { message: 'Welcome to vehicles namespace' });
  });
}


