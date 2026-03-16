// import * as mp from 'rage-rpc'; // RAGE ortamında genelde doğrudan mp objesi kullanılır.
import { query } from './db';
import { ITEM_REGISTRY, getItemDef, useItemById } from './items';
import { InventorySlot } from '../shared/types';
import { safeEvent, isPlayerValid } from './utils/safeEvent';
import '../shared/types';

export enum ContainerType {
    PLAYER = 1,
    VEHICLE_TRUNK = 2,
    VEHICLE_GLOVEBOX = 3,
    DROPPED = 4,
    PROPERTY = 5
}

// Memory cache of loaded inventories
export const inventories = new Map<string, InventorySlot[]>(); // "{type}_{id}" -> slots

interface OpenInventoryContext {
    otherType?: ContainerType;
    otherId?: number;
    otherName?: string;
    otherMaxWeight?: number;
}

const openInventoryContextByPlayer = new Map<number, OpenInventoryContext>();
const containerViewersByKey = new Map<string, Set<number>>();
const playerViewedContainerKey = new Map<number, string>();

function setPlayerViewedContainer(playerId: number, key?: string): void {
    const oldKey = playerViewedContainerKey.get(playerId);
    if (oldKey) {
        const oldSet = containerViewersByKey.get(oldKey);
        if (oldSet) {
            oldSet.delete(playerId);
            if (oldSet.size === 0) containerViewersByKey.delete(oldKey);
        }
        playerViewedContainerKey.delete(playerId);
    }

    if (!key) return;

    let viewers = containerViewersByKey.get(key);
    if (!viewers) {
        viewers = new Set<number>();
        containerViewersByKey.set(key, viewers);
    }

    viewers.add(playerId);
    playerViewedContainerKey.set(playerId, key);
}

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
            'UPDATE inventory_items SET slot = $1, item_id = $2, amount = $3, metadata = $4 WHERE id = $5',
            [slot.slot, slot.itemId, slot.amount, slot.metadata || {}, slot.id]
        );
    } else {
        const res = await query(
            'INSERT INTO inventory_items (parent_type, parent_id, slot, item_id, amount, metadata) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
            [type, containerId, slot.slot, slot.itemId, slot.amount, slot.metadata || {}]
        );
        slot.id = res.rows[0].id;
    }
}

async function swapSlotsAtomically(type: ContainerType, containerId: number, source: InventorySlot, target: InventorySlot): Promise<void> {
    if (!source.id || !target.id) {
        throw new Error('Swap için slot id bilgisi eksik.');
    }

    const tempSlot = -1;
    await query('BEGIN');
    try {
        await query(
            'UPDATE inventory_items SET slot = $1 WHERE id = $2 AND parent_type = $3 AND parent_id = $4',
            [tempSlot, source.id, type, containerId]
        );
        await query(
            'UPDATE inventory_items SET slot = $1 WHERE id = $2 AND parent_type = $3 AND parent_id = $4',
            [source.slot, target.id, type, containerId]
        );
        await query(
            'UPDATE inventory_items SET slot = $1 WHERE id = $2 AND parent_type = $3 AND parent_id = $4',
            [target.slot, source.id, type, containerId]
        );
        await query('COMMIT');
    } catch (error) {
        await query('ROLLBACK');
        throw error;
    }
}

export function calcWeight(slots: InventorySlot[]): number {
    return slots.reduce((acc, s) => acc + (getItemDef(s.itemId)?.weight || 0) * s.amount, 0);
}

export async function giveItemToContainer(
    type: ContainerType,
    containerId: number,
    itemId: string,
    amount: number,
    metadata: Record<string, unknown> = {}
): Promise<{ success: boolean; slot?: number; amountAdded?: number }> {
    if (!itemId || !Number.isInteger(amount) || amount <= 0) {
        return { success: false };
    }

    const itemDef = getItemDef(itemId);
    if (!itemDef) return { success: false };

    const metadataPayload = metadata || {};
    const isMetadataItem = Object.keys(metadataPayload).length > 0;
    const amountToGive = isMetadataItem ? 1 : amount;

    const slots = await loadInventory(type, containerId);
    const existing = isMetadataItem
        ? undefined
        : slots.find((slot) => slot.itemId === itemId && !hasMetadata(slot));

    if (existing) {
        existing.amount += amountToGive;
        await saveSlot(type, containerId, existing);
        return { success: true, slot: existing.slot, amountAdded: amountToGive };
    }

    const freeSlot = getFirstFreeSlot(slots);
    const created: InventorySlot = {
        slot: freeSlot,
        itemId,
        amount: amountToGive,
        metadata: metadataPayload
    };
    await saveSlot(type, containerId, created);
    slots.push(created);

    return { success: true, slot: freeSlot, amountAdded: amountToGive };
}

async function ensureMandatoryIdentityItem(containerId: number, slots: InventorySlot[]): Promise<void> {
    const hasIdentity = slots.some((slot) => slot.itemId === 'identity' && slot.amount > 0);
    if (hasIdentity) return;

    const usedSlots = new Set<number>(slots.map((slot) => slot.slot));
    let targetSlot = 0;
    while (usedSlots.has(targetSlot)) targetSlot += 1;

    const identitySlot: InventorySlot = {
        slot: targetSlot,
        itemId: 'identity',
        amount: 1,
        metadata: { mandatory: true }
    };

    await saveSlot(ContainerType.PLAYER, containerId, identitySlot);
    slots.push(identitySlot);
}

function toInt(value: unknown): number | null {
    const num = Number(value);
    if (!Number.isInteger(num)) return null;
    return num;
}

function parseContainerType(value: unknown): ContainerType | null {
    const parsed = toInt(value);
    if (parsed === null) return null;
    if (
        parsed !== ContainerType.PLAYER &&
        parsed !== ContainerType.VEHICLE_TRUNK &&
        parsed !== ContainerType.VEHICLE_GLOVEBOX &&
        parsed !== ContainerType.DROPPED &&
        parsed !== ContainerType.PROPERTY
    ) {
        return null;
    }
    return parsed as ContainerType;
}

function getSlotByIndex(slots: InventorySlot[], slotIndex: number): InventorySlot | undefined {
    return slots.find((slot) => slot.slot === slotIndex);
}

function removeSlotFromCache(slots: InventorySlot[], slot: InventorySlot): void {
    const idx = slots.indexOf(slot);
    if (idx !== -1) slots.splice(idx, 1);
}

function hasMetadata(slot: InventorySlot): boolean {
    const metadata = slot.metadata;
    if (metadata === null || metadata === undefined) return false;
    if (typeof metadata === 'object') return Object.keys(metadata).length > 0;
    return true;
}

function canStackSlots(source: InventorySlot, target: InventorySlot): boolean {
    return source.itemId === target.itemId && !hasMetadata(source) && !hasMetadata(target);
}

function getMoveAmount(source: InventorySlot, requestedAmount: unknown): number {
    if (hasMetadata(source)) return 1;
    return normalizeAmount(requestedAmount, source.amount);
}

function getFirstFreeSlot(slots: InventorySlot[]): number {
    const used = new Set(slots.map((slot) => slot.slot));
    let slot = 0;
    while (used.has(slot)) slot += 1;
    return slot;
}

function normalizeAmount(requestedAmount: unknown, maxAmount: number): number {
    const parsed = toInt(requestedAmount);
    if (!parsed || parsed <= 0) return 0;
    return Math.min(parsed, maxAmount);
}

function parseOtherContainerContext(otherTypeRaw?: unknown, otherIdRaw?: unknown): { type: ContainerType; id: number } | null {
    const otherType = parseContainerType(otherTypeRaw);
    const otherId = toInt(otherIdRaw);
    if (!otherType || otherId === null || otherId <= 0) return null;
    return { type: otherType, id: otherId };
}

function getOtherContainerName(type: ContainerType): string {
    if (type === ContainerType.VEHICLE_TRUNK) return 'Araç Bagajı';
    if (type === ContainerType.VEHICLE_GLOVEBOX) return 'Araç Torpidosu';
    if (type === ContainerType.PROPERTY) return 'Depo';
    if (type === ContainerType.DROPPED) return 'Yerdeki Eşya';
    return 'İkinci Envanter';
}

function resolveContainerPresentation(type: ContainerType, requestedMaxWeight?: number): { maxWeight: number; gridRows: number; gridCols: number } {
    if (type === ContainerType.VEHICLE_GLOVEBOX) {
        return { maxWeight: 20, gridRows: 2, gridCols: 5 };
    }

    if (type === ContainerType.VEHICLE_TRUNK) {
        const trunkWeight = Math.max(30, Math.min(120, Math.floor(requestedMaxWeight ?? 30)));
        const t = (trunkWeight - 30) / 90;
        const gridRows = Math.max(5, Math.min(8, Math.round(5 + (3 * t))));
        const gridCols = Math.max(6, Math.min(8, Math.round(6 + (2 * t))));
        return { maxWeight: trunkWeight, gridRows, gridCols };
    }

    return { maxWeight: requestedMaxWeight ?? 30, gridRows: 3, gridCols: 7 };
}

export async function openDualInventory(
    player: PlayerMp,
    otherType?: ContainerType,
    otherId?: number,
    otherName?: string,
    otherMaxWeight?: number
): Promise<void> {
    if (!isPlayerValid(player)) return;
    const characterId = player.characterId;
    if (!characterId) return;

    const playerSlots = await loadInventory(ContainerType.PLAYER, characterId);
    await ensureMandatoryIdentityItem(characterId, playerSlots);

    const payload: Record<string, unknown> = {
        slots: playerSlots,
        maxWeight: 30,
        weight: calcWeight(playerSlots),
        items: ITEM_REGISTRY,
        charName: (player as any).name || 'Oyuncu'
    };

    if (otherType !== undefined && otherId !== undefined && otherId > 0) {
        const otherSlots = await loadInventory(otherType, otherId);
        const presentation = resolveContainerPresentation(otherType, otherMaxWeight);
        payload.otherSlots = otherSlots;
        payload.otherName = otherName || getOtherContainerName(otherType);
        payload.otherType = otherType;
        payload.otherId = otherId;
        payload.otherMaxWeight = presentation.maxWeight;
        payload.otherGridRows = presentation.gridRows;
        payload.otherGridCols = presentation.gridCols;
        payload.otherWeight = calcWeight(otherSlots);

        openInventoryContextByPlayer.set((player as any).id, {
            otherType,
            otherId,
            otherName: payload.otherName as string,
            otherMaxWeight: payload.otherMaxWeight as number
        });
        setPlayerViewedContainer((player as any).id, getContainerKey(otherType, otherId));
    } else {
        openInventoryContextByPlayer.set((player as any).id, {});
        setPlayerViewedContainer((player as any).id);
    }

    (player as any).call('client:inventory:openUI', [JSON.stringify(payload)]);
}

export async function refreshOpenInventory(player: PlayerMp): Promise<void> {
    if (!isPlayerValid(player)) return;
    const context = openInventoryContextByPlayer.get((player as any).id);
    if (context && context.otherType !== undefined && context.otherId !== undefined) {
        await openDualInventory(player, context.otherType, context.otherId, context.otherName, context.otherMaxWeight);
        return;
    }
    await openDualInventory(player);
}

async function notifyContainerViewers(type: ContainerType, id: number, excludePlayerId?: number): Promise<void> {
    const key = getContainerKey(type, id);
    const viewers = containerViewersByKey.get(key);
    if (!viewers || viewers.size === 0) return;

    const viewerIds = Array.from(viewers.values());
    for (const viewerId of viewerIds) {
        if (excludePlayerId !== undefined && viewerId === excludePlayerId) continue;

        const viewer = ((globalThis as any).mp?.players?.at?.(viewerId)) as PlayerMp | undefined;
        if (!viewer || !isPlayerValid(viewer)) {
            setPlayerViewedContainer(viewerId);
            openInventoryContextByPlayer.delete(viewerId);
            continue;
        }

        await refreshOpenInventory(viewer);
    }
}

async function transferBetweenContainers(params: {
    fromType: ContainerType;
    fromId: number;
    fromSlots: InventorySlot[];
    fromSlot: number;
    toType: ContainerType;
    toId: number;
    toSlots: InventorySlot[];
    toSlot: number;
    amountRaw: unknown;
}): Promise<boolean> {
    const source = getSlotByIndex(params.fromSlots, params.fromSlot);
    if (!source) return false;

    const moveAmount = getMoveAmount(source, params.amountRaw);
    if (moveAmount <= 0) return false;

    let targetSlot = params.toSlot;
    if (targetSlot < 0) {
        const sameStack = params.toSlots.find((slot) => canStackSlots(source, slot));
        targetSlot = sameStack ? sameStack.slot : getFirstFreeSlot(params.toSlots);
    }

    const target = getSlotByIndex(params.toSlots, targetSlot);
    if (target && !canStackSlots(source, target)) {
        return false;
    }

    if (target) {
        target.amount += moveAmount;
        await saveSlot(params.toType, params.toId, target);
    } else {
        const created: InventorySlot = {
            slot: targetSlot,
            itemId: source.itemId,
            amount: moveAmount,
            metadata: source.metadata || {}
        };
        await saveSlot(params.toType, params.toId, created);
        params.toSlots.push(created);
    }

    source.amount -= moveAmount;
    if (source.amount <= 0) {
        await saveSlot(params.fromType, params.fromId, source);
        removeSlotFromCache(params.fromSlots, source);
    } else {
        await saveSlot(params.fromType, params.fromId, source);
    }

    return true;
}

safeEvent('client:inventory:requestOpen', async (player: PlayerMp, otherTypeRaw?: unknown, otherIdRaw?: unknown) => {
    if (!isPlayerValid(player)) return;
    if (!player.characterId) return;

    const otherContext = parseOtherContainerContext(otherTypeRaw, otherIdRaw);
    await openDualInventory(player, otherContext?.type, otherContext?.id);
});

safeEvent('server:inventory:close', async (player: PlayerMp) => {
    if (!isPlayerValid(player)) return;
    const playerId = (player as any).id as number;
    openInventoryContextByPlayer.delete(playerId);
    setPlayerViewedContainer(playerId);
    (player as any).call('server:inventory:close');
});

safeEvent('server:inventory:moveSlot', async (
    player: PlayerMp,
    fromSlotRaw: unknown,
    toSlotRaw: unknown,
    amountRaw: unknown,
    otherTypeRaw?: unknown,
    otherIdRaw?: unknown
) => {
    if (!isPlayerValid(player)) return;
    const characterId = player.characterId;
    if (!characterId) return;

    const fromSlot = toInt(fromSlotRaw);
    const toSlot = toInt(toSlotRaw);
    if (fromSlot === null || toSlot === null || fromSlot < 0 || toSlot < 0 || fromSlot === toSlot) return;

    const slots = await loadInventory(ContainerType.PLAYER, characterId);
    const source = getSlotByIndex(slots, fromSlot);
    if (!source) return;

    const moveAmount = getMoveAmount(source, amountRaw);
    if (moveAmount <= 0) return;

    const target = getSlotByIndex(slots, toSlot);
    if (target) {
        if (canStackSlots(source, target)) {
            target.amount += moveAmount;
            source.amount -= moveAmount;
            await saveSlot(ContainerType.PLAYER, characterId, target);
            if (source.amount <= 0) {
                await saveSlot(ContainerType.PLAYER, characterId, source);
                removeSlotFromCache(slots, source);
            } else {
                await saveSlot(ContainerType.PLAYER, characterId, source);
            }
        } else {
            if (moveAmount !== source.amount) return;
            const oldSourceSlot = source.slot;
            const oldTargetSlot = target.slot;
            await swapSlotsAtomically(ContainerType.PLAYER, characterId, source, target);
            source.slot = oldTargetSlot;
            target.slot = oldSourceSlot;
        }
    } else {
        if (moveAmount === source.amount) {
            source.slot = toSlot;
            await saveSlot(ContainerType.PLAYER, characterId, source);
        } else {
            source.amount -= moveAmount;
            await saveSlot(ContainerType.PLAYER, characterId, source);

            const splitSlot: InventorySlot = {
                slot: toSlot,
                itemId: source.itemId,
                amount: moveAmount,
                metadata: source.metadata || {}
            };
            await saveSlot(ContainerType.PLAYER, characterId, splitSlot);
            slots.push(splitSlot);
        }
    }

    const otherContext = parseOtherContainerContext(otherTypeRaw, otherIdRaw);
    if (otherContext) {
        openInventoryContextByPlayer.set((player as any).id, { otherType: otherContext.type, otherId: otherContext.id });
    }
    await refreshOpenInventory(player);
});

safeEvent('server:inventory:moveOtherSlot', async (
    player: PlayerMp,
    fromSlotRaw: unknown,
    toSlotRaw: unknown,
    amountRaw: unknown,
    otherTypeRaw: unknown,
    otherIdRaw: unknown
) => {
    if (!isPlayerValid(player)) return;

    const otherContext = parseOtherContainerContext(otherTypeRaw, otherIdRaw);
    if (!otherContext || otherContext.type === ContainerType.PLAYER) return;

    const fromSlot = toInt(fromSlotRaw);
    const toSlot = toInt(toSlotRaw);
    if (fromSlot === null || toSlot === null || fromSlot < 0 || toSlot < 0 || fromSlot === toSlot) return;

    const slots = await loadInventory(otherContext.type, otherContext.id);
    const source = getSlotByIndex(slots, fromSlot);
    if (!source) return;

    const moveAmount = getMoveAmount(source, amountRaw);
    if (moveAmount <= 0) return;

    const target = getSlotByIndex(slots, toSlot);
    if (target) {
        if (canStackSlots(source, target)) {
            target.amount += moveAmount;
            source.amount -= moveAmount;
            await saveSlot(otherContext.type, otherContext.id, target);
            if (source.amount <= 0) {
                await saveSlot(otherContext.type, otherContext.id, source);
                removeSlotFromCache(slots, source);
            } else {
                await saveSlot(otherContext.type, otherContext.id, source);
            }
        } else {
            if (moveAmount !== source.amount) return;
            const oldSourceSlot = source.slot;
            const oldTargetSlot = target.slot;
            await swapSlotsAtomically(otherContext.type, otherContext.id, source, target);
            source.slot = oldTargetSlot;
            target.slot = oldSourceSlot;
        }
    } else {
        if (moveAmount === source.amount) {
            source.slot = toSlot;
            await saveSlot(otherContext.type, otherContext.id, source);
        } else {
            source.amount -= moveAmount;
            await saveSlot(otherContext.type, otherContext.id, source);

            const splitSlot: InventorySlot = {
                slot: toSlot,
                itemId: source.itemId,
                amount: moveAmount,
                metadata: source.metadata || {}
            };
            await saveSlot(otherContext.type, otherContext.id, splitSlot);
            slots.push(splitSlot);
        }
    }

    openInventoryContextByPlayer.set((player as any).id, { otherType: otherContext.type, otherId: otherContext.id });
    await refreshOpenInventory(player);
    await notifyContainerViewers(otherContext.type, otherContext.id, (player as any).id as number);
});

safeEvent('server:inventory:splitSlot', async (
    player: PlayerMp,
    slotRaw: unknown,
    amountRaw: unknown,
    otherTypeRaw?: unknown,
    otherIdRaw?: unknown
) => {
    if (!isPlayerValid(player)) return;
    const characterId = player.characterId;
    if (!characterId) return;

    const slotIndex = toInt(slotRaw);
    if (slotIndex === null || slotIndex < 0) return;

    const slots = await loadInventory(ContainerType.PLAYER, characterId);
    const source = getSlotByIndex(slots, slotIndex);
    if (!source) return;
    if (hasMetadata(source) || source.amount <= 1) return;

    const splitAmount = normalizeAmount(amountRaw, source.amount - 1);
    if (splitAmount <= 0) return;

    const targetSlot = getFirstFreeSlot(slots);
    source.amount -= splitAmount;
    await saveSlot(ContainerType.PLAYER, characterId, source);

    const newSlot: InventorySlot = {
        slot: targetSlot,
        itemId: source.itemId,
        amount: splitAmount,
        metadata: source.metadata || {}
    };
    await saveSlot(ContainerType.PLAYER, characterId, newSlot);
    slots.push(newSlot);

    const otherContext = parseOtherContainerContext(otherTypeRaw, otherIdRaw);
    if (otherContext) {
        openInventoryContextByPlayer.set((player as any).id, { otherType: otherContext.type, otherId: otherContext.id });
    }
    await refreshOpenInventory(player);
});

safeEvent('server:inventory:takeFromOther', async (
    player: PlayerMp,
    fromSlotRaw: unknown,
    toSlotRaw: unknown,
    amountRaw: unknown,
    otherTypeRaw: unknown,
    otherIdRaw: unknown
) => {
    if (!isPlayerValid(player)) return;
    const characterId = player.characterId;
    if (!characterId) return;

    const fromSlot = toInt(fromSlotRaw);
    const toSlot = toInt(toSlotRaw);
    if (fromSlot === null || toSlot === null || fromSlot < 0) return;

    const otherContext = parseOtherContainerContext(otherTypeRaw, otherIdRaw);
    if (!otherContext || otherContext.type === ContainerType.PLAYER) return;

    const fromSlots = await loadInventory(otherContext.type, otherContext.id);
    const toSlots = await loadInventory(ContainerType.PLAYER, characterId);
    await ensureMandatoryIdentityItem(characterId, toSlots);

    const success = await transferBetweenContainers({
        fromType: otherContext.type,
        fromId: otherContext.id,
        fromSlots,
        fromSlot,
        toType: ContainerType.PLAYER,
        toId: characterId,
        toSlots,
        toSlot,
        amountRaw
    });
    if (!success) return;

    openInventoryContextByPlayer.set((player as any).id, { otherType: otherContext.type, otherId: otherContext.id });
    await refreshOpenInventory(player);
    await notifyContainerViewers(otherContext.type, otherContext.id, (player as any).id as number);
});

safeEvent('server:inventory:putToOther', async (
    player: PlayerMp,
    fromSlotRaw: unknown,
    toSlotRaw: unknown,
    amountRaw: unknown,
    otherTypeRaw: unknown,
    otherIdRaw: unknown
) => {
    if (!isPlayerValid(player)) return;
    const characterId = player.characterId;
    if (!characterId) return;

    const fromSlot = toInt(fromSlotRaw);
    const toSlot = toInt(toSlotRaw);
    if (fromSlot === null || toSlot === null || fromSlot < 0) return;

    const otherContext = parseOtherContainerContext(otherTypeRaw, otherIdRaw);
    if (!otherContext || otherContext.type === ContainerType.PLAYER) return;

    const fromSlots = await loadInventory(ContainerType.PLAYER, characterId);
    const source = getSlotByIndex(fromSlots, fromSlot);
    if (!source || source.itemId === 'identity') return;

    const toSlots = await loadInventory(otherContext.type, otherContext.id);
    const success = await transferBetweenContainers({
        fromType: ContainerType.PLAYER,
        fromId: characterId,
        fromSlots,
        fromSlot,
        toType: otherContext.type,
        toId: otherContext.id,
        toSlots,
        toSlot,
        amountRaw
    });
    if (!success) return;

    openInventoryContextByPlayer.set((player as any).id, { otherType: otherContext.type, otherId: otherContext.id });
    await refreshOpenInventory(player);
    await notifyContainerViewers(otherContext.type, otherContext.id, (player as any).id as number);
});

safeEvent('server:inventory:useItem', async (
    player: PlayerMp,
    slotRaw: unknown,
    otherTypeRaw?: unknown,
    otherIdRaw?: unknown
) => {
    if (!isPlayerValid(player)) return;
    const characterId = player.characterId;
    if (!characterId) return;

    const slotIndex = toInt(slotRaw);
    if (slotIndex === null || slotIndex < 0) return;

    const slots = await loadInventory(ContainerType.PLAYER, characterId);
    const source = getSlotByIndex(slots, slotIndex);
    if (!source) return;

    const def = getItemDef(source.itemId);
    if (!def) return;

    const useResult = await useItemById(player, source.itemId);
    if (!useResult.success) return;

    if (useResult.consume) {
        source.amount -= 1;
        if (source.amount <= 0) {
            await saveSlot(ContainerType.PLAYER, characterId, source);
            removeSlotFromCache(slots, source);
        } else {
            await saveSlot(ContainerType.PLAYER, characterId, source);
        }
    }

    const otherContext = parseOtherContainerContext(otherTypeRaw, otherIdRaw);
    if (otherContext) {
        openInventoryContextByPlayer.set((player as any).id, { otherType: otherContext.type, otherId: otherContext.id });
    }
    await refreshOpenInventory(player);
});

safeEvent('server:inventory:dropItem', async (
    player: PlayerMp,
    slotRaw: unknown,
    amountRaw: unknown,
    otherTypeRaw?: unknown,
    otherIdRaw?: unknown
) => {
    if (!isPlayerValid(player)) return;
    const characterId = player.characterId;
    if (!characterId) return;

    const slotIndex = toInt(slotRaw);
    if (slotIndex === null || slotIndex < 0) return;

    const playerSlots = await loadInventory(ContainerType.PLAYER, characterId);
    const source = getSlotByIndex(playerSlots, slotIndex);
    if (!source || source.itemId === 'identity') return;

    const droppedContainerId = characterId;
    const droppedSlots = await loadInventory(ContainerType.DROPPED, droppedContainerId);

    const success = await transferBetweenContainers({
        fromType: ContainerType.PLAYER,
        fromId: characterId,
        fromSlots: playerSlots,
        fromSlot: slotIndex,
        toType: ContainerType.DROPPED,
        toId: droppedContainerId,
        toSlots: droppedSlots,
        toSlot: -1,
        amountRaw
    });
    if (!success) return;

    const otherContext = parseOtherContainerContext(otherTypeRaw, otherIdRaw);
    if (otherContext) {
        openInventoryContextByPlayer.set((player as any).id, { otherType: otherContext.type, otherId: otherContext.id });
    }
    await refreshOpenInventory(player);
});

safeEvent('playerQuit', async (player: PlayerMp) => {
    const playerId = (player as any).id as number;
    openInventoryContextByPlayer.delete(playerId);
    setPlayerViewedContainer(playerId);
});
