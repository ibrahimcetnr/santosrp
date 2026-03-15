// import * as mp from 'rage-rpc'; // RAGE ortamında genelde doğrudan mp objesi kullanılır.
import { query } from './db';
import { ITEM_REGISTRY, getItemDef } from './items';
import { InventorySlot, ItemDef } from '../shared/types';
import { safeEvent, isPlayerValid } from './utils/safeEvent';

export enum ContainerType {
    PLAYER = 1,
    VEHICLE = 2,
    PROPERTY = 3,
    DROPPED = 4
}

// Memory cache of loaded inventories
export const inventories = new Map<string, InventorySlot[]>(); // "{type}_{id}" -> slots

export function getContainerKey(type: ContainerType, id: number) {
    return `${type}_${id}`;
}

export async function loadInventory(type: ContainerType, containerId: number): Promise<InventorySlot[]> {
    const key = getContainerKey(type, containerId);
    if (inventories.has(key)) return inventories.get(key)!;

    const res = await query(
        'SELECT id, slot, item_id as "itemId", amount, metadata FROM inventory_items WHERE parent_type = $1 AND parent_id = $2',
        [type, containerId]
    );
    
    const slots = res.rows as InventorySlot[];
    inventories.set(key, slots);
    return slots;
}

export async function saveSlot(type: ContainerType, containerId: number, slot: typeof inventories extends Map<string, (infer S)[]> ? S : never) {
    if (slot.amount <= 0) {
        if (slot.id) {
            await query('DELETE FROM inventory_items WHERE id = $1', [slot.id]);
        }
        return;
    }

    if (slot.id) {
        await query(
            'UPDATE inventory_items SET item_id = $1, amount = $2, metadata = $3 WHERE id = $4',
            [slot.itemId, slot.amount, slot.metadata || {}, slot.id]
        );
    } else {
        const res = await query(
            'INSERT INTO inventory_items (parent_type, parent_id, slot, item_id, amount, metadata) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
            [type, containerId, slot.slot, slot.itemId, slot.amount, slot.metadata || {}]
        );
        slot.id = res.rows[0].id;
    }
}

export function calcWeight(slots: InventorySlot[]): number {
    return slots.reduce((acc, s) => acc + (getItemDef(s.itemId)?.weight || 0) * s.amount, 0);
}

// ... more methods to add/remove/move items to be added as needed

// RAGE events integration will follow


// Envanter Açma İsteğini Karşıla
safeEvent('client:inventory:requestOpen', async (player: PlayerMp) => {
    if (!isPlayerValid(player)) return;
    try {
        if (!player.characterId) return; // Kullanıcının karakteri yoksa dön

        // Örnek bir envanter yükleme
        const slots = await loadInventory(ContainerType.PLAYER, player.characterId as number);
        
        // Şimdilik weight'i 0, max'i 30 kabul edelim
        const weight = calcWeight(slots);

        const payload = {
            slots,
            maxWeight: 30, // Örnek olarak
            weight,
            items: ITEM_REGISTRY,
            charName: player.name
        };

        player.call('client:inventory:openUI', [JSON.stringify(payload)]);
    } catch (err) {
        console.error("Envanter açma hatası:", err);
    }
});
