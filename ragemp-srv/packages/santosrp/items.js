"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ITEM_REGISTRY = void 0;
exports.getItemDef = getItemDef;
exports.ITEM_REGISTRY = {
    'water': { id: 'water', name: 'Su Şişesi', type: 'consumable', img: 'water', weight: 0.5, usable: true },
    'bread': { id: 'bread', name: 'Ekmek', type: 'consumable', img: 'bread', weight: 0.2, usable: true },
    'phone': { id: 'phone', name: 'Cep Telefonu', type: 'item', img: 'phone', weight: 0.3, usable: true },
    'keys': { id: 'keys', name: 'Anahtar', type: 'item', img: 'keys', weight: 0.1, usable: false },
};
function getItemDef(id) {
    return exports.ITEM_REGISTRY[id] || null;
}
//# sourceMappingURL=items.js.map