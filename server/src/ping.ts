export interface PingStat {
  id: number;
  deliveryAttempt: number;
  date: number;
  responseTime: number;
}

export class PingService {
  private lastPingDate: number = -1;
  private pings: number[] = [];

  add(ping: PingStat) {
    /*
        if(ping.date < this.lastPingDate) {
            return
        }
        */
    this.pings.push(ping.responseTime);
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
