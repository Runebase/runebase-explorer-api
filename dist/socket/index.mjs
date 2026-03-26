import { Server } from 'socket.io';
import app from '../app.mjs';
import logger from '../utils/logger.mjs';
let io;
export function initSocketIO(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });
  app.io = io;
  const namespace = io.of('/');
  namespace.on('connection', socket => {
    // Emit block height on connection (replaces egg-socket.io connection middleware)
    let interval = setInterval(() => {
      if (app.blockchainInfo.tip) {
        socket.emit('block-height', app.blockchainInfo.tip.height);
        clearInterval(interval);
      }
    }, 0);
    socket.on('subscribe', (...rooms) => {
      if (rooms.length) {
        for (let room of rooms) {
          socket.join(room);
        }
      }
    });
    socket.on('unsubscribe', (...rooms) => {
      if (rooms.length) {
        for (let room of rooms) {
          socket.leave(room);
        }
      }
    });
    socket.on('disconnect', () => {
      // cleanup if needed
    });
  });
  logger.info('Socket.IO initialized');
  return io;
}
export function getIO() {
  return io;
}