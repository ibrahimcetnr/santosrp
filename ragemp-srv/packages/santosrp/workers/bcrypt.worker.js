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
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * SantosRP - bcrypt Worker Thread
 * Ana RAGE:MP thread'ini bloklamadan bcrypt işlemlerini yapar
 */
const worker_threads_1 = require("worker_threads");
const bcrypt = __importStar(require("bcryptjs"));
if (!worker_threads_1.parentPort) {
    throw new Error('Bu dosya Worker Thread olarak çalıştırılmalıdır.');
}
worker_threads_1.parentPort.on('message', async (msg) => {
    try {
        if (msg.type === 'hash') {
            const result = await bcrypt.hash(msg.data, 10);
            worker_threads_1.parentPort.postMessage({ id: msg.id, result });
        }
        else if (msg.type === 'compare') {
            const result = await bcrypt.compare(msg.data, msg.hash);
            worker_threads_1.parentPort.postMessage({ id: msg.id, result });
        }
    }
    catch (err) {
        worker_threads_1.parentPort.postMessage({ id: msg.id, error: err.message });
    }
});
//# sourceMappingURL=bcrypt.worker.js.map