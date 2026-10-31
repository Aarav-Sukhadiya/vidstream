const jwt = require('jsonwebtoken');
const { getAccessSecret } = require('../utils/tokens');

let ioInstance = null;

const userRoom = (userId) => `user:${userId}`;

/**
 * Attach authentication + per-user rooms to a Socket.IO server.
 * Clients pass their access token via `io(url, { auth: { token } })`.
 * Video status events are private to the video owner, so they are only
 * delivered to that user's room instead of being broadcast to everyone.
 */
function initRealtime(io) {
  ioInstance = io;

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (token) {
      try {
        const decoded = jwt.verify(token, getAccessSecret());
        socket.data.userId = decoded.id;
      } catch {
        // Anonymous sockets are allowed; they simply join no private rooms
      }
    }
    next();
  });

  io.on('connection', (socket) => {
    if (socket.data.userId) socket.join(userRoom(socket.data.userId));
  });
}

function emitToUser(userId, event, payload) {
  if (!ioInstance || !userId) return;
  ioInstance.to(userRoom(userId.toString())).emit(event, payload);
}

function emitVideoStatus(ownerId, payload) {
  emitToUser(ownerId, 'video:status', payload);
}

module.exports = { initRealtime, emitToUser, emitVideoStatus, userRoom };
