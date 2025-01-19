import { Bot } from "grammy";
import { hydrateFiles } from "@grammyjs/files";
import { Audio } from "grammy/types";
import { userService } from "./services/userService";
import { config } from "./config";
import { messages } from "./messages/messages";
import { setupStartCommand } from "./commands/startCommand";
import { setupAdminCommands } from "./commands/adminCommands";
import { showWelcomeBanner } from "./utils/console";
import { setupHelpCommand } from "./commands/helpCommand";
import { validateSupabaseConnection } from "./services/supabaseClient";
import { TranscriptionServiceFactory } from "./services/transcription/TranscriptionServiceFactory";
import { configService } from "./services/configService";
import { initConfig } from "./config";

// Create bot instance
const bot = new Bot(config.botToken);
bot.api.config.use(hydrateFiles(bot.token));

// Middleware para verificar usuario
bot.use(async (ctx, next) => {
	// Skip middleware for /start command and approval request
	if (ctx.message?.text === "/start" || ctx.callbackQuery?.data === "request_approval") {
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

// Función helper para procesar audio
async function processAudio(ctx: any, audioData: any) {
	await ctx.reply("🔍 Processing your audio...");

	try {
		const file = await ctx.getFile();
		const fileUrl = `https://api.telegram.org/file/bot${config.botToken}/${file.file_path}`;
		const response = await fetch(fileUrl);
		const buffer = await response.arrayBuffer();
		const audioBuffer = Buffer.from(buffer);

		// Intentar con el servicio primario
		const primaryServiceName = await configService.getPrimaryService();
		const primaryService = TranscriptionServiceFactory.getService(primaryServiceName);
		try {
			const transcription = await primaryService.transcribe(audioBuffer);
			await ctx.reply(`📝 ${primaryServiceName} Transcription:\n${transcription}`);
			return;
		} catch (error) {
			console.log(`${primaryServiceName} transcription failed, trying fallback...`);

			const fallbackServices = await configService.getFallbackServices();
			if (!fallbackServices.length) {
				throw error;
			}

			// Intentar con el primer fallback disponible
			const fallbackService = TranscriptionServiceFactory.getService(fallbackServices[0]);
			const transcription = await fallbackService.transcribe(audioBuffer);
			await ctx.reply(
				`🔊 ${fallbackServices[0]} Transcription (fallback):\n${transcription}`
			);
		}
	} catch (error) {
		console.error("Error processing audio:", error);
		await ctx.reply("⚠️ Error processing audio. Please try again.");
	}
}

// Manejador para archivos de audio
bot.on("message:audio", async (ctx) => {
	try {
		await processAudio(ctx, ctx.message.audio);
	} catch (error) {
		console.error("Error processing audio file:", error);
		await ctx.reply("⚠️ Error processing audio. Please try again.");
	}
});

// Manejador para mensajes de voz
bot.on("message:voice", async (ctx) => {
	try {
		await processAudio(ctx, ctx.message.voice);
	} catch (error) {
		console.error("Error processing voice message:", error);
		await ctx.reply("⚠️ Error processing voice message. Please try again.");
	}
});

// Start the bot
async function startBot() {
	try {
		await initConfig(); // Initialize config first
		// Validate all services
		try {
			await validateSupabaseConnection();
		} catch (error) {
			console.error("Supabase validation failed:", error);
			process.exit(1); // Solo Supabase es crítico
		}

		// Validar servicios opcionales
		await TranscriptionServiceFactory.validateServices();

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
