import { Bot } from "grammy";
import { hydrateFiles } from "@grammyjs/files";
import { userService } from "./services/userService";
import { config } from "./config";
import { messages } from "./messages/messages";
import { setupStartCommand } from "./commands/startCommand";
import { setupAdminCommands } from "./commands/adminCommands";
import { showWelcomeBanner } from "./utils/console";
import { setupHelpCommand } from "./commands/helpCommand";
import { validateSupabaseConnection } from "./services/supabaseClient";
import { TranscriptionServiceFactory } from "./services/transcription/TranscriptionServiceFactory";
import { initConfig } from "./config";
import { TaskProcessor } from "./services/taskProcessor";
import { AudioProcessor } from "./services/audioProcessor";
import { formatDuration, formatPriority } from "./utils/formatters";
import { supabase } from "./services/supabaseClient";
import { TrelloService } from "./services/trelloService";
import { setupSettingsCommand } from "./commands/settingsCommand";
import { createSettingsKeyboard } from "./keyboards/settingsKeyboard";
import { User } from "../types/types";

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
setupSettingsCommand(bot);

// Manejador para mensajes de voz
bot.on("message:voice", async (ctx) => {
	try {
		await ctx.reply("🔍 Procesando tu audio...");

		const user = await userService.getUserByTelegramId(ctx.from.id);
		if (!user) {
			await ctx.reply("❌ Usuario no encontrado");
			return;
		}

		// Verificar configuración completa
		if (!user.default_board_id || !user.default_list_id) {
			await ctx.reply(
				"❌ Necesitas configurar un tablero y una lista por defecto antes de crear tareas.\n" +
					"Usa el comando /settings para configurarlos."
			);
			return;
		}

		const file = await ctx.getFile();
		const transcription = await AudioProcessor.processAudioFile(file);

		// Verificar si hay una tarea pendiente reciente
		const recentTask = await TaskProcessor.getRecentPendingTask(user.id);

		if (recentTask) {
			// Añadir información a la tarea existente
			const updatedTask = await TaskProcessor.appendToExistingTask(
				recentTask.id,
				transcription,
				user.id.toString()
			);

			// Mostrar la tarea actualizada
			await ctx.reply(
				`📝 *Tarea Actualizada*\n\n` +
					`*Título:* ${updatedTask.taskData.title}\n` +
					`*Duración:* ${formatDuration(updatedTask.taskData.duration)}\n` +
					`*Prioridad:* ${formatPriority(updatedTask.taskData.priority)}\n` +
					`*Fecha:* ${formatDate(updatedTask.taskData.dueDate)}\n\n` +
					`*Descripción:*\n${updatedTask.taskData.description}\n\n` +
					`¿Qué quieres hacer?`,
				{
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
				}
			);
			return; // Importante: no seguir con el proceso de nueva tarea
		}

		const result = await TaskProcessor.processTranscription(
			transcription,
			ctx.from.id.toString()
		);

		if (!result.isValidTask || !result.taskData) {
			await ctx.reply(`❌ ${result.message}`);
			return;
		}

		const taskId = await TaskProcessor.storePendingTask(result.taskData, user.id);

		// Crear mensaje con botones
		await ctx.reply(
			`📝 *Nueva Tarea*\n\n` +
				`*Título:* ${result.taskData.title}\n` +
				`*Duración:* ${formatDuration(result.taskData.duration)}\n` +
				`*Prioridad:* ${formatPriority(result.taskData.priority)}\n` +
				`*Fecha:* ${formatDate(result.taskData.dueDate)}\n` +
				`\n*Descripción:*\n${result.taskData.description}\n\n` +
				`¿Qué quieres hacer?`,
			{
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
			}
		);
	} catch (error) {
		console.error("Error processing voice message:", error);
		await ctx.reply("⚠️ Error procesando el mensaje de voz. Por favor, inténtalo de nuevo.");
	}
});

// Manejador para archivos de audio
bot.on("message:audio", async (ctx) => {
	try {
		await ctx.reply("🔍 Processing your audio...");
		const file = await ctx.getFile();
		const transcription = await AudioProcessor.processAudioFile(file);
		await ctx.reply(`📝 Transcription:\n${transcription}`);
	} catch (error) {
		console.error("Error processing audio file:", error);
		await ctx.reply("⚠️ Error processing audio. Please try again.");
	}
});

// Manejador para los botones
bot.callbackQuery(/create_task:(.+)/, async (ctx) => {
	try {
		const user = await userService.getUserByTelegramId(ctx.from.id);
		if (!user) {
			await ctx.reply("❌ Usuario no encontrado");
			return;
		}

		// Verificar autenticación Trello
		if (!user.trello_token) {
			const authUrl = TrelloService.getAuthUrl();
			await ctx.reply("🔑 Necesitas autenticarte en Trello primero", {
				reply_markup: {
					inline_keyboard: [[{ text: "🔗 Autenticar con Trello", url: authUrl }]],
				},
			});
			// Marcar usuario como esperando token
			await userService.updateUser(user.id, { waiting_for_token: true });
			return;
		}

		const taskId = ctx.match[1];
		const taskData = await TaskProcessor.getPendingTask(taskId, user.id);
		if (!taskData) {
			await ctx.reply("❌ La tarea ha expirado. Por favor, crea una nueva.");
			return;
		}

		await TrelloService.createCard(taskData, user);
		await ctx.editMessageText("✅ ¡Tarea creada con éxito en Trello!");
		await TaskProcessor.deletePendingTask(taskId);
	} catch (error: any) {
		if (error.message === "TRELLO_AUTH_REQUIRED") {
			await ctx.editMessageText(
				"❌ Error de autenticación con Trello. Por favor, intenta autenticarte nuevamente."
			);
		} else {
			console.error("Error creating Trello task:", error);
			await ctx.editMessageText(
				"❌ Error al crear la tarea en Trello. Por favor, intenta nuevamente."
			);
		}
	}
});

// Manejador para cuando el usuario envía el token de Trello
bot.on("message:text", async (ctx) => {
	try {
		const user = await userService.getUserByTelegramId(ctx.from.id);
		if (!user?.waiting_for_token) return;

		const token = ctx.message.text.trim();
		// Validar y guardar token...
		await userService.updateUser(user.id, {
			trello_token: token,
			waiting_for_token: false,
		});

		// Solo mostrar mensaje de éxito y menú de configuración
		await ctx.reply(
			"✅ Token de Trello guardado correctamente.\n\n" +
				"Usa los botones para configurar el tablero y la lista donde se crearán las tareas.",
			{
				reply_markup: createSettingsKeyboard({ ...user, trello_token: token } as User),
			}
		);
	} catch (error) {
		console.error("Error saving Trello token:", error);
		await ctx.reply("❌ Error al guardar el token. Por favor, inténtalo de nuevo.");
	}
});

bot.callbackQuery("add_more_info", async (ctx) => {
	await ctx.reply("🎤 Vale, envíame otro audio con la información adicional.");
});

bot.callbackQuery("cancel_task", async (ctx) => {
	try {
		const user = await userService.getUserByTelegramId(ctx.from.id);
		if (!user) {
			await ctx.reply("❌ Usuario no encontrado");
			return;
		}

		// Obtener y eliminar la tarea más reciente
		const recentTask = await TaskProcessor.getRecentPendingTask(user.id);
		if (recentTask) {
			await supabase.from("pending_tasks").delete().eq("id", recentTask.id);
		}

		// Eliminar el mensaje original con los botones
		await ctx.deleteMessage();

		// Enviar mensaje de cancelación como nuevo mensaje
		await ctx.reply("❌ Tarea cancelada.");
	} catch (error) {
		console.error("Error canceling task:", error);
		await ctx.reply("⚠️ Error al cancelar la tarea.");
	}
});

// Start the bot
async function startBot() {
	try {
		// Limpiar comandos anteriores y establecer los nuevos
		await bot.api.deleteMyCommands();
		await bot.api.setMyCommands([
			{ command: "start", description: "Iniciar el bot" },
			{ command: "settings", description: "Configurar Trello" },
			{ command: "help", description: "Ver ayuda" },
		]);

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

function formatDate(dateString: string | undefined | null): string {
	if (!dateString) return "No especificada";

	const date = new Date(dateString);
	const weekDay = date.toLocaleDateString("es-ES", { weekday: "long" });
	const formattedDate = date.toLocaleDateString("es-ES", {
		day: "numeric",
		month: "numeric",
		year: "numeric",
	});

	// Capitalizar primera letra del día
	const capitalizedWeekDay = weekDay.charAt(0).toUpperCase() + weekDay.slice(1);
	return `${capitalizedWeekDay}, ${formattedDate}`;
}

startBot();
