export interface PingStat {
  pingId: number;
  deliveryAttempt: number;
  date: number;
  responseTime: number;
}

export class PingService {
  private pings: number[] = [];
  private lastPingId = new Map<string, number>();

  add(ping: PingStat, clientId: string): boolean {
    const lastPingId = this.lastPingId.get(clientId) || -1;
    if (ping.pingId <= lastPingId) {
      return false;
    }
    this.lastPingId.set(clientId, ping.pingId);
    this.pings.push(ping.responseTime);
    return true;
  }

  getStats(): [number, number] {
    let avg;
    let med;
    if (!this.pings.length) {
      return [0, 0];
    }
    const pings = this.pings.concat();
    pings.sort((a, b) => a - b);
    const len = this.pings.length;
    med = pings[Math.floor(len / 2) - (len % 2 ? 0 : 1)];
    avg = pings.reduce((sum, a) => sum + a, 0) / this.pings.length;
    return [avg, med];
  }
}
