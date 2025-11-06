'use client';

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:8000', {
      transports: ['websocket', 'polling'],
    });
  }
  return socket;
};

export const useSocket = () => {
  const [socketInstance, setSocketInstance] = useState<Socket | null>(null);

  useEffect(() => {
    const s = getSocket();
    setSocketInstance(s);

    s.on('connect', () => {
      console.log('Connected to WebSocket server');
    });

    s.on('disconnect', () => {
      console.log('Disconnected from WebSocket server');
    });

    return () => {
      if (s.connected) {
        s.disconnect();
      }
    };
  }, []);

  return socketInstance;
};