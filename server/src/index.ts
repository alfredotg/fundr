import { createServer, IncomingMessage, ServerResponse } from "http";
import { PingStat, PingService } from "./ping";

const pingService = new PingService();

const readPostData = async (
  req: IncomingMessage
): Promise<[string, boolean]> => {
  return new Promise((resolve, error) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      resolve([body, req.complete]);
    });
  });
};

const handleData = async (ping: PingStat, clientId: string): Promise<void> => {
  if (!pingService.add(ping, clientId)) {
    console.log("ignore duplicate ping");
  }
};

const requestListener = async (req: IncomingMessage, res: ServerResponse) => {
  console.log(`${req.method} ${req.url}`);
  if (req.url === "/data" && req.method === "POST") {
    const [data, ok] = await readPostData(req);
    if (data) {
      const clientId = "" + (req.headers["x-client-id"] || "");
      await handleData(JSON.parse(data) as PingStat, clientId);
    }
    const rand = Math.random() * 100;
    if (rand > 60) {
      if (rand > 80) {
        res.writeHead(500);
        res.end("ERROR");
        console.log("500");
        return;
      } else {
        console.log("no answer");
        return;
      }
    }
    console.log("send ok");
    res.writeHead(200);
    res.end("OK");
    return;
  }
  res.writeHead(200);
  res.end("Hello, World!");
};

createServer(requestListener).listen(8080);

process.on("SIGINT", () => {
  const [avg, med] = pingService.getStats();
  console.log("\nm\n================ Stats ================ ");
  console.log(`average response time: ${avg}ms`);
  console.log(`median: ${med}ms`);
  process.exit(0);
});
