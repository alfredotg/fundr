"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const https_1 = require("https");
const http_1 = require("http");
const REQUEST_TIMEOUT = 10 * 1000;
const TIMEOUT_CODE = -1;
const stats = {
    total: 0,
    success: 0,
    e500: 0,
    eTIMEOUT: 0
};
const sleep = (timeout) => __awaiter(void 0, void 0, void 0, function* () {
    return new Promise(resolve => setTimeout(resolve, timeout));
});
const getTime = () => (new Date()).getTime();
function readAll(req) {
    return new Promise((resolve, error) => {
        req.on('response', res => {
            const buffers = [];
            res.on('close', () => {
                resolve([res.statusCode, Buffer.concat(buffers).toString('utf-8')]);
            });
            res.on('data', (data) => {
                buffers.push(data);
            });
        });
        req.on('socket', s => s.setTimeout(REQUEST_TIMEOUT, () => {
            resolve([TIMEOUT_CODE, '']);
            s.destroy();
        }));
        req.on('error', e => error(e));
        req.end();
    });
}
const ping = () => __awaiter(void 0, void 0, void 0, function* () {
    const start = getTime();
    const req = (0, https_1.request)({
        hostname: 'fundraiseup.com',
        port: 443,
        path: '/',
        method: 'GET',
        timeout: REQUEST_TIMEOUT
    });
    const [statusCode] = yield readAll(req);
    const time = getTime() - start;
    if (!statusCode || statusCode < 200 || statusCode > 299) {
        throw new Error(`Wrong statusCode: ${statusCode}`);
    }
    return time;
});
const sendData = (pingId, responseTime, deliveryAttempt) => __awaiter(void 0, void 0, void 0, function* () {
    stats.total += 1;
    const message = JSON.stringify({
        pingId,
        deliveryAttempt,
        date: getTime(),
        responseTime
    });
    const options = {
        hostname: 'localhost',
        port: 8080,
        path: '/data',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(message)
        }
    };
    console.log(`sendData: ${message}`);
    const req = (0, http_1.request)(options);
    req.write(message);
    const [statusCode, responseBody] = yield readAll(req);
    console.log(`response: ${statusCode} ${responseBody}`);
    if (statusCode === 200) {
        stats.success += 1;
        return;
    }
    else if (statusCode == TIMEOUT_CODE) {
        stats.eTIMEOUT += 1;
    }
    else if (statusCode && statusCode >= 500 && statusCode <= 599) {
        stats.e500 += 1;
    }
    throw new Error(`statusCode: ${statusCode}`);
});
const trySendData = (pingId, time) => __awaiter(void 0, void 0, void 0, function* () {
    for (let deliveryAttempt = 1; true; deliveryAttempt++) {
        try {
            yield sendData(pingId, time, deliveryAttempt);
            break;
        }
        catch (e) {
            const sleepTime = Math.min(Math.random() * (deliveryAttempt * 100), 60000);
            console.log(`request failed, sleep ${sleepTime}ms`);
            yield sleep(sleepTime);
        }
    }
});
const cron = (pingId) => __awaiter(void 0, void 0, void 0, function* () {
    let time = -1;
    try {
        console.log(`ping ${pingId} fundraiseup.com`);
        time = yield ping();
        console.log(`fundraiseup.com response time: ${time}ms`);
    }
    catch (e) {
        console.error(`fundraiseup.com error: ${e}`);
        return;
    }
    yield trySendData(pingId, time);
});
(() => __awaiter(void 0, void 0, void 0, function* () {
    let pingId = 0;
    while (true) {
        pingId++;
        yield cron(pingId);
        yield sleep(1000);
        console.log("\n");
    }
}))();
process.on('SIGINT', () => {
    console.log("\n\m\n================ Stats ================ ");
    console.log(`\ntotal: ${stats.total}\nsuccess: ${stats.success}\ne500: ${stats.e500}\ntimeout: ${stats.eTIMEOUT}`);
    process.exit(0);
});
