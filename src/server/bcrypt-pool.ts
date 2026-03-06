/**
 * SantosRP - bcrypt Worker Pool
 * CPU çekirdeklerine paralel bcrypt işlemleri dağıtır.
 * Ana RAGE:MP thread'i hiç bloke olmaz.
 * worker_threads desteklenmiyorsa bcryptjs fallback kullanır.
 */
import * as path from 'path';
import * as os from 'os';

// worker_threads var mı kontrol et
let WorkerClass: typeof import('worker_threads').Worker | null = null;
try {
  WorkerClass = require('worker_threads').Worker;
} catch {
  WorkerClass = null;
}

// worker_threads yoksa bcryptjs ile fallback
import * as bcryptFallback from 'bcryptjs';

interface PendingJob {
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
}

interface WorkerEntry {
  worker: any;
  busy: boolean;
}

// Minimum 4 worker; ortam değişkeni ile override edilebilir.
// RAGE:MP + 32 GB sunucu: 4-8 arası idealdir.
const WORKER_COUNT =
  parseInt(process.env.BCRYPT_WORKERS || '', 10) ||
  Math.max(4, Math.min(os.cpus().length - 1, 8));
const workers: WorkerEntry[] = [];
const pending = new Map<number, PendingJob>();
let jobCounter = 0;
let usingFallback = false;

function createWorker(): WorkerEntry {
  const workerPath = path.join(__dirname, 'bcrypt.worker.js');
  const worker = new WorkerClass!(workerPath);
  const entry: WorkerEntry = { worker, busy: false };

  worker.on('message', (msg: { id: number; result?: any; error?: string }) => {
    entry.busy = false;
    const job = pending.get(msg.id);
    if (!job) return;
    pending.delete(msg.id);
    msg.error ? job.reject(new Error(msg.error)) : job.resolve(msg.result);
  });

  worker.on('error', (err: Error) => {
    console.error('[BCRYPT-POOL] Worker hatası:', err);
    entry.busy = false;
    const idx = workers.indexOf(entry);
    if (idx !== -1) workers[idx] = createWorker();
  });

  return entry;
}

function getFreeWorker(): WorkerEntry | null {
  return workers.find(w => !w.busy) ?? null;
}

const DISPATCH_TIMEOUT_MS = 5_000; // 5 saniye: bcrypt(10 rounds) ~100ms'de biter, 15s fazla

function dispatch(msg: object): Promise<any> {
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
      resolve: (v: any) => { clearTimeout(timer); resolve(v); },
      reject:  (e: any) => { clearTimeout(timer); reject(e); },
    });

    const worker = getFreeWorker();
    const target = worker ?? workers[id % workers.length];
    if (worker) target.busy = true;
    target.worker.postMessage(fullMsg);
  });
}

export function initBcryptPool(): void {
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
  } catch (err) {
    usingFallback = true;
    console.log('[BCRYPT-POOL] Worker başlatılamadı, fallback kullanılıyor:', err);
  }
}

export function bcryptHash(data: string): Promise<string> {
  if (usingFallback || workers.length === 0) {
    return bcryptFallback.hash(data, 10);
  }
  return dispatch({ type: 'hash', data });
}

export function bcryptCompare(data: string, hash: string): Promise<boolean> {
  if (usingFallback || workers.length === 0) {
    return bcryptFallback.compare(data, hash);
  }
  return dispatch({ type: 'compare', data, hash });
}

export function destroyBcryptPool(): void {
  for (const entry of workers) {
    entry.worker.terminate();
  }
  workers.length = 0;
}

