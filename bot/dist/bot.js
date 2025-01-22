"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const grammy_1 = require("grammy");
const files_1 = require("@grammyjs/files");
const userService_1 = require("./services/userService");
const config_1 = require("./config");
const messages_1 = require("./messages");
const startCommand_1 = require("./commands/startCommand");
const adminCommands_1 = require("./commands/adminCommands");
const console_1 = require("./utils/console");
const helpCommand_1 = require("./commands/helpCommand");
// Create bot instance
const bot = new grammy_1.Bot(config_1.config.botToken);
bot.api.config.use((0, files_1.hydrateFiles)(bot.token));
// Middleware para verificar usuario
bot.use(async (ctx, next) => {
    // Skip middleware for /start command
    if (ctx.message?.text === "/start") {
        await next();
        return;
    }
    try {
        if (!ctx.from) {
            await ctx.reply(messages_1.messages.errors.noUser);
            return;
        }
        // Verificar si está baneado
        if (await userService_1.userService.isBanned(ctx.from.id)) {
            await ctx.reply(messages_1.messages.errors.banned);
            return;
        }
        const user = await userService_1.userService.getUserByTelegramId(ctx.from.id);
        // Si el usuario no existe o no está aprobado
        if (!user || !user.is_approved) {
            await ctx.reply(messages_1.messages.errors.notAuthorized);
            return;
        }
        await next();
    }
    catch (error) {
        console.error("Error checking user authorization:", error);
        await ctx.reply("⚠️ An error occurred while checking your authorization.");
    }
});
// Setup commands
(0, startCommand_1.setupStartCommand)(bot);
(0, adminCommands_1.setupAdminCommands)(bot);
(0, helpCommand_1.setupHelpCommand)(bot);
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
// Start the bot
async function startBot() {
    try {
        // Create initial admin user if needed
        await userService_1.userService.createInitialAdmin();
        (0, console_1.showWelcomeBanner)();
        bot.start();
        console.log("Bot started successfully! 🚀");
    }
    catch (error) {
        console.error("Error starting the bot:", error);
    }
}
startBot();
