"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inventories = exports.ContainerType = void 0;
exports.getContainerKey = getContainerKey;
exports.loadInventory = loadInventory;
exports.saveSlot = saveSlot;
exports.calcWeight = calcWeight;
exports.giveItemToContainer = giveItemToContainer;
exports.openDualInventory = openDualInventory;
exports.refreshOpenInventory = refreshOpenInventory;
// import * as mp from 'rage-rpc'; // RAGE ortamında genelde doğrudan mp objesi kullanılır.
const db_1 = require("./db");
const items_1 = require("./items");
const safeEvent_1 = require("./utils/safeEvent");
require("../shared/types");
var ContainerType;
(function (ContainerType) {
    ContainerType[ContainerType["PLAYER"] = 1] = "PLAYER";
    ContainerType[ContainerType["VEHICLE_TRUNK"] = 2] = "VEHICLE_TRUNK";
    ContainerType[ContainerType["VEHICLE_GLOVEBOX"] = 3] = "VEHICLE_GLOVEBOX";
    ContainerType[ContainerType["DROPPED"] = 4] = "DROPPED";
    ContainerType[ContainerType["PROPERTY"] = 5] = "PROPERTY";
})(ContainerType || (exports.ContainerType = ContainerType = {}));
// Memory cache of loaded inventories
exports.inventories = new Map(); // "{type}_{id}" -> slots
const openInventoryContextByPlayer = new Map();
const containerViewersByKey = new Map();
const playerViewedContainerKey = new Map();
function setPlayerViewedContainer(playerId, key) {
    const oldKey = playerViewedContainerKey.get(playerId);
    if (oldKey) {
        const oldSet = containerViewersByKey.get(oldKey);
        if (oldSet) {
            oldSet.delete(playerId);
            if (oldSet.size === 0)
                containerViewersByKey.delete(oldKey);
        }
        playerViewedContainerKey.delete(playerId);
    }
    if (!key)
        return;
    let viewers = containerViewersByKey.get(key);
    if (!viewers) {
        viewers = new Set();
        containerViewersByKey.set(key, viewers);
    }
    viewers.add(playerId);
    playerViewedContainerKey.set(playerId, key);
}
function getContainerKey(type, id) {
    return `${type}_${id}`;
}
async function loadInventory(type, containerId) {
    const key = getContainerKey(type, containerId);
    if (exports.inventories.has(key))
        return exports.inventories.get(key);
    const res = await (0, db_1.query)('SELECT id, slot, item_id as "itemId", amount, metadata FROM inventory_items WHERE parent_type = $1 AND parent_id = $2', [type, containerId]);
    const slots = res.rows;
    exports.inventories.set(key, slots);
    return slots;
}
async function saveSlot(type, containerId, slot) {
    if (slot.amount <= 0) {
        if (slot.id) {
            await (0, db_1.query)('DELETE FROM inventory_items WHERE id = $1', [slot.id]);
        }
        return;
    }
    if (slot.id) {
        await (0, db_1.query)('UPDATE inventory_items SET slot = $1, item_id = $2, amount = $3, metadata = $4 WHERE id = $5', [slot.slot, slot.itemId, slot.amount, slot.metadata || {}, slot.id]);
    }
    else {
        const res = await (0, db_1.query)('INSERT INTO inventory_items (parent_type, parent_id, slot, item_id, amount, metadata) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id', [type, containerId, slot.slot, slot.itemId, slot.amount, slot.metadata || {}]);
        slot.id = res.rows[0].id;
    }
}
async function swapSlotsAtomically(type, containerId, source, target) {
    if (!source.id || !target.id) {
        throw new Error('Swap için slot id bilgisi eksik.');
    }
    const tempSlot = -1;
    await (0, db_1.query)('BEGIN');
    try {
        await (0, db_1.query)('UPDATE inventory_items SET slot = $1 WHERE id = $2 AND parent_type = $3 AND parent_id = $4', [tempSlot, source.id, type, containerId]);
        await (0, db_1.query)('UPDATE inventory_items SET slot = $1 WHERE id = $2 AND parent_type = $3 AND parent_id = $4', [source.slot, target.id, type, containerId]);
        await (0, db_1.query)('UPDATE inventory_items SET slot = $1 WHERE id = $2 AND parent_type = $3 AND parent_id = $4', [target.slot, source.id, type, containerId]);
        await (0, db_1.query)('COMMIT');
    }
    catch (error) {
        await (0, db_1.query)('ROLLBACK');
        throw error;
    }
}
function calcWeight(slots) {
    return slots.reduce((acc, s) => acc + ((0, items_1.getItemDef)(s.itemId)?.weight || 0) * s.amount, 0);
}
async function giveItemToContainer(type, containerId, itemId, amount, metadata = {}) {
    if (!itemId || !Number.isInteger(amount) || amount <= 0) {
        return { success: false };
    }
    const itemDef = (0, items_1.getItemDef)(itemId);
    if (!itemDef)
        return { success: false };
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
    const created = {
        slot: freeSlot,
        itemId,
        amount: amountToGive,
        metadata: metadataPayload
    };
    await saveSlot(type, containerId, created);
    slots.push(created);
    return { success: true, slot: freeSlot, amountAdded: amountToGive };
}
async function ensureMandatoryIdentityItem(containerId, slots) {
    const hasIdentity = slots.some((slot) => slot.itemId === 'identity' && slot.amount > 0);
    if (hasIdentity)
        return;
    const usedSlots = new Set(slots.map((slot) => slot.slot));
    let targetSlot = 0;
    while (usedSlots.has(targetSlot))
        targetSlot += 1;
    const identitySlot = {
        slot: targetSlot,
        itemId: 'identity',
        amount: 1,
        metadata: { mandatory: true }
    };
    await saveSlot(ContainerType.PLAYER, containerId, identitySlot);
    slots.push(identitySlot);
}
function toInt(value) {
    const num = Number(value);
    if (!Number.isInteger(num))
        return null;
    return num;
}
function parseContainerType(value) {
    const parsed = toInt(value);
    if (parsed === null)
        return null;
    if (parsed !== ContainerType.PLAYER &&
        parsed !== ContainerType.VEHICLE_TRUNK &&
        parsed !== ContainerType.VEHICLE_GLOVEBOX &&
        parsed !== ContainerType.DROPPED &&
        parsed !== ContainerType.PROPERTY) {
        return null;
    }
    return parsed;
}
function getSlotByIndex(slots, slotIndex) {
    return slots.find((slot) => slot.slot === slotIndex);
}
function removeSlotFromCache(slots, slot) {
    const idx = slots.indexOf(slot);
    if (idx !== -1)
        slots.splice(idx, 1);
}
function hasMetadata(slot) {
    const metadata = slot.metadata;
    if (metadata === null || metadata === undefined)
        return false;
    if (typeof metadata === 'object')
        return Object.keys(metadata).length > 0;
    return true;
}
function canStackSlots(source, target) {
    return source.itemId === target.itemId && !hasMetadata(source) && !hasMetadata(target);
}
function getMoveAmount(source, requestedAmount) {
    if (hasMetadata(source))
        return 1;
    return normalizeAmount(requestedAmount, source.amount);
}
function getFirstFreeSlot(slots) {
    const used = new Set(slots.map((slot) => slot.slot));
    let slot = 0;
    while (used.has(slot))
        slot += 1;
    return slot;
}
function normalizeAmount(requestedAmount, maxAmount) {
    const parsed = toInt(requestedAmount);
    if (!parsed || parsed <= 0)
        return 0;
    return Math.min(parsed, maxAmount);
}
function parseOtherContainerContext(otherTypeRaw, otherIdRaw) {
    const otherType = parseContainerType(otherTypeRaw);
    const otherId = toInt(otherIdRaw);
    if (!otherType || otherId === null || otherId <= 0)
        return null;
    return { type: otherType, id: otherId };
}
function getOtherContainerName(type) {
    if (type === ContainerType.VEHICLE_TRUNK)
        return 'Araç Bagajı';
    if (type === ContainerType.VEHICLE_GLOVEBOX)
        return 'Araç Torpidosu';
    if (type === ContainerType.PROPERTY)
        return 'Depo';
    if (type === ContainerType.DROPPED)
        return 'Yerdeki Eşya';
    return 'İkinci Envanter';
}
function resolveContainerPresentation(type, requestedMaxWeight) {
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
async function openDualInventory(player, otherType, otherId, otherName, otherMaxWeight) {
    if (!(0, safeEvent_1.isPlayerValid)(player))
        return;
    const characterId = player.characterId;
    if (!characterId)
        return;
    const playerSlots = await loadInventory(ContainerType.PLAYER, characterId);
    await ensureMandatoryIdentityItem(characterId, playerSlots);
    const payload = {
        slots: playerSlots,
        maxWeight: 30,
        weight: calcWeight(playerSlots),
        items: items_1.ITEM_REGISTRY,
        charName: player.name || 'Oyuncu'
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
        openInventoryContextByPlayer.set(player.id, {
            otherType,
            otherId,
            otherName: payload.otherName,
            otherMaxWeight: payload.otherMaxWeight
        });
        setPlayerViewedContainer(player.id, getContainerKey(otherType, otherId));
    }
    else {
        openInventoryContextByPlayer.set(player.id, {});
        setPlayerViewedContainer(player.id);
    }
    player.call('client:inventory:openUI', [JSON.stringify(payload)]);
}
async function refreshOpenInventory(player) {
    if (!(0, safeEvent_1.isPlayerValid)(player))
        return;
    const context = openInventoryContextByPlayer.get(player.id);
    if (context && context.otherType !== undefined && context.otherId !== undefined) {
        await openDualInventory(player, context.otherType, context.otherId, context.otherName, context.otherMaxWeight);
        return;
    }
    await openDualInventory(player);
}
async function notifyContainerViewers(type, id, excludePlayerId) {
    const key = getContainerKey(type, id);
    const viewers = containerViewersByKey.get(key);
    if (!viewers || viewers.size === 0)
        return;
    const viewerIds = Array.from(viewers.values());
    for (const viewerId of viewerIds) {
        if (excludePlayerId !== undefined && viewerId === excludePlayerId)
            continue;
        const viewer = (globalThis.mp?.players?.at?.(viewerId));
        if (!viewer || !(0, safeEvent_1.isPlayerValid)(viewer)) {
            setPlayerViewedContainer(viewerId);
            openInventoryContextByPlayer.delete(viewerId);
            continue;
        }
        await refreshOpenInventory(viewer);
    }
}
async function transferBetweenContainers(params) {
    const source = getSlotByIndex(params.fromSlots, params.fromSlot);
    if (!source)
        return false;
    const moveAmount = getMoveAmount(source, params.amountRaw);
    if (moveAmount <= 0)
        return false;
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
    }
    else {
        const created = {
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
    }
    else {
        await saveSlot(params.fromType, params.fromId, source);
    }
    return true;
}
(0, safeEvent_1.safeEvent)('client:inventory:requestOpen', async (player, otherTypeRaw, otherIdRaw) => {
    if (!(0, safeEvent_1.isPlayerValid)(player))
        return;
    if (!player.characterId)
        return;
    const otherContext = parseOtherContainerContext(otherTypeRaw, otherIdRaw);
    await openDualInventory(player, otherContext?.type, otherContext?.id);
});
(0, safeEvent_1.safeEvent)('server:inventory:close', async (player) => {
    if (!(0, safeEvent_1.isPlayerValid)(player))
        return;
    const playerId = player.id;
    openInventoryContextByPlayer.delete(playerId);
    setPlayerViewedContainer(playerId);
    player.call('server:inventory:close');
});
(0, safeEvent_1.safeEvent)('server:inventory:moveSlot', async (player, fromSlotRaw, toSlotRaw, amountRaw, otherTypeRaw, otherIdRaw) => {
    if (!(0, safeEvent_1.isPlayerValid)(player))
        return;
    const characterId = player.characterId;
    if (!characterId)
        return;
    const fromSlot = toInt(fromSlotRaw);
    const toSlot = toInt(toSlotRaw);
    if (fromSlot === null || toSlot === null || fromSlot < 0 || toSlot < 0 || fromSlot === toSlot)
        return;
    const slots = await loadInventory(ContainerType.PLAYER, characterId);
    const source = getSlotByIndex(slots, fromSlot);
    if (!source)
        return;
    const moveAmount = getMoveAmount(source, amountRaw);
    if (moveAmount <= 0)
        return;
    const target = getSlotByIndex(slots, toSlot);
    if (target) {
        if (canStackSlots(source, target)) {
            target.amount += moveAmount;
            source.amount -= moveAmount;
            await saveSlot(ContainerType.PLAYER, characterId, target);
            if (source.amount <= 0) {
                await saveSlot(ContainerType.PLAYER, characterId, source);
                removeSlotFromCache(slots, source);
            }
            else {
                await saveSlot(ContainerType.PLAYER, characterId, source);
            }
        }
        else {
            if (moveAmount !== source.amount)
                return;
            const oldSourceSlot = source.slot;
            const oldTargetSlot = target.slot;
            await swapSlotsAtomically(ContainerType.PLAYER, characterId, source, target);
            source.slot = oldTargetSlot;
            target.slot = oldSourceSlot;
        }
    }
    else {
        if (moveAmount === source.amount) {
            source.slot = toSlot;
            await saveSlot(ContainerType.PLAYER, characterId, source);
        }
        else {
            source.amount -= moveAmount;
            await saveSlot(ContainerType.PLAYER, characterId, source);
            const splitSlot = {
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
        openInventoryContextByPlayer.set(player.id, { otherType: otherContext.type, otherId: otherContext.id });
    }
    await refreshOpenInventory(player);
});
(0, safeEvent_1.safeEvent)('server:inventory:moveOtherSlot', async (player, fromSlotRaw, toSlotRaw, amountRaw, otherTypeRaw, otherIdRaw) => {
    if (!(0, safeEvent_1.isPlayerValid)(player))
        return;
    const otherContext = parseOtherContainerContext(otherTypeRaw, otherIdRaw);
    if (!otherContext || otherContext.type === ContainerType.PLAYER)
        return;
    const fromSlot = toInt(fromSlotRaw);
    const toSlot = toInt(toSlotRaw);
    if (fromSlot === null || toSlot === null || fromSlot < 0 || toSlot < 0 || fromSlot === toSlot)
        return;
    const slots = await loadInventory(otherContext.type, otherContext.id);
    const source = getSlotByIndex(slots, fromSlot);
    if (!source)
        return;
    const moveAmount = getMoveAmount(source, amountRaw);
    if (moveAmount <= 0)
        return;
    const target = getSlotByIndex(slots, toSlot);
    if (target) {
        if (canStackSlots(source, target)) {
            target.amount += moveAmount;
            source.amount -= moveAmount;
            await saveSlot(otherContext.type, otherContext.id, target);
            if (source.amount <= 0) {
                await saveSlot(otherContext.type, otherContext.id, source);
                removeSlotFromCache(slots, source);
            }
            else {
                await saveSlot(otherContext.type, otherContext.id, source);
            }
        }
        else {
            if (moveAmount !== source.amount)
                return;
            const oldSourceSlot = source.slot;
            const oldTargetSlot = target.slot;
            await swapSlotsAtomically(otherContext.type, otherContext.id, source, target);
            source.slot = oldTargetSlot;
            target.slot = oldSourceSlot;
        }
    }
    else {
        if (moveAmount === source.amount) {
            source.slot = toSlot;
            await saveSlot(otherContext.type, otherContext.id, source);
        }
        else {
            source.amount -= moveAmount;
            await saveSlot(otherContext.type, otherContext.id, source);
            const splitSlot = {
                slot: toSlot,
                itemId: source.itemId,
                amount: moveAmount,
                metadata: source.metadata || {}
            };
            await saveSlot(otherContext.type, otherContext.id, splitSlot);
            slots.push(splitSlot);
        }
    }
    openInventoryContextByPlayer.set(player.id, { otherType: otherContext.type, otherId: otherContext.id });
    await refreshOpenInventory(player);
    await notifyContainerViewers(otherContext.type, otherContext.id, player.id);
});
(0, safeEvent_1.safeEvent)('server:inventory:splitSlot', async (player, slotRaw, amountRaw, otherTypeRaw, otherIdRaw) => {
    if (!(0, safeEvent_1.isPlayerValid)(player))
        return;
    const characterId = player.characterId;
    if (!characterId)
        return;
    const slotIndex = toInt(slotRaw);
    if (slotIndex === null || slotIndex < 0)
        return;
    const slots = await loadInventory(ContainerType.PLAYER, characterId);
    const source = getSlotByIndex(slots, slotIndex);
    if (!source)
        return;
    if (hasMetadata(source) || source.amount <= 1)
        return;
    const splitAmount = normalizeAmount(amountRaw, source.amount - 1);
    if (splitAmount <= 0)
        return;
    const targetSlot = getFirstFreeSlot(slots);
    source.amount -= splitAmount;
    await saveSlot(ContainerType.PLAYER, characterId, source);
    const newSlot = {
        slot: targetSlot,
        itemId: source.itemId,
        amount: splitAmount,
        metadata: source.metadata || {}
    };
    await saveSlot(ContainerType.PLAYER, characterId, newSlot);
    slots.push(newSlot);
    const otherContext = parseOtherContainerContext(otherTypeRaw, otherIdRaw);
    if (otherContext) {
        openInventoryContextByPlayer.set(player.id, { otherType: otherContext.type, otherId: otherContext.id });
    }
    await refreshOpenInventory(player);
});
(0, safeEvent_1.safeEvent)('server:inventory:takeFromOther', async (player, fromSlotRaw, toSlotRaw, amountRaw, otherTypeRaw, otherIdRaw) => {
    if (!(0, safeEvent_1.isPlayerValid)(player))
        return;
    const characterId = player.characterId;
    if (!characterId)
        return;
    const fromSlot = toInt(fromSlotRaw);
    const toSlot = toInt(toSlotRaw);
    if (fromSlot === null || toSlot === null || fromSlot < 0)
        return;
    const otherContext = parseOtherContainerContext(otherTypeRaw, otherIdRaw);
    if (!otherContext || otherContext.type === ContainerType.PLAYER)
        return;
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
    if (!success)
        return;
    openInventoryContextByPlayer.set(player.id, { otherType: otherContext.type, otherId: otherContext.id });
    await refreshOpenInventory(player);
    await notifyContainerViewers(otherContext.type, otherContext.id, player.id);
});
(0, safeEvent_1.safeEvent)('server:inventory:putToOther', async (player, fromSlotRaw, toSlotRaw, amountRaw, otherTypeRaw, otherIdRaw) => {
    if (!(0, safeEvent_1.isPlayerValid)(player))
        return;
    const characterId = player.characterId;
    if (!characterId)
        return;
    const fromSlot = toInt(fromSlotRaw);
    const toSlot = toInt(toSlotRaw);
    if (fromSlot === null || toSlot === null || fromSlot < 0)
        return;
    const otherContext = parseOtherContainerContext(otherTypeRaw, otherIdRaw);
    if (!otherContext || otherContext.type === ContainerType.PLAYER)
        return;
    const fromSlots = await loadInventory(ContainerType.PLAYER, characterId);
    const source = getSlotByIndex(fromSlots, fromSlot);
    if (!source || source.itemId === 'identity')
        return;
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
    if (!success)
        return;
    openInventoryContextByPlayer.set(player.id, { otherType: otherContext.type, otherId: otherContext.id });
    await refreshOpenInventory(player);
    await notifyContainerViewers(otherContext.type, otherContext.id, player.id);
});
(0, safeEvent_1.safeEvent)('server:inventory:useItem', async (player, slotRaw, otherTypeRaw, otherIdRaw) => {
    if (!(0, safeEvent_1.isPlayerValid)(player))
        return;
    const characterId = player.characterId;
    if (!characterId)
        return;
    const slotIndex = toInt(slotRaw);
    if (slotIndex === null || slotIndex < 0)
        return;
    const slots = await loadInventory(ContainerType.PLAYER, characterId);
    const source = getSlotByIndex(slots, slotIndex);
    if (!source)
        return;
    const def = (0, items_1.getItemDef)(source.itemId);
    if (!def)
        return;
    const useResult = await (0, items_1.useItemById)(player, source.itemId);
    if (!useResult.success)
        return;
    if (useResult.consume) {
        source.amount -= 1;
        if (source.amount <= 0) {
            await saveSlot(ContainerType.PLAYER, characterId, source);
            removeSlotFromCache(slots, source);
        }
        else {
            await saveSlot(ContainerType.PLAYER, characterId, source);
        }
    }
    const otherContext = parseOtherContainerContext(otherTypeRaw, otherIdRaw);
    if (otherContext) {
        openInventoryContextByPlayer.set(player.id, { otherType: otherContext.type, otherId: otherContext.id });
    }
    await refreshOpenInventory(player);
});
(0, safeEvent_1.safeEvent)('server:inventory:dropItem', async (player, slotRaw, amountRaw, otherTypeRaw, otherIdRaw) => {
    if (!(0, safeEvent_1.isPlayerValid)(player))
        return;
    const characterId = player.characterId;
    if (!characterId)
        return;
    const slotIndex = toInt(slotRaw);
    if (slotIndex === null || slotIndex < 0)
        return;
    const playerSlots = await loadInventory(ContainerType.PLAYER, characterId);
    const source = getSlotByIndex(playerSlots, slotIndex);
    if (!source || source.itemId === 'identity')
        return;
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
    if (!success)
        return;
    const otherContext = parseOtherContainerContext(otherTypeRaw, otherIdRaw);
    if (otherContext) {
        openInventoryContextByPlayer.set(player.id, { otherType: otherContext.type, otherId: otherContext.id });
    }
    await refreshOpenInventory(player);
});
(0, safeEvent_1.safeEvent)('playerQuit', async (player) => {
    const playerId = player.id;
    openInventoryContextByPlayer.delete(playerId);
    setPlayerViewedContainer(playerId);
});
//# sourceMappingURL=inventory.js.map