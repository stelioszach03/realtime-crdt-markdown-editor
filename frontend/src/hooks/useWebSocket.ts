/**
 * WebSocket hook for real-time collaboration
 */
import { useEffect, useRef, useCallback, useState } from 'react';
import { WebSocketClient, ConnectionStatus, PresenceData } from '../api/wsClient';
import { CRDTOperation } from '../crdt/clientCrdt';

interface UseWebSocketOptions {
  documentId: string;
  token?: string | null;
  onOperation?: (operation: CRDTOperation) => void;
  onPresence?: (presence: PresenceData) => void;
  onInitialState?: (state: any) => void;
  onError?: (error: string) => void;
  autoConnect?: boolean;
}

interface UseWebSocketReturn {
  connectionStatus: ConnectionStatus;
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
  sendOperation: (operation: CRDTOperation) => void;
  sendCursorUpdate: (position: number, selectionStart?: number, selectionEnd?: number) => void;
  sendPresenceUpdate: (data: Partial<PresenceData>) => void;
  connectedUsers: Map<string, PresenceData>;
}

export const useWebSocket = ({
  documentId,
  token,
  onOperation,
  onPresence,
  onInitialState,
  onError,
  autoConnect = true,
}: UseWebSocketOptions): UseWebSocketReturn => {
  const wsClientRef = useRef<WebSocketClient | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    status: 'disconnected',
    reconnectAttempts: 0,
  });
  const [connectedUsers, setConnectedUsers] = useState<Map<string, PresenceData>>(new Map());

  // Initialize WebSocket client
  useEffect(() => {
    if (!documentId) return;
    
    // Clean up any existing connection first
    if (wsClientRef.current) {
      wsClientRef.current.destroy();
      wsClientRef.current = null;
    }

    wsClientRef.current = new WebSocketClient(documentId, token);

    // Set up event handlers
    wsClientRef.current.onConnectionStatus(setConnectionStatus);

    wsClientRef.current.onOperation((operation) => {
      onOperation?.(operation);
    });

    wsClientRef.current.onPresence((presence) => {
      setConnectedUsers(prev => {
        const newMap = new Map(prev);
        if (presence.site_id) {
          newMap.set(presence.site_id, presence);
        }
        return newMap;
      });
      onPresence?.(presence);
    });

    wsClientRef.current.onInitialState((state) => {
      onInitialState?.(state);
    });

    wsClientRef.current.onError((error) => {
      console.error('WebSocket error:', error);
      onError?.(error);
    });

    // Auto-connect if enabled
    if (autoConnect) {
      wsClientRef.current.connect();
    }

    // Cleanup on unmount
    return () => {
      if (wsClientRef.current) {
        wsClientRef.current.destroy();
        wsClientRef.current = null;
      }
    };
  }, [documentId, token]); // Remove function dependencies to prevent re-renders

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = () => {
      if (wsClientRef.current && !wsClientRef.current.isConnected()) {
        wsClientRef.current.connect();
      }
    };

    const handleOffline = () => {
      // WebSocket will automatically handle disconnection
      // We don't need to manually disconnect here
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Handle visibility change (tab focus/blur)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab is hidden, reduce activity
        return;
      }
      
      // Tab is visible, ensure connection
      if (wsClientRef.current && !wsClientRef.current.isConnected()) {
        wsClientRef.current.connect();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const connect = useCallback(() => {
    wsClientRef.current?.connect();
  }, []);

  const disconnect = useCallback(() => {
    wsClientRef.current?.disconnect();
  }, []);

  const sendOperation = useCallback((operation: CRDTOperation) => {
    wsClientRef.current?.sendOperation(operation);
  }, []);

  const sendCursorUpdate = useCallback((
    position: number,
    selectionStart?: number,
    selectionEnd?: number
  ) => {
    wsClientRef.current?.sendCursorUpdate(position, selectionStart, selectionEnd);
  }, []);

  const sendPresenceUpdate = useCallback((data: Partial<PresenceData>) => {
    wsClientRef.current?.sendPresenceUpdate(data);
  }, []);

  const isConnected = wsClientRef.current?.isConnected() ?? false;

  return {
    connectionStatus,
    isConnected,
    connect,
    disconnect,
    sendOperation,
    sendCursorUpdate,
    sendPresenceUpdate,
    connectedUsers,
  };
};

// Hook for managing offline operation queue
export const useOfflineQueue = () => {
  const [queuedOperations, setQueuedOperations] = useState<CRDTOperation[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const queueOperation = useCallback((operation: CRDTOperation) => {
    setQueuedOperations(prev => [...prev, operation]);
    
    // Store in localStorage for persistence
    const stored = localStorage.getItem('offline_operations');
    const operations = stored ? JSON.parse(stored) : [];
    operations.push(operation);
    localStorage.setItem('offline_operations', JSON.stringify(operations));
  }, []);

  const flushQueue = useCallback((sendOperation: (op: CRDTOperation) => void) => {
    queuedOperations.forEach(sendOperation);
    setQueuedOperations([]);
    localStorage.removeItem('offline_operations');
  }, [queuedOperations]);

  const clearQueue = useCallback(() => {
    setQueuedOperations([]);
    localStorage.removeItem('offline_operations');
  }, []);

  // Load queued operations from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('offline_operations');
    if (stored) {
      try {
        const operations = JSON.parse(stored);
        setQueuedOperations(operations);
      } catch (error) {
        console.error('Failed to load offline operations:', error);
        localStorage.removeItem('offline_operations');
      }
    }
  }, []);

  return {
    isOnline,
    queuedOperations,
    queueOperation,
    flushQueue,
    clearQueue,
  };
};