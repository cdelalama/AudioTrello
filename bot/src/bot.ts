import { Bot } from "grammy";
import { hydrateFiles } from "@grammyjs/files";
import { Audio } from "grammy/types";
import { userService } from "./services/userService";
import { config } from "./config";
import { messages } from "./messages";
import { setupStartCommand } from "./commands/startCommand";
import { setupAdminCommands } from "./commands/adminCommands";
import { showWelcomeBanner } from "./utils/console";
import { setupHelpCommand } from "./commands/helpCommand";

// Create bot instance
const bot = new Bot(config.botToken);
bot.api.config.use(hydrateFiles(bot.token));

// Middleware para verificar usuario
bot.use(async (ctx, next) => {
	// Skip middleware for /start command
	if (ctx.message?.text === "/start") {
		await next();
		return;
	}

	try {
		if (!ctx.from) {
			await ctx.reply(messages.errors.noUser);
			return;
		}

		// Verificar si está baneado
		if (await userService.isBanned(ctx.from.id)) {
			await ctx.reply(messages.errors.banned);
			return;
		}

		const user = await userService.getUserByTelegramId(ctx.from.id);

		// Si el usuario no existe o no está aprobado
		if (!user || !user.is_approved) {
			await ctx.reply(messages.errors.notAuthorized);
			return;
		}

		await next();
	} catch (error) {
		console.error("Error checking user authorization:", error);
		await ctx.reply("⚠️ An error occurred while checking your authorization.");
	}
});

// Setup commands
setupStartCommand(bot);
setupAdminCommands(bot);
setupHelpCommand(bot);

// Manejador para mensajes de audio
bot.on("message:audio", async (ctx) => {
	try {
		const audio = ctx.message.audio;
		const user = ctx.from;

		// Procesar audio
		await ctx.reply("🔍 Processing your audio...");
		const transcription = await transcribeAudio(audio);

		// Clasificar tarea (implementar luego)
		await ctx.reply(`📝 Transcription: ${transcription}`);
	} catch (error) {
		console.error("Error processing audio:", error);
		await ctx.reply("⚠️ Error processing audio. Please try again.");
	}
});

// Función temporal de transcripción (implementar con OpenAI luego)
async function transcribeAudio(audio: Audio): Promise<string> {
	// Placeholder - implementar lógica real
	return "Sample transcription text";
}

// Start the bot
async function startBot() {
	try {
		// Create initial admin user if needed
		await userService.createInitialAdmin();

		showWelcomeBanner();
		bot.start();
		console.log("Bot started successfully! 🚀");
	} catch (error) {
		console.error("Error starting the bot:", error);
	}
}

startBot();
