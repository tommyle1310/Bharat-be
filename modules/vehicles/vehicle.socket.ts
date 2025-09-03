import { IOServer } from 'socket.io';

export function registerVehicleSockets(io: IOServer) {
  io.of('/vehicles').on('connection', (socket) => {
    socket.emit('hello', { message: 'Welcome to vehicles namespace' });
  });
}


