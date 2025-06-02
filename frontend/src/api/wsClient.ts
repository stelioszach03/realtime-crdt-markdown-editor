/**
 * WebSocket client for real-time collaboration
 */
import { CRDTOperation } from '../crdt/clientCrdt';

export interface WSMessage {
  type: string;
  [key: string]: any;
}

export interface PresenceData {
  user_id?: string;
  username: string;
  site_id: string;
  cursor_position?: number;
  selection_start?: number;
  selection_end?: number;
}

export interface ConnectionStatus {
  status: 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error';
  lastConnected?: Date;
  reconnectAttempts: number;
}

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private documentId: string;
  private token: string | null;
  private baseUrl: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second
  private maxReconnectDelay = 30000; // Max 30 seconds
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isManuallyDisconnected = false;
  
  // Event handlers
  private onOperationHandler?: (operation: CRDTOperation) => void;
  private onPresenceHandler?: (presence: PresenceData) => void;
  private onConnectionStatusHandler?: (status: ConnectionStatus) => void;
  private onInitialStateHandler?: (state: any) => void;
  private onErrorHandler?: (error: string) => void;

  constructor(documentId: string, token: string | null = null) {
    this.documentId = documentId;
    this.token = token;
    
    // Use the same base URL as the API client
    const apiBaseUrl = import.meta.env.VITE_API_URL || 
      `${window.location.protocol}//${window.location.hostname}:8000`;
    
    // Convert http/https to ws/wss
    this.baseUrl = apiBaseUrl.replace(/^http/, 'ws');
  }

  connect(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    this.isManuallyDisconnected = false;
    this.updateConnectionStatus('connecting');

    try {
      const wsUrl = `${this.baseUrl}/ws/${this.documentId}${this.token ? `?token=${this.token}` : ''}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
      this.ws.onerror = this.handleError.bind(this);
    } catch (error) {
      this.updateConnectionStatus('error');
      this.scheduleReconnect();
    }
  }

  disconnect(): void {
    this.isManuallyDisconnected = true;
    this.clearReconnectTimer();
    
    if (this.ws) {
      this.ws.close(1000, 'Manual disconnect');
      this.ws = null;
    }
    
    this.updateConnectionStatus('disconnected');
  }

  sendOperation(operation: CRDTOperation): void {
    if (!this.isConnected()) {
      return;
    }

    const message: WSMessage = {
      type: 'operation',
      operation: operation
    };

    this.send(message);
  }

  sendCursorUpdate(position: number, selectionStart?: number, selectionEnd?: number): void {
    if (!this.isConnected()) {
      return;
    }

    const message: WSMessage = {
      type: 'cursor',
      cursor: {
        position,
        selection_start: selectionStart,
        selection_end: selectionEnd
      }
    };

    this.send(message);
  }

  sendPresenceUpdate(data: Partial<PresenceData>): void {
    if (!this.isConnected()) {
      return;
    }

    const message: WSMessage = {
      type: 'presence',
      presence: data
    };

    this.send(message);
  }

  private send(message: WSMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(message));
      } catch (error) {
        this.onErrorHandler?.('Failed to send message');
      }
    }
  }

  private handleOpen(): void {
    this.reconnectAttempts = 0;
    this.reconnectDelay = 1000;
    this.updateConnectionStatus('connected');
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const message: WSMessage = JSON.parse(event.data);
      
      switch (message.type) {
        case 'operation':
          if (message.operation && this.onOperationHandler) {
            this.onOperationHandler(message.operation);
          }
          break;
          
        case 'cursor':
          if (message.cursor && this.onPresenceHandler) {
            this.onPresenceHandler(message.cursor);
          }
          break;
          
        case 'presence':
          if (message.presence && this.onPresenceHandler) {
            this.onPresenceHandler(message.presence);
          } else if (message.event && message.data) {
            // Handle presence events (user_joined, user_left)
          }
          break;
          
        case 'initial_state':
          if (this.onInitialStateHandler) {
            this.onInitialStateHandler({
              document_id: message.document_id,
              crdt_state: message.crdt_state,
              text: message.text
            });
          }
          break;
          
        case 'error':
          this.onErrorHandler?.(message.message);
          break;
          
        default:
      }
    } catch (error) {
      this.onErrorHandler?.('Failed to parse message');
    }
  }

  private handleClose(): void {
    this.ws = null;
    
    if (!this.isManuallyDisconnected) {
      this.updateConnectionStatus('reconnecting');
      this.scheduleReconnect();
    } else {
      this.updateConnectionStatus('disconnected');
    }
  }

  private handleError(): void {
    
    this.updateConnectionStatus('error');
    this.onErrorHandler?.('WebSocket connection error');
  }

  private scheduleReconnect(): void {
    if (this.isManuallyDisconnected || this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.updateConnectionStatus('disconnected');
      return;
    }

    this.clearReconnectTimer();
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      
      this.connect();
      
      // Exponential backoff with jitter
      this.reconnectDelay = Math.min(
        this.reconnectDelay * 2 + Math.random() * 1000,
        this.maxReconnectDelay
      );
    }, this.reconnectDelay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private updateConnectionStatus(status: ConnectionStatus['status']): void {
    const connectionStatus: ConnectionStatus = {
      status,
      reconnectAttempts: this.reconnectAttempts,
      lastConnected: status === 'connected' ? new Date() : undefined
    };
    
    this.onConnectionStatusHandler?.(connectionStatus);
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  getConnectionStatus(): ConnectionStatus['status'] {
    if (!this.ws) return 'disconnected';
    
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'connecting';
      case WebSocket.OPEN:
        return 'connected';
      case WebSocket.CLOSING:
      case WebSocket.CLOSED:
        return this.reconnectTimer ? 'reconnecting' : 'disconnected';
      default:
        return 'error';
    }
  }

  // Event handler setters
  onOperation(handler: (operation: CRDTOperation) => void): void {
    this.onOperationHandler = handler;
  }

  onPresence(handler: (presence: PresenceData) => void): void {
    this.onPresenceHandler = handler;
  }

  onConnectionStatus(handler: (status: ConnectionStatus) => void): void {
    this.onConnectionStatusHandler = handler;
  }

  onInitialState(handler: (state: any) => void): void {
    this.onInitialStateHandler = handler;
  }

  onError(handler: (error: string) => void): void {
    this.onErrorHandler = handler;
  }

  // Cleanup
  destroy(): void {
    this.disconnect();
    this.clearReconnectTimer();
    
    // Clear all handlers
    this.onOperationHandler = undefined;
    this.onPresenceHandler = undefined;
    this.onConnectionStatusHandler = undefined;
    this.onInitialStateHandler = undefined;
    this.onErrorHandler = undefined;
  }
}