"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = void 0;
exports.disconnectDB = disconnectDB;
exports.query = query;
const pg_1 = require("pg");
const dotenv = __importStar(require("dotenv"));
const path = __importStar(require("path"));
// RAGE:MP root directory is ragemp-srv/, so .env is at ../.env
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') }); // It will be in ragemp-srv/packages/santosrp/db.js so ../../../../ is maybe not reliable?
const fs_1 = __importDefault(require("fs"));
if (fs_1.default.existsSync(path.resolve(process.cwd(), '../.env'))) {
    dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
}
else {
    dotenv.config(); // fallback
}
const connectionString = process.env.DATABASE_URL;
exports.pool = new pg_1.Pool({
    connectionString,
    max: 32,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
});
exports.pool.on('error', (err) => {
    console.error('[DB] Beklenmedik pool hatası:', err);
});
async function disconnectDB() {
    try {
        await exports.pool.end();
        console.log('[DB] Bağlantılar kapatıldı.');
    }
    catch (err) {
        console.error('[DB] Bağlantı kapatma hatası:', err);
    }
}
// Kolay sorgu fonksiyonu
async function query(text, params) {
    const client = await exports.pool.connect();
    try {
        const res = await client.query(text, params);
        return res;
    }
    finally {
        client.release();
    }
}
//# sourceMappingURL=db.js.map