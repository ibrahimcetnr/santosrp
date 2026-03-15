import { ItemDef } from '../shared/types';

export const ITEM_REGISTRY: Record<string, ItemDef> = {
    'water': { id: 'water', name: 'Su Şişesi', type: 'consumable', img: 'water', weight: 0.5, usable: true },
    'bread': { id: 'bread', name: 'Ekmek', type: 'consumable', img: 'bread', weight: 0.2, usable: true },
    'phone': { id: 'phone', name: 'Cep Telefonu', type: 'item', img: 'phone', weight: 0.3, usable: true },
    'keys': { id: 'keys', name: 'Anahtar', type: 'item', img: 'keys', weight: 0.1, usable: false },
};

export function getItemDef(id: string): ItemDef | null {
    return ITEM_REGISTRY[id] || null;
}
