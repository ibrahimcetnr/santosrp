import { InventorySlot } from '../shared/types';
import '../shared/types';
export declare enum ContainerType {
    PLAYER = 1,
    VEHICLE_TRUNK = 2,
    VEHICLE_GLOVEBOX = 3,
    DROPPED = 4,
    PROPERTY = 5
}
export declare const inventories: Map<string, InventorySlot[]>;
export declare function getContainerKey(type: ContainerType, id: number): string;
export declare function loadInventory(type: ContainerType, containerId: number): Promise<InventorySlot[]>;
export declare function saveSlot(type: ContainerType, containerId: number, slot: typeof inventories extends Map<string, (infer S)[]> ? S : never): Promise<void>;
export declare function calcWeight(slots: InventorySlot[]): number;
export declare function giveItemToContainer(type: ContainerType, containerId: number, itemId: string, amount: number, metadata?: Record<string, unknown>): Promise<{
    success: boolean;
    slot?: number;
    amountAdded?: number;
}>;
export declare function openDualInventory(player: PlayerMp, otherType?: ContainerType, otherId?: number, otherName?: string, otherMaxWeight?: number): Promise<void>;
export declare function refreshOpenInventory(player: PlayerMp): Promise<void>;
//# sourceMappingURL=inventory.d.ts.map