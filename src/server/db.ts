import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

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
  return await pool.query(text, params);
}
