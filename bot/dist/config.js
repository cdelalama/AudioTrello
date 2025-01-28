"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.initConfig = initConfig;
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const configService_1 = require("./services/configService");
// Load environment variables
dotenv_1.default.config({ path: path_1.default.join(__dirname, "../.env") });
// Base config without transcription
const baseConfig = {
    botToken: process.env.BOT_TOKEN,
    supabase: {
        url: process.env.SUPABASE_URL,
        anonKey: process.env.SUPABASE_ANON_KEY,
    },
    openai: {
        apiKey: process.env.OPENAI_API_KEY,
        available: Boolean(process.env.OPENAI_API_KEY),
    },
    google: {
        credentials: process.env.GOOGLE_APPLICATION_CREDENTIALS,
        projectId: process.env.GOOGLE_PROJECT_ID,
        available: Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS && process.env.GOOGLE_PROJECT_ID),
    },
    admin: {
        telegramId: process.env.ADMIN_TELEGRAM_ID,
    },
    transcription: {},
    trello: {
        apiKey: process.env.TRELLO_API_KEY || "",
        token: process.env.TRELLO_TOKEN || "",
        defaultBoardId: process.env.TRELLO_DEFAULT_BOARD_ID || "",
        defaultListId: process.env.TRELLO_DEFAULT_LIST_ID || "",
    },
};
exports.config = baseConfig;
// Initialize transcription config
async function initConfig() {
    exports.config.transcription = await configService_1.configService.getTranscriptionConfig();
}
// Validate only critical environment variables
if (!exports.config.botToken) {
    throw new Error("BOT_TOKEN must be defined in environment variables!");
}
// Log available services
console.log("Available services:");
console.log("- OpenAI Whisper:", exports.config.openai.available ? "✅" : "❌");
console.log("- Google Speech:", exports.config.google.available ? "✅" : "❌");
