import { Bot } from "grammy";
import dotenv from "dotenv";
import path from "path";

// Load environment variables with absolute path
dotenv.config({ path: path.join(__dirname, "../../bot/.env") });

// Verify BOT_TOKEN exists
if (!process.env.BOT_TOKEN) {
	throw new Error("BOT_TOKEN must be defined in environment variables!");
}

// Create bot instance
const bot = new Bot(process.env.BOT_TOKEN);

// Start command handler
bot.command("start", async (ctx) => {
	try {
		await ctx.reply("Hello! Bot started successfully.");
	} catch (error) {
		console.error("Error in start command:", error);
	}
});

// Start the bot
try {
	bot.start();
	console.log("Bot started successfully!");
} catch (error) {
	console.error("Error starting the bot:", error);
}
