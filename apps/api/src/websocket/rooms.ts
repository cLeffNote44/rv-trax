// ---------------------------------------------------------------------------
// RV Trax API — WebSocket room management
// ---------------------------------------------------------------------------

import type { WebSocket } from 'ws';
interface TrackedClient {
  clientId: string;
  ws: WebSocket;
  dealershipId: string;
  userId: string;
  connectedAt: Date;
}

export class RoomManager {
  /** clientId -> tracked client */
  private clients = new Map<string, TrackedClient>();
  /** dealershipId -> Set<clientId> */
  private rooms = new Map<string, Set<string>>();

  private nextId = 0;

  /**
   * Add a client to a dealership room.
   * Returns the assigned clientId.
   */
  addClient(dealershipId: string, ws: WebSocket, userId: string): string {
    const clientId = `ws_${Date.now()}_${++this.nextId}`;

    this.clients.set(clientId, {
      clientId,
      ws,
      dealershipId,
      userId,
      connectedAt: new Date(),
    });

    let room = this.rooms.get(dealershipId);
    if (!room) {
      room = new Set();
      this.rooms.set(dealershipId, room);
    }
    room.add(clientId);

    return clientId;
  }

  /**
   * Remove a client by clientId.
   * Returns the dealershipId the client was in, or null if not found.
   */
  removeClient(clientId: string): string | null {
    const client = this.clients.get(clientId);
    if (!client) return null;

    const { dealershipId } = client;
    this.clients.delete(clientId);

    const room = this.rooms.get(dealershipId);
    if (room) {
      room.delete(clientId);
      if (room.size === 0) {
        this.rooms.delete(dealershipId);
      }
    }

    return dealershipId;
  }

  /**
   * Broadcast a message to all connected clients in a dealership room.
   */
  broadcast(dealershipId: string, message: object): void {
    const room = this.rooms.get(dealershipId);
    if (!room) return;

    const payload = JSON.stringify(message);

    for (const clientId of room) {
      const client = this.clients.get(clientId);
      if (client && client.ws.readyState === client.ws.OPEN) {
        client.ws.send(payload);
      }
    }
  }

  /**
   * Get the number of connected clients in a dealership room.
   */
  getClientCount(dealershipId: string): number {
    return this.rooms.get(dealershipId)?.size ?? 0;
  }

  /**
   * Get the total number of connected clients across all rooms.
   */
  getTotalConnections(): number {
    return this.clients.size;
  }

  /**
   * Get stats about all rooms.
   */
  getStats(): {
    totalConnections: number;
    roomCount: number;
    connectionsByRoom: Record<string, number>;
  } {
    const connectionsByRoom: Record<string, number> = {};
    for (const [dealershipId, room] of this.rooms) {
      connectionsByRoom[dealershipId] = room.size;
    }

    return {
      totalConnections: this.clients.size,
      roomCount: this.rooms.size,
      connectionsByRoom,
    };
  }

  /**
   * Get all dealership IDs that currently have connected clients.
   */
  getActiveDealerships(): string[] {
    return Array.from(this.rooms.keys());
  }

  /**
   * Get all connected client IDs across all rooms.
   */
  getAllClientIds(): string[] {
    return Array.from(this.clients.keys());
  }

  /**
   * Get a client's WebSocket by clientId (for closing dead connections).
   */
  getClientWs(clientId: string): WebSocket | null {
    return this.clients.get(clientId)?.ws ?? null;
  }
}
