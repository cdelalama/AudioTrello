"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const grammy_1 = require("grammy");
const files_1 = require("@grammyjs/files");
const userService_1 = require("./services/userService");
const config_1 = require("./config");
// Create bot instance
const bot = new grammy_1.Bot(config_1.config.botToken);
bot.api.config.use((0, files_1.hydrateFiles)(bot.token));
// Start command handler
bot.command("start", async (ctx) => {
    try {
        const user = ctx.from;
        if (!user) {
            await ctx.reply("❌ Error: Could not get user information");
            return;
        }
        // Check if user exists
        const existingUser = await userService_1.userService.getUserByTelegramId(user.id);
        if (!existingUser) {
            // Try to register as admin first
            const registeredAsAdmin = await userService_1.userService.registerInitialAdmin(user.id, user.username || user.first_name);
            if (registeredAsAdmin) {
                await ctx.reply("👋 Welcome! You have been registered as the admin user.");
                return;
            }
            // If not admin, register as normal user
            const registered = await userService_1.userService.registerUser(user.id, user.username || user.first_name);
            if (registered) {
                await ctx.reply("👋 Welcome! Your registration is pending approval by an admin.");
            }
            else {
                await ctx.reply("❌ Error registering user. Please try again later.");
            }
        }
        else if (!existingUser.is_approved) {
            await ctx.reply("⏳ Your registration is still pending approval.");
        }
        else {
            await ctx.reply("✅ Welcome back! You're already registered and approved.");
        }
    }
    catch (error) {
        console.error("Error in start command:", error);
        await ctx.reply("⚠️ An error occurred. Please try again later.");
    }
});
// Approve command (admin only)
bot.command("approve", async (ctx) => {
    try {
        const admin = await userService_1.userService.getUserByTelegramId(ctx.from?.id || 0);
        if (!admin?.is_admin) {
            await ctx.reply("❌ Only admins can approve users");
            return;
        }
        if (!ctx.message) {
            await ctx.reply("❌ Invalid command format");
            return;
        }
        const userId = ctx.message.text.split(" ")[1];
        if (!userId) {
            await ctx.reply("❌ Please provide a Telegram ID to approve");
            return;
        }
        const approved = await userService_1.userService.approveUser(Number(userId));
        if (approved) {
            await ctx.reply("✅ User approved successfully");
        }
        else {
            await ctx.reply("❌ Error approving user");
        }
    }
    catch (error) {
        console.error("Error in approve command:", error);
        await ctx.reply("⚠️ An error occurred while approving user");
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
    }
    catch (error) {
        console.error("Error processing audio:", error);
        await ctx.reply("⚠️ Error processing audio. Please try again.");
    }
});
// Función temporal de transcripción (implementar con OpenAI luego)
async function transcribeAudio(audio) {
    // Placeholder - implementar lógica real
    return "Sample transcription text";
}
// Función temporal de validación de usuario
async function isValidUser(userId) {
    // Placeholder - integrar con Supabase luego
    return true;
}
// Start the bot
async function startBot() {
    try {
        // Create initial admin user if needed
        await userService_1.userService.createInitialAdmin();
        console.log(`
╔═══════════════════════════════════════╗
║           AUDIO TRELLO BOT            ║
║      Voice Tasks Classification       ║
╠═══════════════════════════════════════╣
║  🎤 Voice to Text                     ║
║  📋 Task Classification               ║
║  📌 Trello Integration               ║
╚═══════════════════════════════════════╝`);
        bot.start();
        console.log("Bot started successfully! 🚀");
    }
    catch (error) {
        console.error("Error starting the bot:", error);
    }
}
startBot();
