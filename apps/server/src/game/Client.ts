export interface ClientInfo {
  id: string;
  entityId: string;
  lastPing: number;
  connectedAt: number;
  lastInputSeq: number;
}

// Clients send inputs at up to 30/s; the cap sits above that so legitimate
// traffic is never dropped and only genuine floods are rejected.
const MAX_INPUTS_PER_SECOND = 40;
const INPUT_WINDOW_MS = 1000;

export class ClientTracker {
  private readonly clients = new Map<string, ClientInfo>();
  private readonly inputTimestamps = new Map<string, number[]>();

  addClient(id: string, entityId: string): ClientInfo {
    const info: ClientInfo = {
      id,
      entityId,
      lastPing: Date.now(),
      connectedAt: Date.now(),
      lastInputSeq: 0,
    };
    this.clients.set(id, info);
    this.inputTimestamps.set(id, []);
    return info;
  }

  removeClient(id: string): void {
    this.clients.delete(id);
    this.inputTimestamps.delete(id);
  }

  getClient(id: string): ClientInfo | undefined {
    return this.clients.get(id);
  }

  getAllClients(): ClientInfo[] {
    return Array.from(this.clients.values());
  }

  canAcceptInput(clientId: string): boolean {
    const timestamps = this.inputTimestamps.get(clientId) ?? [];
    const now = Date.now();
    const recent = timestamps.filter((t) => now - t < INPUT_WINDOW_MS);

    if (recent.length >= MAX_INPUTS_PER_SECOND) {
      return false;
    }

    recent.push(now);
    this.inputTimestamps.set(clientId, recent);
    return true;
  }

  updatePing(clientId: string, ping: number): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.lastPing = ping;
    }
  }

  updateLastInputSeq(clientId: string, seq: number): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.lastInputSeq = seq;
    }
  }
}
