"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inventories = exports.ContainerType = void 0;
exports.getInventoryTotalWeight = getInventoryTotalWeight;
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
const activeTransactions = new Set();
function getLockKey(type, id) {
    return `type_${type}_id_${id}`;
}
function acquireTransactionLocks(keys) {
    const uniqueKeys = Array.from(new Set(keys));
    if (uniqueKeys.some((key) => activeTransactions.has(key)))
        return false;
    for (const key of uniqueKeys)
        activeTransactions.add(key);
    return true;
}
function releaseTransactionLocks(keys) {
    for (const key of new Set(keys)) {
        activeTransactions.delete(key);
    }
}
const droppedWorldByDbId = new Map();
const PLAYER_MAX_WEIGHT = 30;
function getPlayerById(playerId) {
    const candidate = (globalThis.mp?.players?.at?.(playerId));
    if (!candidate)
        return null;
    return (0, safeEvent_1.isPlayerValid)(candidate) ? candidate : null;
}
function findVehicleByDbId(dbId) {
    let matched = null;
    globalThis.mp.vehicles.forEach((vehicle) => {
        if (matched)
            return;
        const vehicleDbId = Number(vehicle.getVariable('dbId'));
        if (Number.isInteger(vehicleDbId) && vehicleDbId === dbId) {
            matched = vehicle;
        }
    });
    return matched;
}
function getDroppedContainerPosition(containerId) {
    let nearest = null;
    for (const entry of droppedWorldByDbId.values()) {
        if (entry.containerId !== containerId)
            continue;
        nearest = entry.position;
        break;
    }
    return nearest;
}
function validateOtherContainerDistance(player, otherType, otherId) {
    if (otherType === ContainerType.VEHICLE_TRUNK || otherType === ContainerType.VEHICLE_GLOVEBOX) {
        const vehicle = findVehicleByDbId(otherId);
        if (!vehicle || !vehicle.position || player.dist(vehicle.position) > 5.0) {
            player.call('chat:push', ['!{#ef4444}[HATA] Karşı envanter ile mesafeniz çok uzak.']);
            return false;
        }
    }
    if (otherType === ContainerType.DROPPED) {
        const dropPos = getDroppedContainerPosition(otherId);
        if (!dropPos) {
            player.call('chat:push', ['!{#ef4444}[HATA] Yerdeki eşya bulunamadı.']);
            return false;
        }
        const dist = player.dist(new globalThis.mp.Vector3(dropPos.x, dropPos.y, dropPos.z));
        if (!Number.isFinite(dist) || dist > 3.0) {
            player.call('chat:push', ['!{#ef4444}[HATA] Yerdeki eşyaya çok uzaksınız.']);
            return false;
        }
    }
    return true;
}
function getContainerMaxWeight(type, id, viewerPlayerId) {
    if (type === ContainerType.PLAYER)
        return PLAYER_MAX_WEIGHT;
    if (type === ContainerType.VEHICLE_GLOVEBOX)
        return 20;
    if (type === ContainerType.DROPPED)
        return Number.POSITIVE_INFINITY;
    if (viewerPlayerId !== undefined) {
        const context = openInventoryContextByPlayer.get(viewerPlayerId);
        if (context &&
            context.otherType === type &&
            context.otherId === id &&
            typeof context.otherMaxWeight === 'number' &&
            Number.isFinite(context.otherMaxWeight)) {
            return context.otherMaxWeight;
        }
    }
    if (type === ContainerType.VEHICLE_TRUNK)
        return 50;
    return 30;
}
function getItemWeight(slot) {
    const itemDef = (0, items_1.getItemDef)(slot.itemId);
    if (!itemDef)
        return 0;
    return itemDef.weight * slot.amount;
}
async function getInventoryTotalWeight(containerType, containerId) {
    const slots = await loadInventory(containerType, containerId);
    return slots.reduce((sum, slot) => sum + getItemWeight(slot), 0);
}
function parseDroppedPosition(metadata) {
    if (!metadata || typeof metadata !== 'object')
        return null;
    const anyMetadata = metadata;
    const pos = anyMetadata.dropPos;
    if (!pos || typeof pos !== 'object')
        return null;
    const x = Number(pos.x);
    const y = Number(pos.y);
    const z = Number(pos.z);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z))
        return null;
    return { x, y, z };
}
function resolveGroundZ(position) {
    const gameplay = globalThis.mp?.game?.gameplay;
    if (!gameplay)
        return position.z;
    const nativeFn = gameplay.getGroundZFor_3dCoord || gameplay.getGroundZFor3dCoord;
    if (typeof nativeFn !== 'function')
        return position.z;
    try {
        const groundZ = Number(nativeFn(position.x, position.y, position.z + 5, 0, false));
        if (Number.isFinite(groundZ))
            return groundZ;
    }
    catch {
        return position.z;
    }
    return position.z;
}
function resolveDroppedModel(itemId) {
    const itemDef = (0, items_1.getItemDef)(itemId);
    const modelName = itemDef?.model || 'prop_paper_bag_01';
    if (typeof modelName === 'number')
        return modelName;
    return globalThis.mp.joaat(modelName);
}
function destroyDroppedWorldEntity(slotDbId) {
    const worldEntity = droppedWorldByDbId.get(slotDbId);
    if (!worldEntity)
        return;
    if (worldEntity.object)
        worldEntity.object.destroy();
    if (worldEntity.label)
        worldEntity.label.destroy();
    droppedWorldByDbId.delete(slotDbId);
}
async function syncDroppedWorldEntity(slot, containerId) {
    if (!slot.id)
        return;
    destroyDroppedWorldEntity(slot.id);
    const droppedPos = parseDroppedPosition(slot.metadata);
    if (!droppedPos || slot.amount <= 0)
        return;
    const modelHash = resolveDroppedModel(slot.itemId);
    const itemDef = (0, items_1.getItemDef)(slot.itemId);
    const itemName = itemDef?.name || slot.itemId;
    const object = globalThis.mp.objects.new(modelHash, new globalThis.mp.Vector3(droppedPos.x, droppedPos.y, droppedPos.z - 0.95), { dimension: 0 });
    const label = globalThis.mp.labels.new(`${itemName} x${slot.amount} [E]`, new globalThis.mp.Vector3(droppedPos.x, droppedPos.y, droppedPos.z + 0.08), {
        drawDistance: 6,
        los: false,
        dimension: 0
    });
    droppedWorldByDbId.set(slot.id, {
        object,
        label,
        containerId,
        slot: slot.slot,
        position: droppedPos
    });
}
function createDroppedContainerId() {
    const base = Math.floor(Date.now() % 1_000_000_000);
    const random = Math.floor(Math.random() * 10_000);
    return base + random;
}
function getNearestDroppedEntry(player, maxDistance) {
    let nearest = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const [slotDbId, entry] of droppedWorldByDbId.entries()) {
        const distance = player.dist(new globalThis.mp.Vector3(entry.position.x, entry.position.y, entry.position.z));
        if (!Number.isFinite(distance) || distance > maxDistance)
            continue;
        if (distance < nearestDistance) {
            nearestDistance = distance;
            nearest = { slotDbId, entry };
        }
    }
    return nearest;
}
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
        maxWeight: PLAYER_MAX_WEIGHT,
        weight: await getInventoryTotalWeight(ContainerType.PLAYER, characterId),
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
        payload.otherWeight = await getInventoryTotalWeight(otherType, otherId);
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
        return { success: false, movedAmount: 0, sourceRemoved: false };
    const moveAmount = getMoveAmount(source, params.amountRaw);
    if (moveAmount <= 0)
        return { success: false, movedAmount: 0, sourceRemoved: false };
    let targetSlot = params.toSlot;
    if (targetSlot < 0) {
        const sameStack = params.toSlots.find((slot) => canStackSlots(source, slot));
        targetSlot = sameStack ? sameStack.slot : getFirstFreeSlot(params.toSlots);
    }
    const target = getSlotByIndex(params.toSlots, targetSlot);
    if (target && !canStackSlots(source, target)) {
        return { success: false, movedAmount: 0, sourceRemoved: false };
    }
    let savedTarget;
    if (target) {
        target.amount += moveAmount;
        await saveSlot(params.toType, params.toId, target);
        savedTarget = target;
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
        savedTarget = created;
    }
    source.amount -= moveAmount;
    let sourceRemoved = false;
    if (source.amount <= 0) {
        await saveSlot(params.fromType, params.fromId, source);
        removeSlotFromCache(params.fromSlots, source);
        sourceRemoved = true;
    }
    else {
        await saveSlot(params.fromType, params.fromId, source);
    }
    return {
        success: true,
        movedAmount: moveAmount,
        source,
        target: savedTarget,
        sourceRemoved
    };
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
    const otherContext = parseOtherContainerContext(otherTypeRaw, otherIdRaw);
    const lockKeys = [
        getLockKey(ContainerType.PLAYER, characterId),
        getLockKey(otherContext?.type ?? ContainerType.PLAYER, otherContext?.id ?? characterId)
    ];
    if (!acquireTransactionLocks(lockKeys))
        return;
    try {
        const slots = await loadInventory(ContainerType.PLAYER, characterId);
        const currentWeight = await getInventoryTotalWeight(ContainerType.PLAYER, characterId);
        if (currentWeight > PLAYER_MAX_WEIGHT) {
            player.call('chat:push', ['!{#ef4444}[HATA] Envanter ağırlık kapasiteniz aşıldığı için işlem yapılamadı.']);
            return;
        }
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
        if (otherContext) {
            openInventoryContextByPlayer.set(player.id, { otherType: otherContext.type, otherId: otherContext.id });
        }
        await refreshOpenInventory(player);
    }
    finally {
        releaseTransactionLocks(lockKeys);
    }
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
    const lockKeys = [
        getLockKey(ContainerType.PLAYER, characterId),
        getLockKey(otherContext.type, otherContext.id)
    ];
    if (!acquireTransactionLocks(lockKeys))
        return;
    try {
        if (!validateOtherContainerDistance(player, otherContext.type, otherContext.id))
            return;
        const fromSlots = await loadInventory(otherContext.type, otherContext.id);
        const toSlots = await loadInventory(ContainerType.PLAYER, characterId);
        await ensureMandatoryIdentityItem(characterId, toSlots);
        const source = getSlotByIndex(fromSlots, fromSlot);
        if (!source)
            return;
        const moveAmount = getMoveAmount(source, amountRaw);
        if (moveAmount <= 0)
            return;
        const itemDef = (0, items_1.getItemDef)(source.itemId);
        const addedWeight = (itemDef?.weight || 0) * moveAmount;
        const playerWeight = await getInventoryTotalWeight(ContainerType.PLAYER, characterId);
        if (playerWeight + addedWeight > PLAYER_MAX_WEIGHT) {
            player.call('chat:push', ['!{#ef4444}[HATA] Envanter ağırlık kapasiteniz yetersiz!']);
            return;
        }
        const transfer = await transferBetweenContainers({
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
        if (!transfer.success)
            return;
        if (otherContext.type === ContainerType.DROPPED && transfer.source?.id) {
            if (transfer.sourceRemoved) {
                destroyDroppedWorldEntity(transfer.source.id);
            }
            else {
                await syncDroppedWorldEntity(transfer.source, otherContext.id);
            }
        }
        openInventoryContextByPlayer.set(player.id, { otherType: otherContext.type, otherId: otherContext.id });
        await refreshOpenInventory(player);
        await notifyContainerViewers(otherContext.type, otherContext.id, player.id);
    }
    finally {
        releaseTransactionLocks(lockKeys);
    }
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
    const lockKeys = [
        getLockKey(ContainerType.PLAYER, characterId),
        getLockKey(otherContext.type, otherContext.id)
    ];
    if (!acquireTransactionLocks(lockKeys))
        return;
    try {
        if (!validateOtherContainerDistance(player, otherContext.type, otherContext.id))
            return;
        const fromSlots = await loadInventory(ContainerType.PLAYER, characterId);
        const source = getSlotByIndex(fromSlots, fromSlot);
        if (!source || source.itemId === 'identity')
            return;
        const moveAmount = getMoveAmount(source, amountRaw);
        if (moveAmount <= 0)
            return;
        const toSlots = await loadInventory(otherContext.type, otherContext.id);
        const itemDef = (0, items_1.getItemDef)(source.itemId);
        const addedWeight = (itemDef?.weight || 0) * moveAmount;
        const otherWeight = await getInventoryTotalWeight(otherContext.type, otherContext.id);
        const otherMaxWeight = getContainerMaxWeight(otherContext.type, otherContext.id, player.id);
        if (Number.isFinite(otherMaxWeight) && otherWeight + addedWeight > otherMaxWeight) {
            player.call('chat:push', ['!{#ef4444}[HATA] Karşı envanterin ağırlık kapasitesi yetersiz!']);
            return;
        }
        const transfer = await transferBetweenContainers({
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
        if (!transfer.success)
            return;
        openInventoryContextByPlayer.set(player.id, { otherType: otherContext.type, otherId: otherContext.id });
        await refreshOpenInventory(player);
        await notifyContainerViewers(otherContext.type, otherContext.id, player.id);
    }
    finally {
        releaseTransactionLocks(lockKeys);
    }
});
(0, safeEvent_1.safeEvent)('server:inventory:giveItem', async (player, slotRaw, targetPlayerIdRaw, amountRaw, otherTypeRaw, otherIdRaw) => {
    if (!(0, safeEvent_1.isPlayerValid)(player))
        return;
    const characterId = player.characterId;
    if (!characterId)
        return;
    const slotIndex = toInt(slotRaw);
    const targetPlayerId = toInt(targetPlayerIdRaw);
    if (slotIndex === null || slotIndex < 0 || targetPlayerId === null || targetPlayerId <= 0)
        return;
    const targetPlayer = getPlayerById(targetPlayerId);
    if (!targetPlayer || !targetPlayer.characterId || targetPlayer.id === player.id)
        return;
    const targetCharacterId = targetPlayer.characterId;
    const lockKeys = [
        getLockKey(ContainerType.PLAYER, characterId),
        getLockKey(ContainerType.PLAYER, targetCharacterId)
    ];
    if (!acquireTransactionLocks(lockKeys))
        return;
    try {
        const distance = player.dist(targetPlayer.position);
        if (!Number.isFinite(distance) || distance > 5) {
            player.call('chat:push', ['!{#ef4444}[HATA] Hedef oyuncu yeterince yakın değil.']);
            return;
        }
        const fromSlots = await loadInventory(ContainerType.PLAYER, characterId);
        const source = getSlotByIndex(fromSlots, slotIndex);
        if (!source || source.itemId === 'identity')
            return;
        const moveAmount = getMoveAmount(source, amountRaw);
        if (moveAmount <= 0)
            return;
        const targetWeight = await getInventoryTotalWeight(ContainerType.PLAYER, targetCharacterId);
        const itemDef = (0, items_1.getItemDef)(source.itemId);
        const addedWeight = (itemDef?.weight || 0) * moveAmount;
        if (targetWeight + addedWeight > PLAYER_MAX_WEIGHT) {
            player.call('chat:push', ['!{#ef4444}[HATA] Hedef oyuncunun envanter ağırlık kapasitesi yetersiz!']);
            targetPlayer.call('chat:push', ['!{#ef4444}[HATA] Envanter ağırlık kapasiteniz yetersiz!']);
            return;
        }
        const toSlots = await loadInventory(ContainerType.PLAYER, targetCharacterId);
        await ensureMandatoryIdentityItem(targetCharacterId, toSlots);
        const transfer = await transferBetweenContainers({
            fromType: ContainerType.PLAYER,
            fromId: characterId,
            fromSlots,
            fromSlot: slotIndex,
            toType: ContainerType.PLAYER,
            toId: targetCharacterId,
            toSlots,
            toSlot: -1,
            amountRaw: moveAmount
        });
        if (!transfer.success)
            return;
        const transferredItemName = itemDef?.name || source.itemId;
        player.call('chat:push', [`!{#22c55e}[ENVANTER] ${transfer.movedAmount}x ${transferredItemName} eşyasını #${targetPlayer.id} oyuncusuna verdin.`]);
        targetPlayer.call('chat:push', [`!{#22c55e}[ENVANTER] #${player.id} sana ${transfer.movedAmount}x ${transferredItemName} verdi.`]);
        const otherContext = parseOtherContainerContext(otherTypeRaw, otherIdRaw);
        if (otherContext) {
            openInventoryContextByPlayer.set(player.id, { otherType: otherContext.type, otherId: otherContext.id });
        }
        await refreshOpenInventory(player);
        await refreshOpenInventory(targetPlayer);
    }
    finally {
        releaseTransactionLocks(lockKeys);
    }
});
(0, safeEvent_1.safeEvent)('server:inventory:pickupItem', async (player, droppedContainerIdRaw, slotRaw, amountRaw, otherTypeRaw, otherIdRaw) => {
    if (!(0, safeEvent_1.isPlayerValid)(player))
        return;
    const characterId = player.characterId;
    if (!characterId)
        return;
    const droppedContainerId = toInt(droppedContainerIdRaw);
    const fromSlot = toInt(slotRaw);
    if (droppedContainerId === null || droppedContainerId <= 0 || fromSlot === null || fromSlot < 0)
        return;
    const fromSlots = await loadInventory(ContainerType.DROPPED, droppedContainerId);
    const source = getSlotByIndex(fromSlots, fromSlot);
    if (!source)
        return;
    const moveAmount = getMoveAmount(source, amountRaw);
    if (moveAmount <= 0)
        return;
    const itemDef = (0, items_1.getItemDef)(source.itemId);
    const addedWeight = (itemDef?.weight || 0) * moveAmount;
    const playerWeight = await getInventoryTotalWeight(ContainerType.PLAYER, characterId);
    if (playerWeight + addedWeight > PLAYER_MAX_WEIGHT) {
        player.call('chat:push', ['!{#ef4444}[HATA] Envanter ağırlık kapasiteniz yetersiz!']);
        return;
    }
    const toSlots = await loadInventory(ContainerType.PLAYER, characterId);
    await ensureMandatoryIdentityItem(characterId, toSlots);
    const transfer = await transferBetweenContainers({
        fromType: ContainerType.DROPPED,
        fromId: droppedContainerId,
        fromSlots,
        fromSlot,
        toType: ContainerType.PLAYER,
        toId: characterId,
        toSlots,
        toSlot: -1,
        amountRaw: moveAmount
    });
    if (!transfer.success)
        return;
    if (transfer.source?.id) {
        if (transfer.sourceRemoved) {
            destroyDroppedWorldEntity(transfer.source.id);
        }
        else {
            await syncDroppedWorldEntity(transfer.source, droppedContainerId);
        }
    }
    const otherContext = parseOtherContainerContext(otherTypeRaw, otherIdRaw);
    if (otherContext) {
        openInventoryContextByPlayer.set(player.id, { otherType: otherContext.type, otherId: otherContext.id });
    }
    await refreshOpenInventory(player);
    await notifyContainerViewers(ContainerType.DROPPED, droppedContainerId, player.id);
});
(0, safeEvent_1.safeEvent)('server:inventory:pickupNearest', async (player) => {
    if (!(0, safeEvent_1.isPlayerValid)(player))
        return;
    const characterId = player.characterId;
    if (!characterId)
        return;
    const nearestDropped = getNearestDroppedEntry(player, 3.0);
    if (!nearestDropped)
        return;
    const droppedContainerId = nearestDropped.entry.containerId;
    const fromSlot = nearestDropped.entry.slot;
    const lockKeys = [
        getLockKey(ContainerType.PLAYER, characterId),
        getLockKey(ContainerType.DROPPED, droppedContainerId)
    ];
    if (!acquireTransactionLocks(lockKeys))
        return;
    try {
        const fromSlots = await loadInventory(ContainerType.DROPPED, droppedContainerId);
        const source = getSlotByIndex(fromSlots, fromSlot);
        if (!source)
            return;
        const moveAmount = source.amount;
        if (moveAmount <= 0)
            return;
        const itemDef = (0, items_1.getItemDef)(source.itemId);
        const addedWeight = (itemDef?.weight || 0) * moveAmount;
        const playerWeight = await getInventoryTotalWeight(ContainerType.PLAYER, characterId);
        if (playerWeight + addedWeight > PLAYER_MAX_WEIGHT) {
            player.call('chat:push', ['!{#ef4444}[HATA] Envanter ağırlık kapasiteniz yetersiz!']);
            return;
        }
        const toSlots = await loadInventory(ContainerType.PLAYER, characterId);
        await ensureMandatoryIdentityItem(characterId, toSlots);
        const transfer = await transferBetweenContainers({
            fromType: ContainerType.DROPPED,
            fromId: droppedContainerId,
            fromSlots,
            fromSlot,
            toType: ContainerType.PLAYER,
            toId: characterId,
            toSlots,
            toSlot: -1,
            amountRaw: moveAmount
        });
        if (!transfer.success)
            return;
        if (transfer.source?.id) {
            if (transfer.sourceRemoved) {
                destroyDroppedWorldEntity(transfer.source.id);
            }
            else {
                await syncDroppedWorldEntity(transfer.source, droppedContainerId);
            }
        }
        await refreshOpenInventory(player);
        await notifyContainerViewers(ContainerType.DROPPED, droppedContainerId, player.id);
    }
    finally {
        releaseTransactionLocks(lockKeys);
    }
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
    const moveAmount = getMoveAmount(source, amountRaw);
    if (moveAmount <= 0)
        return;
    const droppedContainerId = createDroppedContainerId();
    const droppedSlots = await loadInventory(ContainerType.DROPPED, droppedContainerId);
    const transfer = await transferBetweenContainers({
        fromType: ContainerType.PLAYER,
        fromId: characterId,
        fromSlots: playerSlots,
        fromSlot: slotIndex,
        toType: ContainerType.DROPPED,
        toId: droppedContainerId,
        toSlots: droppedSlots,
        toSlot: -1,
        amountRaw: moveAmount
    });
    if (!transfer.success || !transfer.target)
        return;
    const targetSlot = transfer.target;
    const sourceMeta = targetSlot.metadata && typeof targetSlot.metadata === 'object'
        ? targetSlot.metadata
        : {};
    const dropPos = {
        x: player.position.x,
        y: player.position.y,
        z: resolveGroundZ({ x: player.position.x, y: player.position.y, z: player.position.z })
    };
    targetSlot.metadata = {
        ...sourceMeta,
        dropPos,
        droppedAt: Date.now()
    };
    await saveSlot(ContainerType.DROPPED, droppedContainerId, targetSlot);
    await syncDroppedWorldEntity(targetSlot, droppedContainerId);
    const otherContext = parseOtherContainerContext(otherTypeRaw, otherIdRaw);
    if (otherContext) {
        openInventoryContextByPlayer.set(player.id, { otherType: otherContext.type, otherId: otherContext.id });
    }
    await refreshOpenInventory(player);
});
async function hydrateDroppedWorldItems() {
    const res = await (0, db_1.query)('SELECT id, parent_id as "parentId", slot, item_id as "itemId", amount, metadata FROM inventory_items WHERE parent_type = $1', [ContainerType.DROPPED]);
    for (const row of res.rows) {
        const slotDbId = Number(row.id);
        const parentId = Number(row.parentId);
        const slotIndex = Number(row.slot);
        const itemId = String(row.itemId || '');
        const amount = Number(row.amount);
        if (!Number.isInteger(slotDbId) || slotDbId <= 0)
            continue;
        if (!Number.isInteger(parentId) || parentId <= 0)
            continue;
        if (!Number.isInteger(slotIndex) || slotIndex < 0)
            continue;
        if (!itemId || !Number.isInteger(amount) || amount <= 0)
            continue;
        const cacheKey = getContainerKey(ContainerType.DROPPED, parentId);
        const cachedSlots = exports.inventories.get(cacheKey) || [];
        const existing = cachedSlots.find((entry) => entry.slot === slotIndex);
        if (!existing) {
            const slot = {
                id: slotDbId,
                slot: slotIndex,
                itemId,
                amount,
                metadata: row.metadata
            };
            cachedSlots.push(slot);
            exports.inventories.set(cacheKey, cachedSlots);
            await syncDroppedWorldEntity(slot, parentId);
        }
    }
}
void hydrateDroppedWorldItems().catch((error) => {
    console.error('[INVENTORY] Dropped item world hydrate başarısız:', error);
});
(0, safeEvent_1.safeEvent)('playerQuit', async (player) => {
    const playerId = player.id;
    openInventoryContextByPlayer.delete(playerId);
    setPlayerViewedContainer(playerId);
});
//# sourceMappingURL=inventory.js.map