import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import config from '../config';

let io: SocketIOServer;

export function initializeSocket(httpServer: HTTPServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: config.corsOrigin,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.on('connection', (socket: Socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // Join resident's room for targeted notifications
    socket.on('join:resident-room', (residentId: number) => {
      const room = `resident-${residentId}`;
      socket.join(room);
      console.log(`👤 Socket ${socket.id} joined room: ${room}`);
    });

    // Leave resident's room
    socket.on('leave:resident-room', (residentId: number) => {
      const room = `resident-${residentId}`;
      socket.leave(room);
      console.log(`👤 Socket ${socket.id} left room: ${room}`);
    });

    // Join admin room for query notifications
    socket.on('join:admin-room', () => {
      socket.join('admin-room');
      console.log(`🛡️ Socket ${socket.id} joined admin-room`);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`❌ Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error('Socket.IO not initialized. Call initializeSocket first.');
  }
  return io;
}

export default { initializeSocket, getIO };
