import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

// RAGE:MP root directory is ragemp-srv/, so .env is at ../.env
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') }); // It will be in ragemp-srv/packages/santosrp/db.js so ../../../../ is maybe not reliable?
import fs from 'fs';
if (fs.existsSync(path.resolve(process.cwd(), '../.env'))) {
    dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
} else {
    dotenv.config(); // fallback
}

const connectionString = process.env.DATABASE_URL;

export const pool = new Pool({
  connectionString,
  max: 32,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (err) => {
  console.error('[DB] Beklenmedik pool hatası:', err);
});

export async function disconnectDB(): Promise<void> {
  try {
    await pool.end();
    console.log('[DB] Bağlantılar kapatıldı.');
  } catch (err) {
    console.error('[DB] Bağlantı kapatma hatası:', err);
  }
}

// Kolay sorgu fonksiyonu
export async function query(text: string, params?: any[]) {
  const client = await pool.connect();
  try {
    const res = await client.query(text, params);
    return res;
  } finally {
    client.release();
  }
}
