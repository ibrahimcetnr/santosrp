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
export const minimapBottom = writable<number>(184);
export const minimapLeft = writable<number>(24);
export const minimapWidth = writable<number>(300);

// Teklifler / Aksiyonlar
export const activeOffers = writable<any[]>([]);

// Araç durum detayları
export const vehicleEngineOn = writable<boolean>(true);
export const vehicleLocked = writable<boolean>(false);
export const vehicleSeatbelt = writable<boolean>(true);
export const vehicleLightsOn = writable<boolean>(false);
export const vehicleParkingBrakeOn = writable<boolean>(false);

// Envanter
export const isInventoryOpen = writable<boolean>(false);
export const inventoryPayload = writable<any | null>(null);
export const inventoryNearbyPlayers = writable<Array<{ id: number; name: string }>>([]);

// Chat / Bildirimler vb eklenebilir.

// Admin/System
export const adminLevel = writable<number>(0);
export const commandListStore = writable<any[]>([]);
