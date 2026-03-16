import { ItemDef } from '../shared/types';
export interface ItemUseResult {
    success: boolean;
    consume: boolean;
}
export declare const ITEM_REGISTRY: Record<string, ItemDef>;
export declare function getItemDef(id: string): ItemDef | null;
export declare function useItemById(player: PlayerMp, itemId: string): Promise<ItemUseResult>;
//# sourceMappingURL=items.d.ts.map