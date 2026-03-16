import { writable } from 'svelte/store';

// Oyuncu genel bilgileri
export const charName = writable<string>('');
export const playerId = writable<number>(0);
export const playerMoney = writable<number>(0);

// Sağlık ve Zırh
export const health = writable<number>(100);
export const armor = writable<number>(0);

// Arayüz görünürlükleri
export const activeScreen = writable<string>('login'); // 'login', 'characterSelect', 'characterCreator', 'playing', vb.

// Araç verileri
export const inVehicle = writable<boolean>(false);
export const vehicleSpeed = writable<number>(0);
export const vehicleFuel = writable<number>(0);
export const vehicleMaxFuel = writable<number>(100);

// Lokasyon verileri
export const locationName = writable<string>('Bilinmiyor');
export const directionName = writable<string>('N');

// Teklifler / Aksiyonlar
export const activeOffers = writable<any[]>([]);

// Chat / Bildirimler vb eklenebilir.

// Admin/System
export const adminLevel = writable<number>(0);
export const commandListStore = writable<any[]>([]);
