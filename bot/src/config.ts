import dotenv from "dotenv";
import path from "path";

// Load environment variables with absolute path
dotenv.config({ path: path.join(__dirname, "../.env") });

// Export all environment variables
export const config = {
	botToken: process.env.BOT_TOKEN as string,
	supabase: {
		url: process.env.SUPABASE_URL as string,
		anonKey: process.env.SUPABASE_ANON_KEY as string,
	},
	admin: {
		telegramId: process.env.ADMIN_TELEGRAM_ID as string,
	},
};

// Validate required environment variables
if (!config.botToken) {
	throw new Error("BOT_TOKEN must be defined in environment variables!");
}

if (!config.supabase.url || !config.supabase.anonKey) {
	throw new Error("Supabase credentials not found in environment variables");
}
