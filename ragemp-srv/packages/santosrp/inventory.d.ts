import { InventorySlot } from '../shared/types';
export declare enum ContainerType {
    PLAYER = 1,
    VEHICLE = 2,
    PROPERTY = 3,
    DROPPED = 4
}
export declare const inventories: Map<string, InventorySlot[]>;
export declare function getContainerKey(type: ContainerType, id: number): string;
export declare function loadInventory(type: ContainerType, containerId: number): Promise<InventorySlot[]>;
export declare function saveSlot(type: ContainerType, containerId: number, slot: typeof inventories extends Map<string, (infer S)[]> ? S : never): Promise<void>;
export declare function calcWeight(slots: InventorySlot[]): number;
//# sourceMappingURL=inventory.d.ts.map