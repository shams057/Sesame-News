import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { API_URL, getAuthToken } from '../api/client';
import { useAuth } from '../auth/AuthContext';

const SocketContext = createContext(null);

/**
 * One Socket.IO connection for the whole app (it used to be three).
 * Server events refresh the matching cached queries.
 */
export function SocketProvider({ children }) {
  const { status } = useAuth();
  const queryClient = useQueryClient();
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (status !== 'authenticated' || !getAuthToken()) return undefined;
    const connection = io(API_URL, { auth: { token: getAuthToken() }, transports: ['websocket', 'polling'] });
    connection.on('ticket:message', (message) => {
      queryClient.invalidateQueries({ queryKey: ['messages', message.ticketId] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      queryClient.invalidateQueries({ queryKey: ['unread'] });
    });
    connection.on('ticket:updated', (ticket) => {
      queryClient.invalidateQueries({ queryKey: ['ticket', ticket.id] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    });
    connection.on('ticket:read', () => queryClient.invalidateQueries({ queryKey: ['unread'] }));
    connection.on('news:published', () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['unseen'] });
    });
    connection.on('connect', () => setSocket(connection));
    return () => {
      connection.disconnect();
      setSocket(null);
    };
  }, [status, queryClient]);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}

export function useSocketEvent(event, handler) {
  const socket = useContext(SocketContext);
  const ref = useRef(handler);
  useEffect(() => { ref.current = handler; });
  useEffect(() => {
    if (!socket) return undefined;
    const listener = (payload) => ref.current(payload);
    socket.on(event, listener);
    return () => socket.off(event, listener);
  }, [socket, event]);
}
