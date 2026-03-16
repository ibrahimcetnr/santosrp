import { ItemDef } from '../shared/types';
import { broadcastFadingMessage } from './cmdHandler';

export interface ItemUseResult {
    success: boolean;
    consume: boolean;
}

type ItemUseHandler = (player: PlayerMp) => ItemUseResult | Promise<ItemUseResult>;

export const ITEM_REGISTRY: Record<string, ItemDef> = {
    'identity': { id: 'identity', name: 'Kimlik', type: 'document', icon: 'id-card', weight: 0.1, usable: false },
    'water': { id: 'water', name: 'Su Şişesi', type: 'consumable', icon: 'water', weight: 0.5, usable: true },
    'bread': { id: 'bread', name: 'Ekmek', type: 'consumable', icon: 'burger', weight: 0.2, usable: true },
    'phone': { id: 'phone', name: 'Cep Telefonu', type: 'item', icon: 'phone', weight: 0.3, usable: true },
    'keys': { id: 'keys', name: 'Anahtar', type: 'item', icon: 'default', weight: 0.1, usable: false },
};

export function getItemDef(id: string): ItemDef | null {
    return ITEM_REGISTRY[id] || null;
}

const ITEM_USE_HANDLERS: Record<string, ItemUseHandler> = {
    water: (player) => {
        const charName = player.characterName || player.accountUsername || player.name;
        broadcastFadingMessage(player, 15.0, '#c2a2da', '#4a3060', (color) => {
            return `${color}* ${charName} su içer.`;
        });
        return { success: true, consume: true };
    },
    bread: (player) => {
        const charName = player.characterName || player.accountUsername || player.name;
        broadcastFadingMessage(player, 15.0, '#c2a2da', '#4a3060', (color) => {
            return `${color}* ${charName} ekmek yer.`;
        });
        return { success: true, consume: true };
    },
    phone: (player) => {
        player.outputChatBox('!{#60a5fa}[TELEFON] Telefonu kontrol ettiniz.');
        return { success: true, consume: false };
    },
    identity: (player) => {
        const charName = player.characterName || player.accountUsername || player.name;
        player.outputChatBox(`!{#93c5fd}[KİMLİK] ${charName}`);
        return { success: true, consume: false };
    },
    keys: (player) => {
        player.outputChatBox('!{#fbbf24}[ANAHTAR] Uygun bir kilit/araç olmadan kullanılamaz.');
        return { success: false, consume: false };
    }
};

export async function useItemById(player: PlayerMp, itemId: string): Promise<ItemUseResult> {
    const handler = ITEM_USE_HANDLERS[itemId];
    if (!handler) {
        player.outputChatBox('!{#ef4444}[ENVANTER] Bu eşyanın kullanım fonksiyonu tanımlı değil.');
        return { success: false, consume: false };
    }

    return await handler(player);
}
