'use strict';

const { Server } = require('socket.io');
const env = require('./config/env');
const { authenticateToken } = require('./services/authService');
const realtime = require('./services/realtime');

/**
 * Sockets authenticate with the same token as the REST API
 * (`io(url, { auth: { token } })`) and are placed in rooms server-side;
 * clients never choose which rooms they join.
 */
function attachSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: env.corsOrigins, methods: ['GET', 'POST'] },
  });

  io.use(async (socket, next) => {
    try {
      socket.data.auth = await authenticateToken(socket.handshake.auth?.token);
      next();
    } catch {
      next(new Error('Authentification requise'));
    }
  });

  io.on('connection', (socket) => {
    const { role, id, account, session } = socket.data.auth;
    if (role === 'user') {
      socket.join(['users', `user:${id}`]);
    } else {
      socket.join(account.departmentId ? `admins:dept:${account.departmentId}` : 'admins');
    }
    // Disconnect when the session expires.
    const remaining = new Date(session.expiresAt).getTime() - Date.now();
    const timer = setTimeout(() => socket.disconnect(true), Math.min(Math.max(remaining, 0), 2 ** 31 - 1));
    socket.on('disconnect', () => clearTimeout(timer));
  });

  realtime.setServer(io);
  return io;
}

module.exports = { attachSocketServer };
