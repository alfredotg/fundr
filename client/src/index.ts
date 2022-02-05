import { ClientRequest } from "http";
import { request as httpsRequest } from "https";
import { request as httpRequest } from "http";
import { randomBytes } from "crypto";

const REQUEST_TIMEOUT = 10 * 1000;
const TIMEOUT_CODE = -1;
const stats = {
  total: 0,
  success: 0,
  e500: 0,
  eTIMEOUT: 0,
};

const sleep = async (timeout: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, timeout));
};

const clientId = randomBytes(12).toString("hex");

const getTime = (): number => new Date().getTime();

function readAll(req: ClientRequest): Promise<[number | undefined, string]> {
  return new Promise((resolve, error) => {
    req.on("response", (res) => {
      const buffers: Buffer[] = [];
      res.on("close", () => {
        resolve([res.statusCode, Buffer.concat(buffers).toString("utf-8")]);
      });
      res.on("data", (data) => {
        buffers.push(data);
      });
    });
    req.on("socket", (s) =>
      s.setTimeout(REQUEST_TIMEOUT, () => {
        resolve([TIMEOUT_CODE, ""]);
        s.destroy();
      })
    );
    req.on("error", (e) => error(e));
    req.end();
  });
}

const ping = async (): Promise<number> => {
  const start = getTime();
  const req = httpsRequest({
    hostname: "fundraiseup.com",
    port: 443,
    path: "/",
    method: "GET",
    timeout: REQUEST_TIMEOUT,
  });
  const [statusCode] = await readAll(req);
  const time = getTime() - start;
  if (!statusCode || statusCode < 200 || statusCode > 299) {
    throw new Error(`Wrong statusCode: ${statusCode}`);
  }
  return time;
};

const sendData = async (
  pingId: number,
  responseTime: number,
  deliveryAttempt: number
): Promise<void> => {
  stats.total += 1;

  const message = JSON.stringify({
    pingId,
    deliveryAttempt,
    date: getTime(),
    responseTime,
  });
  const options = {
    hostname: "localhost",
    port: 8080,
    path: "/data",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(message),
      "X-Client-Id": clientId,
    },
  };
  console.log(`sendData: ${message}`);
  const req = httpRequest(options);
  req.write(message);
  const [statusCode, responseBody] = await readAll(req);
  console.log(`response: ${statusCode} ${responseBody}`);
  if (statusCode === 200) {
    stats.success += 1;
    return;
  } else if (statusCode === TIMEOUT_CODE) {
    stats.eTIMEOUT += 1;
  } else if (statusCode && statusCode >= 500 && statusCode <= 599) {
    stats.e500 += 1;
  }
  throw new Error(`statusCode: ${statusCode}`);
};

const trySendData = async (pingId: number, time: number): Promise<void> => {
  for (let deliveryAttempt = 1; true; deliveryAttempt++) {
    try {
      await sendData(pingId, time, deliveryAttempt);
      break;
    } catch (e) {
      const sleepTime = Math.min(
        Math.random() * (deliveryAttempt * 100),
        60000
      );
      console.log(`request failed, error: ${e}, sleep ${sleepTime}ms`);
      await sleep(sleepTime);
    }
  }
};

const cron = async (pingId: number): Promise<void> => {
  let time = -1;
  try {
    console.log(`ping ${pingId} fundraiseup.com`);
    time = await ping();
    console.log(`fundraiseup.com response time: ${time}ms`);
  } catch (e) {
    console.error(`fundraiseup.com error: ${e}`);
    return;
  }
  await trySendData(pingId, time);
};

(async () => {
  let pingId: number = 0;
  while (true) {
    pingId++;
    await cron(pingId);
    await sleep(1000);
    console.log("\n");
  }
})();

process.on("SIGINT", () => {
  console.log("\nm\n================ Stats ================ ");
  console.log(
    `\ntotal: ${stats.total}\nsuccess: ${stats.success}\ne500: ${stats.e500}\ntimeout: ${stats.eTIMEOUT}`
  );
  process.exit(0);
});
