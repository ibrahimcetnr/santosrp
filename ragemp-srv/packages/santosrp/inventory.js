"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inventories = exports.ContainerType = void 0;
exports.getContainerKey = getContainerKey;
exports.loadInventory = loadInventory;
exports.saveSlot = saveSlot;
exports.calcWeight = calcWeight;
// import * as mp from 'rage-rpc'; // RAGE ortamında genelde doğrudan mp objesi kullanılır.
const db_1 = require("./db");
const items_1 = require("./items");
const safeEvent_1 = require("./utils/safeEvent");
var ContainerType;
(function (ContainerType) {
    ContainerType[ContainerType["PLAYER"] = 1] = "PLAYER";
    ContainerType[ContainerType["VEHICLE"] = 2] = "VEHICLE";
    ContainerType[ContainerType["PROPERTY"] = 3] = "PROPERTY";
    ContainerType[ContainerType["DROPPED"] = 4] = "DROPPED";
})(ContainerType || (exports.ContainerType = ContainerType = {}));
// Memory cache of loaded inventories
exports.inventories = new Map(); // "{type}_{id}" -> slots
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
        await (0, db_1.query)('UPDATE inventory_items SET item_id = $1, amount = $2, metadata = $3 WHERE id = $4', [slot.itemId, slot.amount, slot.metadata || {}, slot.id]);
    }
    else {
        const res = await (0, db_1.query)('INSERT INTO inventory_items (parent_type, parent_id, slot, item_id, amount, metadata) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id', [type, containerId, slot.slot, slot.itemId, slot.amount, slot.metadata || {}]);
        slot.id = res.rows[0].id;
    }
}
function calcWeight(slots) {
    return slots.reduce((acc, s) => acc + ((0, items_1.getItemDef)(s.itemId)?.weight || 0) * s.amount, 0);
}
// ... more methods to add/remove/move items to be added as needed
// RAGE events integration will follow
// Envanter Açma İsteğini Karşıla
(0, safeEvent_1.safeEvent)('client:inventory:requestOpen', async (player) => {
    if (!(0, safeEvent_1.isPlayerValid)(player))
        return;
    try {
        if (!player.characterId)
            return; // Kullanıcının karakteri yoksa dön
        // Örnek bir envanter yükleme
        const slots = await loadInventory(ContainerType.PLAYER, player.characterId);
        // Şimdilik weight'i 0, max'i 30 kabul edelim
        const weight = calcWeight(slots);
        const payload = {
            slots,
            maxWeight: 30, // Örnek olarak
            weight,
            items: items_1.ITEM_REGISTRY,
            charName: player.name
        };
        player.call('client:inventory:openUI', [JSON.stringify(payload)]);
    }
    catch (err) {
        console.error("Envanter açma hatası:", err);
    }
});
//# sourceMappingURL=inventory.js.map