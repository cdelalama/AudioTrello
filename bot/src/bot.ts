import { Bot } from "grammy";
import dotenv from "dotenv";
import path from "path";
import { hydrateFiles } from "@grammyjs/files";
import { Audio } from "grammy/types";

// Load environment variables with absolute path
dotenv.config({ path: path.join(__dirname, "../../bot/.env") });

// Verify BOT_TOKEN exists
if (!process.env.BOT_TOKEN) {
	throw new Error("BOT_TOKEN must be defined in environment variables!");
}

// Create bot instance
const bot = new Bot(process.env.BOT_TOKEN);
bot.api.config.use(hydrateFiles(bot.token));

// Start command handler
bot.command("start", async (ctx) => {
	try {
		await ctx.reply("Hello! Bot started successfully.");
	} catch (error) {
		console.error("Error in start command:", error);
	}
});

// Manejador para mensajes de audio
bot.on("message:audio", async (ctx) => {
	try {
		const audio = ctx.message.audio;
		const user = ctx.from;

		// Verificar usuario registrado (implementar luego)
		if (!(await isValidUser(user.id))) {
			await ctx.reply("❌ Please register first using /start");
			return;
		}

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

// Función temporal de validación de usuario
async function isValidUser(userId: number): Promise<boolean> {
	// Placeholder - integrar con Supabase luego
	return true;
}

// Start the bot
try {
	console.log(`
╔═══════════════════════════════════════╗
║           AUDIO TRELLO BOT            ║
║      Voice Tasks Classification       ║
╠═══════════════════════════════════════╣
║  🎤 Voice to Text                     ║
║  📋 Task Classification               ║
║  �� Trello Integration                ║
╚═══════════════════════════════════════╝`);
	bot.start();
	console.log("Bot started successfully! 🚀");
} catch (error) {
	console.error("Error starting the bot:", error);
}
