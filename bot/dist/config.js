"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Load environment variables with absolute path
dotenv_1.default.config({ path: path_1.default.join(__dirname, "../.env") });
// Export all environment variables
exports.config = {
    botToken: process.env.BOT_TOKEN,
    supabase: {
        url: process.env.SUPABASE_URL,
        anonKey: process.env.SUPABASE_ANON_KEY,
    },
    admin: {
        telegramId: process.env.ADMIN_TELEGRAM_ID,
    },
};
// Validate required environment variables
if (!exports.config.botToken) {
    throw new Error("BOT_TOKEN must be defined in environment variables!");
}
if (!exports.config.supabase.url || !exports.config.supabase.anonKey) {
    throw new Error("Supabase credentials not found in environment variables");
}
