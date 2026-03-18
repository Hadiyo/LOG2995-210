import { Injectable } from '@angular/core';
import { BEFORE_UNLOAD } from '@common/socket-events';
import { io, Socket } from 'socket.io-client';
import { environment } from 'src/environments/environment';


@Injectable({
  providedIn: 'root',
})
export class SocketManagerService {
  private socket: Socket;
  private readonly baseUrl = environment.serverUrl;
  private readonly listeners = new Map<string, Set<(...args: unknown[]) => void>>();
  private beforeUnloadSubscribed = false;

  /**
   * Verifies if client is connected to a socket
   * @returns boolean
   */
  isSocketAlive(): boolean {
    return this.socket && this.socket.connected;
  }

  /**
   * Generic socket method to allow a client to listen to a socket event
   * @param event 
   * @param action 
   */
  on<T>(event: string, action: (data: T) => void): void {
    if (!this.socket) {
      this.connect();
    }

    const listeners = this.listeners.get(event) ?? new Set<(...args: unknown[]) => void>();
    if (listeners.has(action as (...args: unknown[]) => void)) {
      return;
    }

    listeners.add(action as (...args: unknown[]) => void);
    this.listeners.set(event, listeners);
    this.socket.on(event, action);
  }

  /**
   * Generic socket method to unsubscribe a client from listening to an event
   * @param event 
   * @param action 
   */
  off<T>(event: string, action: (data: T) => void): void {
    this.listeners.get(event)?.delete(action as (...args: unknown[]) => void);
    this.socket.off(event, action);
  }

  /**
   * Generic socket method to send event information to the server
   * (the server decides which user from that room is updated)
   * @param event 
   * @param data 
   * @param callback 
   */
  // To prevent socket emission repetitive methods
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  send<T>(event: string, data?: T, callback?: Function): void {
    this.socket.emit(event, ...([data, callback].filter(x => x != null)));
  }

  /**
 * Connects the client to the server environment through websockets (one per client)
 * @returns null
 */
  connect(): void {
    if (this.socket) {
      if (this.socket.connected) return;
      this.socket.connect();
      return;
    }

    this.socket = io(this.baseUrl, {
      transports: ['websocket'],
      upgrade: false, // Disables HTTP long-polling and 
    });
  }

  /**
   * Disconnects the client from the server environment
   */
  disconnect(): void {
    if (this.socket)
      this.socket.disconnect();
  }

  subscribeToWindowEvent(): void {
    if (this.beforeUnloadSubscribed) {
      return;
    }

    this.beforeUnloadSubscribed = true;
    // Adds event listener to disconnects the client socket when the application is closed
    window.addEventListener(BEFORE_UNLOAD, () => {
      this.socket?.disconnect();
    });
  }


}
