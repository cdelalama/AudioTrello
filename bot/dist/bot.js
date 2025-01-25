"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const grammy_1 = require("grammy");
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Load environment variables with absolute path
dotenv_1.default.config({ path: path_1.default.join(__dirname, "../../bot/.env") });
// Verify BOT_TOKEN exists
if (!process.env.BOT_TOKEN) {
    throw new Error("BOT_TOKEN must be defined in environment variables!");
}
// Create bot instance
const bot = new grammy_1.Bot(process.env.BOT_TOKEN);
// Start command handler
bot.command("start", async (ctx) => {
    try {
        await ctx.reply("Hello! Bot started successfully.");
    }
    catch (error) {
        console.error("Error in start command:", error);
    }
});
// Start the bot
try {
    bot.start();
    console.log("Bot started successfully!");
}
catch (error) {
    console.error("Error starting the bot:", error);
}
