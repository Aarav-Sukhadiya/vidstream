import { io } from 'socket.io-client';
import { getAccessToken } from './client';

/**
 * Open an authenticated Socket.IO connection. Video status events are only sent
 * to the owner's room, so the access token is required to receive them.
 */
export function connectSocket() {
  return io(import.meta.env.VITE_SOCKET_URL || '/', {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    auth: (cb) => cb({ token: getAccessToken() }),
  });
}
