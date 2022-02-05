import { createServer, IncomingMessage, ServerResponse } from "http";
import { PingStat, PingService } from "./ping";

const pingService = new PingService();

enum HttpStatusCode {
  BAD_REQUEST = 400,
  SERVER_ERROR = 500,
  OK = 200,
}

const readPostData = async (
  req: IncomingMessage
): Promise<[string, boolean]> => {
  return new Promise((resolve, error) => {
    const buffers: Buffer[] = [];
    req.on("data", (data) => {
      buffers.push(data);
    });
    req.on("end", () => {
      resolve([Buffer.concat(buffers).toString("utf-8"), req.complete]);
    });
  });
};

const sendResponse = (
  res: ServerResponse,
  code: HttpStatusCode,
  data: string
) => {
  res.writeHead(code);
  res.end(data);
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
    if (!ok || !data) {
      return sendResponse(res, HttpStatusCode.BAD_REQUEST, "ERROR");
    }
    const clientId = "" + (req.headers["x-client-id"] || "");
    await handleData(JSON.parse(data) as PingStat, clientId);
    const rand = Math.random() * 100;
    if (rand > 60) {
      if (rand > 80) {
        console.log("500");
        return sendResponse(res, HttpStatusCode.SERVER_ERROR, "ERROR");
      } else {
        console.log("no answer");
        return;
      }
    }
    console.log("send ok");
    return sendResponse(res, HttpStatusCode.OK, "OK");
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
