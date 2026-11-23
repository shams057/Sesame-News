import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { API_URL, tokenStore } from './api';
import { useAuth } from '../auth/AuthContext';

const SocketContext = createContext(null);

/**
 * One Socket.IO connection for the whole back-office. Server events
 * invalidate the matching React Query caches, so every screen stays fresh
 * without polling.
 */
export function SocketProvider({ children }) {
  const { account } = useAuth();
  const queryClient = useQueryClient();
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (!account) return undefined;
    const connection = io(API_URL, { auth: { token: tokenStore.get() }, transports: ['websocket', 'polling'] });
    const refreshTickets = () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      queryClient.invalidateQueries({ queryKey: ['unread'] });
    };
    connection.on('ticket:created', refreshTickets);
    connection.on('ticket:updated', (ticket) => {
      refreshTickets();
      queryClient.invalidateQueries({ queryKey: ['ticket', ticket.id] });
    });
    connection.on('ticket:deleted', refreshTickets);
    connection.on('ticket:message', (message) => {
      refreshTickets();
      queryClient.invalidateQueries({ queryKey: ['messages', message.ticketId] });
    });
    connection.on('connect', () => setSocket(connection));
    return () => {
      connection.disconnect();
      setSocket(null);
    };
  }, [account, queryClient]);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}

/** Subscribes to a socket event for the lifetime of the component. */
export function useSocketEvent(event, handler) {
  const socket = useContext(SocketContext);
  const handlerRef = useRef(handler);
  useEffect(() => { handlerRef.current = handler; });
  useEffect(() => {
    if (!socket) return undefined;
    const listener = (payload) => handlerRef.current(payload);
    socket.on(event, listener);
    return () => socket.off(event, listener);
  }, [socket, event]);
}
