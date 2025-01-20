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
const supabaseClient_1 = require("./services/supabaseClient");
const TranscriptionServiceFactory_1 = require("./services/transcription/TranscriptionServiceFactory");
const configService_1 = require("./services/configService");
const config_2 = require("./config");
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
// Función helper para procesar audio
async function processAudio(ctx, audioData) {
    await ctx.reply("🔍 Processing your audio...");
    try {
        const file = await ctx.getFile();
        const fileUrl = `https://api.telegram.org/file/bot${config_1.config.botToken}/${file.file_path}`;
        const response = await fetch(fileUrl);
        const buffer = await response.arrayBuffer();
        const audioBuffer = Buffer.from(buffer);
        // Intentar con el servicio primario
        const primaryServiceName = await configService_1.configService.getPrimaryService();
        const primaryService = TranscriptionServiceFactory_1.TranscriptionServiceFactory.getService(primaryServiceName);
        try {
            const transcription = await primaryService.transcribe(audioBuffer);
            await ctx.reply(`📝 ${primaryServiceName} Transcription:\n${transcription}`);
            return;
        }
        catch (error) {
            console.log(`${primaryServiceName} transcription failed, trying fallback...`);
            const fallbackServices = await configService_1.configService.getFallbackServices();
            if (!fallbackServices.length) {
                throw error;
            }
            // Intentar con el primer fallback disponible
            const fallbackService = TranscriptionServiceFactory_1.TranscriptionServiceFactory.getService(fallbackServices[0]);
            const transcription = await fallbackService.transcribe(audioBuffer);
            await ctx.reply(`🔊 ${fallbackServices[0]} Transcription (fallback):\n${transcription}`);
        }
    }
    catch (error) {
        console.error("Error processing audio:", error);
        await ctx.reply("⚠️ Error processing audio. Please try again.");
    }
}
// Manejador para archivos de audio
bot.on("message:audio", async (ctx) => {
    try {
        await processAudio(ctx, ctx.message.audio);
    }
    catch (error) {
        console.error("Error processing audio file:", error);
        await ctx.reply("⚠️ Error processing audio. Please try again.");
    }
});
// Manejador para mensajes de voz
bot.on("message:voice", async (ctx) => {
    try {
        await processAudio(ctx, ctx.message.voice);
    }
    catch (error) {
        console.error("Error processing voice message:", error);
        await ctx.reply("⚠️ Error processing voice message. Please try again.");
    }
});
// Start the bot
async function startBot() {
    try {
        await (0, config_2.initConfig)(); // Initialize config first
        // Validate all services
        try {
            await (0, supabaseClient_1.validateSupabaseConnection)();
        }
        catch (error) {
            console.error("Supabase validation failed:", error);
            process.exit(1); // Solo Supabase es crítico
        }
        // Validar servicios opcionales
        await TranscriptionServiceFactory_1.TranscriptionServiceFactory.validateServices();
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
