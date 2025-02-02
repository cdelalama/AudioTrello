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
import { TrelloReminderType } from "../types/types";

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
		console.log("\n🎤 === Nueva transcripción de audio ===");
		await ctx.reply("🔍 Procesando tu audio...");

		const user = await userService.getUserByTelegramId(ctx.from.id);
		if (!user) {
			console.log("❌ User not found in database:", ctx.from.id);
			await ctx.reply(
				"❌ Error al obtener los datos del usuario. Por favor, inténtalo de nuevo en unos segundos."
			);
			return;
		}

		const file = await ctx.getFile();
		const transcription = await AudioProcessor.processAudioFile(file);
		console.log("\n📝 Transcripción:", transcription);

		const recentTask = await TaskProcessor.getRecentPendingTask(user.telegram_id);
		console.log(
			"🔄 Estado:",
			recentTask ? "Añadiendo a tarea existente" : "Creando nueva tarea"
		);

		if (recentTask) {
			const result = await TaskProcessor.appendToExistingTask(
				recentTask.id.toString(),
				transcription,
				user.telegram_id.toString()
			);

			if (result.error) {
				await ctx.reply(`❓ ${result.error}`);
				// Mostrar el resumen de la tarea actual
				await showTaskSummary(
					ctx,
					recentTask.task_data,
					user.timezone_offset,
					recentTask.id
				);
				return;
			}

			console.log("✏️ Tarea actualizada:", {
				id: recentTask.id,
				descripción: result.taskData.description,
				recordatorio: result.taskData.reminder,
			});

			// Mostrar la tarea actualizada
			await showTaskSummary(ctx, result.taskData, user.timezone_offset, recentTask.id);
			return;
		}

		console.log("📋 Procesando como nueva tarea");
		const result = await TaskProcessor.processTranscription(
			transcription,
			ctx.from.id.toString()
		);

		if (!result.isValidTask || !result.taskData) {
			console.log("❌ Tarea inválida:", result.message);
			await ctx.reply(`❌ ${result.message}`);
			return;
		}

		console.log("✅ Nueva tarea creada:", {
			título: result.taskData.title,
			descripción: result.taskData.description,
			recordatorio: result.taskData.reminder,
		});

		const taskId = await TaskProcessor.storePendingTask(result.taskData, user.telegram_id);

		// Crear mensaje con botones
		await ctx.reply(
			`📝 *Nueva Tarea*\n\n` +
				`*Título:* ${escapeMarkdown(result.taskData.title || "")}\n` +
				`*Duración:* ${escapeMarkdown(formatDuration(result.taskData.duration))}\n` +
				`*Prioridad:* ${escapeMarkdown(formatPriority(result.taskData.priority))}\n` +
				`*Fecha:* ${escapeMarkdown(
					await formatDate(result.taskData.dueDate, user.timezone_offset)
				)}\n` +
				`*Recordatorio:* ${escapeMarkdown(formatReminder(result.taskData.reminder))}\n\n` +
				`*Descripción:*\n${escapeMarkdown(result.taskData.description || "")}\n\n` +
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
		console.error("❌ Error general:", error);
		await ctx.reply("❌ Ha ocurrido un error inesperado.");
	}
});

// Manejador para archivos de audio
bot.on("message:audio", async (ctx) => {
	try {
		await ctx.reply("🔍 Processing your audio...");
		const file = await ctx.getFile();
		const transcription = await AudioProcessor.processAudioFile(file);
		await ctx.reply(` Transcription:\n${transcription}`);
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

		// Comprobar timezones de todos los usuarios al arrancar
		await checkAllUsersTimezones();

		// Configurar comprobación periódica cada 24 horas
		setInterval(checkAllUsersTimezones, 24 * 60 * 60 * 1000);

		showWelcomeBanner();
		bot.start();
		console.log("Bot started successfully! 🚀");
	} catch (error) {
		console.error("Error starting the bot:", error);
	}
}

async function checkAllUsersTimezones() {
	try {
		const { data: users } = await supabase
			.from("users")
			.select("id, timezone_last_updated, language_code")
			.eq("is_active", true);

		if (!users) return;

		const now = new Date();
		for (const user of users) {
			const lastUpdate = new Date(user.timezone_last_updated);
			const daysSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24);

			if (daysSinceUpdate >= 7) {
				await userService.updateUserTimezone(user.id, user.language_code);
			}
		}
	} catch (error) {
		console.error("Error checking users timezones:", error);
	}
}

async function formatDate(
	date: string | null | undefined,
	timezone_offset: number
): Promise<string> {
	if (!date) return "No especificada";

	const userDate = new Date(date);
	// Ajustar la fecha según el timezone del usuario
	userDate.setMinutes(userDate.getMinutes() + timezone_offset);

	return userDate.toLocaleDateString("es-ES", {
		weekday: "long",
		day: "numeric",
		month: "numeric",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

function formatReminder(reminder: TrelloReminderType): string {
	if (!reminder) return "No especificado";

	const formats: { [key: string]: string } = {
		at_time: "En el momento",
		"5_minutes_before": "5 minutos antes",
		"10_minutes_before": "10 minutos antes",
		"15_minutes_before": "15 minutos antes",
		"1_hour_before": "1 hora antes",
		"2_hours_before": "2 horas antes",
		"1_day_before": "1 día antes",
		"2_days_before": "2 días antes",
	};

	return formats[reminder] || "No especificado";
}

function escapeMarkdown(text: string | null | undefined): string {
	if (!text) return "";
	// Escapar caracteres especiales de Markdown
	return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
}

// Función auxiliar para mostrar el resumen de la tarea
async function showTaskSummary(ctx: any, taskData: any, timezone_offset: number, taskId: string) {
	const formattedDate = await formatDate(taskData.dueDate, timezone_offset);
	await ctx.reply(
		`📝 *Tarea Actual:*\n` +
			`*Título:* ${escapeMarkdown(taskData.title || "")}\n` +
			`*Duración:* ${escapeMarkdown(formatDuration(taskData.duration))}\n` +
			`*Prioridad:* ${escapeMarkdown(formatPriority(taskData.priority))}\n` +
			`*Fecha:* ${escapeMarkdown(formattedDate)}\n` +
			`*Recordatorio:* ${escapeMarkdown(formatReminder(taskData.reminder))}\n\n` +
			`*Descripción:*\n${escapeMarkdown(taskData.description || "")}\n\n` +
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
}

startBot();
