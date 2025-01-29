"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const grammy_1 = require("grammy");
const files_1 = require("@grammyjs/files");
const userService_1 = require("./services/userService");
const config_1 = require("./config");
const messages_1 = require("./messages/messages");
const startCommand_1 = require("./commands/startCommand");
const adminCommands_1 = require("./commands/adminCommands");
const console_1 = require("./utils/console");
const helpCommand_1 = require("./commands/helpCommand");
const supabaseClient_1 = require("./services/supabaseClient");
const TranscriptionServiceFactory_1 = require("./services/transcription/TranscriptionServiceFactory");
const config_2 = require("./config");
const taskProcessor_1 = require("./services/taskProcessor");
const audioProcessor_1 = require("./services/audioProcessor");
const formatters_1 = require("./utils/formatters");
const supabaseClient_2 = require("./services/supabaseClient");
const trelloService_1 = require("./services/trelloService");
const settingsCommand_1 = require("./commands/settingsCommand");
// Create bot instance
const bot = new grammy_1.Bot(config_1.config.botToken);
bot.api.config.use((0, files_1.hydrateFiles)(bot.token));
// Middleware para verificar usuario
bot.use(async (ctx, next) => {
    // Skip middleware for /start command and approval request
    if (ctx.message?.text === "/start" || ctx.callbackQuery?.data === "request_approval") {
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
(0, settingsCommand_1.setupSettingsCommand)(bot);
// Manejador para mensajes de voz
bot.on("message:voice", async (ctx) => {
    try {
        await ctx.reply("🔍 Procesando tu audio...");
        const user = await userService_1.userService.getUserByTelegramId(ctx.from.id);
        if (!user) {
            await ctx.reply("❌ Usuario no encontrado");
            return;
        }
        const file = await ctx.getFile();
        const transcription = await audioProcessor_1.AudioProcessor.processAudioFile(file);
        // Verificar si hay una tarea pendiente reciente
        const recentTask = await taskProcessor_1.TaskProcessor.getRecentPendingTask(user.id);
        if (recentTask) {
            // Añadir información a la tarea existente
            const updatedTask = await taskProcessor_1.TaskProcessor.appendToExistingTask(recentTask.id, transcription, user.id.toString());
            // Mostrar la tarea actualizada
            await ctx.reply(`📝 *Tarea Actualizada*\n\n` +
                `*Título:* ${updatedTask.taskData.title}\n` +
                `*Duración:* ${(0, formatters_1.formatDuration)(updatedTask.taskData.duration)}\n` +
                `*Prioridad:* ${(0, formatters_1.formatPriority)(updatedTask.taskData.priority)}\n\n` +
                `*Descripción:*\n${updatedTask.taskData.description}\n\n` +
                `¿Qué quieres hacer?`, {
                parse_mode: "Markdown",
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: "✅ Crear tarea",
                                callback_data: `create_task:${recentTask.id}`,
                            },
                            { text: "❌ Cancelar", callback_data: "cancel_task" },
                        ],
                    ],
                },
            });
            return; // Importante: no seguir con el proceso de nueva tarea
        }
        const result = await taskProcessor_1.TaskProcessor.processTranscription(transcription, ctx.from.id.toString());
        if (!result.isValidTask || !result.taskData) {
            await ctx.reply(`❌ ${result.message}`);
            return;
        }
        const taskId = await taskProcessor_1.TaskProcessor.storePendingTask(result.taskData, user.id);
        // Crear mensaje con botones
        await ctx.reply(`📝 *Nueva Tarea*\n\n` +
            `*Título:* ${result.taskData.title}\n` +
            `*Duración:* ${(0, formatters_1.formatDuration)(result.taskData.duration)}\n` +
            `*Prioridad:* ${(0, formatters_1.formatPriority)(result.taskData.priority)}\n\n` +
            `*Descripción:*\n${result.taskData.description}\n\n` +
            `¿Qué quieres hacer?`, {
            parse_mode: "Markdown",
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: "✅ Crear tarea",
                            callback_data: `create_task:${taskId}`,
                        },
                        { text: "❌ Cancelar", callback_data: "cancel_task" },
                    ],
                ],
            },
        });
    }
    catch (error) {
        console.error("Error processing voice message:", error);
        await ctx.reply("⚠️ Error procesando el mensaje de voz. Por favor, inténtalo de nuevo.");
    }
});
// Manejador para archivos de audio
bot.on("message:audio", async (ctx) => {
    try {
        await ctx.reply("🔍 Processing your audio...");
        const file = await ctx.getFile();
        const transcription = await audioProcessor_1.AudioProcessor.processAudioFile(file);
        await ctx.reply(`📝 Transcription:\n${transcription}`);
    }
    catch (error) {
        console.error("Error processing audio file:", error);
        await ctx.reply("⚠️ Error processing audio. Please try again.");
    }
});
// Manejador para los botones
bot.callbackQuery(/create_task:(.+)/, async (ctx) => {
    try {
        const user = await userService_1.userService.getUserByTelegramId(ctx.from.id);
        if (!user) {
            await ctx.reply("❌ Usuario no encontrado");
            return;
        }
        // Verificar autenticación Trello
        if (!user.trello_token) {
            const authUrl = trelloService_1.TrelloService.getAuthUrl();
            await ctx.reply("🔑 Necesitas autenticarte en Trello primero", {
                reply_markup: {
                    inline_keyboard: [[{ text: "🔗 Autenticar con Trello", url: authUrl }]],
                },
            });
            // Marcar usuario como esperando token
            await userService_1.userService.updateUser(user.id, { waiting_for_token: true });
            return;
        }
        const taskId = ctx.match[1];
        const taskData = await taskProcessor_1.TaskProcessor.getPendingTask(taskId, user.id);
        if (!taskData) {
            await ctx.reply("❌ La tarea ha expirado. Por favor, crea una nueva.");
            return;
        }
        await trelloService_1.TrelloService.createCard(taskData, user);
        await ctx.editMessageText("✅ ¡Tarea creada con éxito en Trello!");
        await taskProcessor_1.TaskProcessor.deletePendingTask(taskId);
    }
    catch (error) {
        if (error.message === "TRELLO_AUTH_REQUIRED") {
            await ctx.editMessageText("❌ Error de autenticación con Trello. Por favor, intenta autenticarte nuevamente.");
        }
        else {
            console.error("Error creating Trello task:", error);
            await ctx.editMessageText("❌ Error al crear la tarea en Trello. Por favor, intenta nuevamente.");
        }
    }
});
// Manejador para guardar el token de Trello
bot.on("message:text", async (ctx) => {
    const user = await userService_1.userService.getUserByTelegramId(ctx.from.id);
    if (!user?.waiting_for_token)
        return;
    const token = ctx.message.text.trim();
    try {
        await userService_1.userService.updateUser(user.id, {
            trello_token: token,
            waiting_for_token: false,
        });
        await ctx.reply("✅ Token de Trello guardado correctamente. Ya puedes crear tareas.");
    }
    catch (error) {
        console.error("Error saving Trello token:", error);
        await ctx.reply("❌ Error al guardar el token. Por favor, intenta nuevamente.");
    }
});
bot.callbackQuery("add_more_info", async (ctx) => {
    await ctx.reply("🎤 Vale, envíame otro audio con la información adicional.");
});
bot.callbackQuery("cancel_task", async (ctx) => {
    try {
        const user = await userService_1.userService.getUserByTelegramId(ctx.from.id);
        if (!user) {
            await ctx.reply("❌ Usuario no encontrado");
            return;
        }
        // Obtener y eliminar la tarea más reciente
        const recentTask = await taskProcessor_1.TaskProcessor.getRecentPendingTask(user.id);
        if (recentTask) {
            await supabaseClient_2.supabase.from("pending_tasks").delete().eq("id", recentTask.id);
        }
        await ctx.reply("❌ Tarea cancelada.");
    }
    catch (error) {
        console.error("Error canceling task:", error);
        await ctx.reply("⚠️ Error al cancelar la tarea.");
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
