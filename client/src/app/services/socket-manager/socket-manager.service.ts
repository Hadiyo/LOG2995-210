import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';


@Injectable({
  providedIn: 'root',
})
export class SocketManagerService {
  private socket: Socket;
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
    this.socket.on(event, action);
  }

  /**
   * Generic socket method to unsubscribe a client from listening to an event
   * @param event 
   * @param action 
   */
  off<T>(event: string, action: (data: T) => void): void {
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
    this.socket.emit(event, ...([data, callback].filter(x => x)));
  }

  /**
 * Connects the client to the server environment through websockets (one per client)
 * @returns null
 */
  connect(): void {
    if (this.socket?.connected) return;
    this.socket = io('http://localhost:3000/', {
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


}
