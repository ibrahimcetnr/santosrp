export declare function initBcryptPool(): void;
export declare function bcryptHash(data: string): Promise<string>;
export declare function bcryptCompare(data: string, hash: string): Promise<boolean>;
export declare function destroyBcryptPool(): void;
//# sourceMappingURL=bcrypt-pool.d.ts.map