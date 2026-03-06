/**
 * SantosRP - bcrypt Worker Thread
 * Ana RAGE:MP thread'ini bloklamadan bcrypt işlemlerini yapar
 */
import { parentPort } from 'worker_threads';
import * as bcrypt from 'bcryptjs';

if (!parentPort) {
  throw new Error('Bu dosya Worker Thread olarak çalıştırılmalıdır.');
}

parentPort.on('message', async (msg: {
  id: number;
  type: 'hash' | 'compare';
  data: string;
  hash?: string;
}) => {
  try {
    if (msg.type === 'hash') {
      const result = await bcrypt.hash(msg.data, 10);
      parentPort!.postMessage({ id: msg.id, result });
    } else if (msg.type === 'compare') {
      const result = await bcrypt.compare(msg.data, msg.hash!);
      parentPort!.postMessage({ id: msg.id, result });
    }
  } catch (err: any) {
    parentPort!.postMessage({ id: msg.id, error: err.message });
  }
});
