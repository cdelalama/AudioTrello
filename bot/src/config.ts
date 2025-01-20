import dotenv from "dotenv";
import path from "path";
import { configService } from "./services/configService";
import { TranscriptionConfig } from "../types/types";

// Load environment variables
dotenv.config({ path: path.join(__dirname, "../.env") });

// Base config without transcription
const baseConfig = {
	botToken: process.env.BOT_TOKEN as string,
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
		available: Boolean(
			process.env.GOOGLE_APPLICATION_CREDENTIALS && process.env.GOOGLE_PROJECT_ID
		),
	},
	admin: {
		telegramId: process.env.ADMIN_TELEGRAM_ID as string,
	},
	transcription: {} as TranscriptionConfig,
};

export const config = baseConfig;

// Initialize transcription config
export async function initConfig() {
	config.transcription = await configService.getTranscriptionConfig();
}

// Validate only critical environment variables
if (!config.botToken) {
	throw new Error("BOT_TOKEN must be defined in environment variables!");
}

// Log available services
console.log("Available services:");
console.log("- OpenAI Whisper:", config.openai.available ? "✅" : "❌");
console.log("- Google Speech:", config.google.available ? "✅" : "❌");
