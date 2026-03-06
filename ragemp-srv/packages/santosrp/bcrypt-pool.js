"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.initBcryptPool = initBcryptPool;
exports.bcryptHash = bcryptHash;
exports.bcryptCompare = bcryptCompare;
exports.destroyBcryptPool = destroyBcryptPool;
/**
 * SantosRP - bcrypt Worker Pool
 * CPU çekirdeklerine paralel bcrypt işlemleri dağıtır.
 * Ana RAGE:MP thread'i hiç bloke olmaz.
 * worker_threads desteklenmiyorsa bcryptjs fallback kullanır.
 */
const path = __importStar(require("path"));
const os = __importStar(require("os"));
// worker_threads var mı kontrol et
let WorkerClass = null;
try {
    WorkerClass = require('worker_threads').Worker;
}
catch {
    WorkerClass = null;
}
// worker_threads yoksa bcryptjs ile fallback
const bcryptFallback = __importStar(require("bcryptjs"));
// Minimum 4 worker; ortam değişkeni ile override edilebilir.
// RAGE:MP + 32 GB sunucu: 4-8 arası idealdir.
const WORKER_COUNT = parseInt(process.env.BCRYPT_WORKERS || '', 10) ||
    Math.max(4, Math.min(os.cpus().length - 1, 8));
const workers = [];
const pending = new Map();
let jobCounter = 0;
let usingFallback = false;
function createWorker() {
    const workerPath = path.join(__dirname, 'bcrypt.worker.js');
    const worker = new WorkerClass(workerPath);
    const entry = { worker, busy: false };
    worker.on('message', (msg) => {
        entry.busy = false;
        const job = pending.get(msg.id);
        if (!job)
            return;
        pending.delete(msg.id);
        msg.error ? job.reject(new Error(msg.error)) : job.resolve(msg.result);
    });
    worker.on('error', (err) => {
        console.error('[BCRYPT-POOL] Worker hatası:', err);
        entry.busy = false;
        const idx = workers.indexOf(entry);
        if (idx !== -1)
            workers[idx] = createWorker();
    });
    return entry;
}
function getFreeWorker() {
    return workers.find(w => !w.busy) ?? null;
}
const DISPATCH_TIMEOUT_MS = 5_000; // 5 saniye: bcrypt(10 rounds) ~100ms'de biter, 15s fazla
function dispatch(msg) {
    const id = ++jobCounter;
    const fullMsg = { ...msg, id };
    return new Promise((resolve, reject) => {
        // Timeout: worker crash/donma durumunda promise sonsuza asılı kalmaz
        const timer = setTimeout(() => {
            if (pending.has(id)) {
                pending.delete(id);
                reject(new Error(`[BCRYPT-POOL] Job #${id} zaman aşımına uğradı (${DISPATCH_TIMEOUT_MS}ms)`));
            }
        }, DISPATCH_TIMEOUT_MS);
        pending.set(id, {
            resolve: (v) => { clearTimeout(timer); resolve(v); },
            reject: (e) => { clearTimeout(timer); reject(e); },
        });
        const worker = getFreeWorker();
        const target = worker ?? workers[id % workers.length];
        if (worker)
            target.busy = true;
        target.worker.postMessage(fullMsg);
    });
}
function initBcryptPool() {
    if (!WorkerClass) {
        usingFallback = true;
        console.log('[BCRYPT-POOL] worker_threads desteklenmiyor, bcryptjs fallback kullanılıyor.');
        return;
    }
    try {
        for (let i = 0; i < WORKER_COUNT; i++) {
            workers.push(createWorker());
        }
        console.log(`[BCRYPT-POOL] ${WORKER_COUNT} worker thread başlatıldı.`);
    }
    catch (err) {
        usingFallback = true;
        console.log('[BCRYPT-POOL] Worker başlatılamadı, fallback kullanılıyor:', err);
    }
}
function bcryptHash(data) {
    if (usingFallback || workers.length === 0) {
        return bcryptFallback.hash(data, 10);
    }
    return dispatch({ type: 'hash', data });
}
function bcryptCompare(data, hash) {
    if (usingFallback || workers.length === 0) {
        return bcryptFallback.compare(data, hash);
    }
    return dispatch({ type: 'compare', data, hash });
}
function destroyBcryptPool() {
    for (const entry of workers) {
        entry.worker.terminate();
    }
    workers.length = 0;
}
//# sourceMappingURL=bcrypt-pool.js.map